import type { AiChatResponse, AiOrchestratorInput, AiResolution } from "../types";
import { appendChatMessage, ensureChatSession, listRecentChatContext } from "../repositories/chat-history-repo";
import { isLikelyServiceDataQuestion, resolveIntent } from "./intent-router";
import { resolveByRag } from "./rag-service";
import { resolveByService } from "./service-adapter";
import { resolveByText2Sql } from "./text2sql-service";
import { isRouteAllowed, isRuntimeDataPolicy, resolveAiPolicy } from "./ai-policy";

function finalizeResolution(resolution: AiResolution): AiResolution {
  return {
    ...resolution,
    suggestedActions: resolution.suggestedActions ?? [],
    relatedData: resolution.relatedData ?? {},
  };
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

  const intent = await resolveIntent(input.auth.userId, message);
  const policy = resolveAiPolicy(message, intent, input.auth.role);
  const conversationMessages = await listRecentChatContext(input.auth.userId, sessionId, 8);

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

  let resolution = await resolveByService(input.auth, intent, message);

  if (resolution && !isRouteAllowed(resolution.routeUsed, policy.allowedRoutes)) {
    resolution = null;
  }
  if (resolution) {
    resolution = withPolicy(resolution);
  }

  if (!resolution && intent === "GUIDANCE" && isRouteAllowed("RAG", policy.allowedRoutes)) {
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
    const isServiceDataQuestion = isLikelyServiceDataQuestion(message);
    const shouldTryText2Sql = intent !== "GREETING" && isServiceDataQuestion && isRouteAllowed("TEXT2SQL", policy.allowedRoutes);
    const canUseRag = isRouteAllowed("RAG", policy.allowedRoutes);

    let rag: { answer: string; citations: { source: string; snippet: string }[] } | null = null;
    if (canUseRag) {
      rag = await resolveByRag(message, input.auth, { conversationMessages });
    }

    const ragLooksInsufficient = rag ? /chưa đủ|không đủ|chưa có nguồn|xem hướng dẫn|vào trang help/i.test(rag.answer) : true;

    if (shouldTryText2Sql && (ragLooksInsufficient || !rag)) {
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
      } catch {
        if (rag && canUseRag && (!isRuntimeDataPolicy(policy.dataDomain) || !isServiceDataQuestion)) {
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

    if (!resolution && rag && canUseRag && (!isRuntimeDataPolicy(policy.dataDomain) || !isServiceDataQuestion)) {
      resolution = withPolicy({
        intent,
        routeUsed: "RAG",
        rawAnswer: rag.answer,
        citations: rag.citations,
        suggestedActions: ["Mô tả rõ ngữ cảnh để mình hỗ trợ chính xác hơn"],
      });
    }

    if (!resolution) {
      resolution = withPolicy({
        intent,
        routeUsed: "SERVICE",
        rawAnswer: "Mình chưa thể truy xuất dữ liệu trong phạm vi quyền hiện tại. Vui lòng thêm phạm vi (phòng ban/thời gian/trạng thái) hoặc dùng tài khoản có quyền phù hợp.",
        citations: [{ source: "ai-policy", snippet: "controlled-retrieval-rbac" }],
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
