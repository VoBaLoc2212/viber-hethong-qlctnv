import type { AiChatResponse, AiOrchestratorInput, AiResolution } from "../types";
import { appendChatMessage, ensureChatSession, listRecentChatContext } from "../repositories/chat-history-repo";

const FULL_DATA_ROLES = new Set<string>(["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN"]);
import { isLikelyServiceDataQuestion, resolveIntent } from "./intent-router";
import { resolveByRag } from "./rag-service";
import { resolveByService } from "./service-adapter";
import { resolveByText2Sql } from "./text2sql-service";
import { isRouteAllowed, resolveAiPolicy } from "./ai-policy";

function finalizeResolution(resolution: AiResolution): AiResolution {
  return {
    ...resolution,
    suggestedActions: resolution.suggestedActions ?? [],
    relatedData: resolution.relatedData ?? {},
  };
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isGuidanceLikeMessage(message: string) {
  const normalized = normalizeSearchText(message);
  return /quy trinh|huong dan|chinh sach|policy|help|tai lieu|document|docs|kb|kien thuc/.test(normalized);
}

function shouldPreferText2SqlFirst(message: string) {
  const normalized = normalizeSearchText(message);
  const guidanceLike = isGuidanceLikeMessage(message);
  const runtimeDataLike = /bao cao|report|kpi|dashboard|lich su|history|tong|bao nhieu|so lieu|theo ngay|theo thang|theo quy|thu chi hien tai|giao dich/.test(normalized);

  return runtimeDataLike && !guidanceLike;
}

export async function handleAiChat(input: AiOrchestratorInput): Promise<AiChatResponse> {
  const startedAt = Date.now();
  const message = input.request.message.trim();

  const sessionId = await ensureChatSession(input.auth.userId, input.request.sessionId, message);

  await appendChatMessage({
    sessionId,
    role: "USER",
    content: message,
    correlationId: input.correlationId,
  });

  const guidanceLike = isGuidanceLikeMessage(message);
  const routedIntent = await resolveIntent(input.auth.userId, message);
  const intent = guidanceLike ? "GUIDANCE" : routedIntent;
  const policy = resolveAiPolicy(message, intent, input.auth.role);
  const conversationMessages = await listRecentChatContext(input.auth.userId, sessionId, 8);
  const isServiceDataQuestion = isLikelyServiceDataQuestion(message);
  const canAccessRuntimeData = FULL_DATA_ROLES.has(input.auth.role);

  const withPolicy = (resolution: AiResolution): AiResolution => ({
    ...resolution,
    dataDomain: policy.dataDomain,
    policyKey: policy.policyKey,
    scopeApplied: policy.scopeApplied,
    relatedData: {
      ...(resolution.relatedData ?? {}),
      dataDomain: policy.dataDomain,
      policyKey: policy.policyKey,
      scopeApplied: policy.scopeApplied,
    },
  });

  let resolution: AiResolution | null = null;

  if (isServiceDataQuestion && intent !== "GUIDANCE" && !canAccessRuntimeData) {
    resolution = {
      intent,
      routeUsed: "SERVICE",
      rawAnswer: "Mình chưa thể truy xuất dữ liệu trong phạm vi quyền hiện tại. Vui lòng thêm phạm vi (phòng ban/thời gian/trạng thái) hoặc dùng tài khoản có quyền phù hợp.",
      citations: [{ source: "ai-policy", snippet: "controlled-retrieval-rbac" }],
      suggestedActions: ["Kiểm tra quyền truy cập theo vai trò", "Dùng tài khoản MANAGER, ACCOUNTANT hoặc FINANCE_ADMIN"],
    };
  } else {
    const canUseService = isRouteAllowed("SERVICE", policy.allowedRoutes);
    resolution = canUseService ? await resolveByService(input.auth, intent, message) : null;
  }
  let text2SqlFailure: { message: string; code?: string } | null = null;

  if (resolution && !isRouteAllowed(resolution.routeUsed, policy.allowedRoutes)) {
    resolution = null;
  }
  if (resolution) {
    resolution = withPolicy(resolution);
  }

  const isCapabilityQuestion = /quyen|vai tro|role|permission|co the lam gi|what can you do|ban co the lam gi/i.test(
    message
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase(),
  );

  if (!resolution && intent === "GUIDANCE" && isRouteAllowed("RAG", policy.allowedRoutes) && !isCapabilityQuestion) {
    const rag = await resolveByRag(message, input.auth, { conversationMessages });
    resolution = withPolicy({
      intent,
      routeUsed: "RAG",
      rawAnswer: rag.answer,
      citations: rag.citations,
      suggestedActions: ["Mở trang Trung tâm hỗ trợ để xem hướng dẫn chi tiết"],
    });
  }

  if (!resolution) {
    const shouldTryText2Sql = intent !== "GREETING" && isServiceDataQuestion && !guidanceLike && isRouteAllowed("TEXT2SQL", policy.allowedRoutes);
    const canUseRag = isRouteAllowed("RAG", policy.allowedRoutes) || guidanceLike;

    const preferText2SqlFirst = shouldTryText2Sql && shouldPreferText2SqlFirst(message);

    let rag: { answer: string; citations: { source: string; snippet: string }[] } | null = null;
    if (canUseRag && !preferText2SqlFirst) {
      rag = await resolveByRag(message, input.auth, { conversationMessages });
    }

    const ragLooksInsufficient = rag ? /chưa đủ|không đủ|chưa có nguồn|xem hướng dẫn|vào trang help/i.test(rag.answer) : true;

    if (shouldTryText2Sql && (preferText2SqlFirst || ragLooksInsufficient || !rag)) {
      try {
        const sql = await resolveByText2Sql(input.auth, message, {
          policyKey: policy.policyKey,
          dataDomain: policy.dataDomain,
          scopeApplied: policy.scopeApplied,
        });
        resolution = withPolicy({
          intent,
          routeUsed: "TEXT2SQL",
          rawAnswer: sql.answer,
          citations: sql.citations,
          relatedData: sql.relatedData,
          suggestedActions: ["Thêm bộ lọc thời gian để kết quả chính xác hơn"],
        });
      } catch (error) {
        text2SqlFailure = {
          message: error instanceof Error ? error.message : "Text2SQL failed",
          code: typeof error === "object" && error !== null && "code" in error
            ? String((error as { code?: unknown }).code)
            : undefined,
        };

        if (canUseRag && !rag) {
          rag = await resolveByRag(message, input.auth, { conversationMessages });
        }
        if (rag && canUseRag && (!isServiceDataQuestion || intent === "GUIDANCE")) {
          resolution = withPolicy({
            intent,
            routeUsed: "RAG",
            rawAnswer: rag.answer,
            citations: rag.citations,
            suggestedActions: ["Mô tả rõ ngữ cảnh để mình hỗ trợ chính xác hơn"],
          });
        }
      }
    }

    if (!resolution && canUseRag && !rag) {
      rag = await resolveByRag(message, input.auth, { conversationMessages });
    }

    if (!resolution && rag && canUseRag && (!isServiceDataQuestion || intent === "GUIDANCE")) {
      resolution = withPolicy({
        intent,
        routeUsed: "RAG",
        rawAnswer: rag.answer,
        citations: rag.citations,
        suggestedActions: ["Mô tả rõ ngữ cảnh để mình hỗ trợ chính xác hơn"],
      });
    }

    if (!resolution) {
      const text2SqlDiagnostic = text2SqlFailure
        ? {
          text2sqlError: text2SqlFailure.message,
          text2sqlErrorCode: text2SqlFailure.code ?? null,
        }
        : {};

      resolution = withPolicy({
        intent,
        routeUsed: "SERVICE",
        rawAnswer: "Mình chưa thể truy xuất dữ liệu trong phạm vi quyền hiện tại. Vui lòng thêm phạm vi (phòng ban/thời gian/trạng thái) hoặc dùng tài khoản có quyền phù hợp.",
        citations: [{ source: "ai-policy", snippet: "controlled-retrieval-rbac" }],
        relatedData: text2SqlDiagnostic,
        suggestedActions: ["Thêm bộ lọc phạm vi dữ liệu", "Kiểm tra quyền truy cập theo vai trò"],
      });
    }
  }

  const done = finalizeResolution(resolution);

  await appendChatMessage({
    sessionId,
    role: "ASSISTANT",
    content: done.rawAnswer,
    intent: done.intent,
    routeUsed: done.routeUsed,
    citations: done.citations,
    relatedData: done.relatedData,
    suggestedActions: done.suggestedActions,
    correlationId: input.correlationId,
    latencyMs: Date.now() - startedAt,
  });

  return {
    sessionId,
    answer: done.rawAnswer,
    intent: done.intent,
    routeUsed: done.routeUsed,
    citations: done.citations,
    relatedData: done.relatedData,
    dataDomain: done.dataDomain,
    policyKey: done.policyKey,
    scopeApplied: done.scopeApplied,
    suggestedActions: done.suggestedActions ?? [],
  };
}
