import type { AiChatResponse, AiOrchestratorInput, AiResolution } from "../types";
import { appendChatMessage, ensureChatSession, listRecentChatContext } from "../repositories/chat-history-repo";
import { isLikelyServiceDataQuestion, resolveIntent } from "./intent-router";
import { resolveByRag } from "./rag-service";
import { resolveByService } from "./service-adapter";
import { resolveByText2Sql } from "./text2sql-service";

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
  const conversationMessages = await listRecentChatContext(input.auth.userId, sessionId, 8);

  let resolution = await resolveByService(input.auth, intent, message);

  if (!resolution && intent === "GUIDANCE") {
    const rag = await resolveByRag(message, input.auth, { conversationMessages });
    resolution = {
      intent,
      routeUsed: "RAG",
      rawAnswer: rag.answer,
      citations: rag.citations,
      suggestedActions: ["Mở trang Trung tâm hỗ trợ để xem hướng dẫn chi tiết"],
    };
  }

  if (!resolution) {
    const shouldTryText2Sql = intent !== "GREETING" && isLikelyServiceDataQuestion(message);

    const rag = await resolveByRag(message, input.auth, { conversationMessages });
    const ragLooksInsufficient = /chưa đủ|không đủ|chưa có nguồn|xem hướng dẫn|vào trang help/i.test(rag.answer);

    if (shouldTryText2Sql && ragLooksInsufficient) {
      try {
        const sql = await resolveByText2Sql(input.auth, message);
        resolution = {
          intent,
          routeUsed: "TEXT2SQL",
          rawAnswer: sql.answer,
          citations: sql.citations,
          relatedData: sql.relatedData,
          suggestedActions: ["Thêm bộ lọc thời gian để kết quả chính xác hơn"],
        };
      } catch {
        resolution = {
          intent,
          routeUsed: "RAG",
          rawAnswer: rag.answer,
          citations: rag.citations,
          suggestedActions: ["Mô tả rõ ngữ cảnh để mình hỗ trợ chính xác hơn"],
        };
      }
    } else {
      resolution = {
        intent,
        routeUsed: "RAG",
        rawAnswer: rag.answer,
        citations: rag.citations,
        suggestedActions: ["Mô tả rõ ngữ cảnh để mình hỗ trợ chính xác hơn"],
      };
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
    suggestedActions: done.suggestedActions ?? [],
  };
}
