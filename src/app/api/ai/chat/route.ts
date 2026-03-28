import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { AIService, type ChatRequest } from "@/modules/ai";
import { prisma } from "@/lib/db/prisma/client";
import type { UserRole } from "@prisma/client";

// Validation schema
const ChatRequestSchema = z.object({
  question: z
    .string()
    .min(3, "Question must be at least 3 characters")
    .max(500, "Question must not exceed 500 characters"),
  conversation_id: z.string().uuid().optional(),
  context: z
    .object({
      department_id: z.string().optional(),
      category_id: z.string().optional(),
      time_range: z
        .object({
          start: z.string(),
          end: z.string(),
        })
        .optional(),
    })
    .optional(),
});

// Error code constants
const AIErrorCodes = {
  INVALID_QUESTION: "INVALID_QUESTION",
  UNAUTHORIZED: "UNAUTHORIZED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  DATA_RETRIEVAL_FAILED: "DATA_RETRIEVAL_FAILED",
  LLM_ERROR: "LLM_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

interface AIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  correlationId?: string;
  statusCode: number;
}

/**
 * Parse and validate Authorization header
 */
function extractUserFromHeaders(
  authHeader: string | null
): {
  userId: string;
  role: UserRole;
  departmentIds: string[];
} | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  try {
    // For development: parse simple format
    // In production: use JWT library (e.g., jsonwebtoken)
    const token = authHeader.substring(7);

    // Validate token is not empty
    if (!token || token.trim() === "") {
      return null;
    }

    // TODO: Properly decode JWT
    // For now, return mock data - replace with actual JWT parsing
    return {
      userId: "user-123",
      role: "FINANCE_ADMIN" as UserRole,
      departmentIds: ["dept-1"],
    };
  } catch (error) {
    console.error("Failed to parse auth header:", error);
    return null;
  }
}

/**
 * POST /api/ai/chat - Main AI chat endpoint
 */
export async function POST(request: NextRequest) {
  const correlationId = randomUUID();

  try {
    // Parse request body
    let body: ChatRequest;
    try {
      const json = await request.json();
      body = ChatRequestSchema.parse(json);
    } catch (error) {
      return respondError(
        AIErrorCodes.INVALID_QUESTION,
        "Invalid request format",
        { error: String(error) },
        400,
        correlationId
      );
    }

    // Extract user from auth header
    const authHeader = request.headers.get("authorization");
    const userInfo = extractUserFromHeaders(authHeader);

    if (!userInfo) {
      return respondError(
        AIErrorCodes.UNAUTHORIZED,
        "Missing or invalid authorization",
        undefined,
        401,
        correlationId
      );
    }

    // Initialize AI Service
    const aiService = new AIService("http://localhost:3001");

    // Extract auth token (remove "Bearer " prefix)
    const authToken = authHeader?.substring(7);

    // Call AI Service (handles all orchestration internally)
    const response = await aiService.chat(
      body,
      userInfo.userId,
      userInfo.role,
      userInfo.departmentIds,
      authToken
    );

    // Store in database (optional - ConversationManager already stores in-memory)
    try {
      const aiResponse = response.data;

      // Store conversation
      await (prisma as any).aIConversation.upsert({
        where: {
          id: aiResponse.conversation_id,
        },
        update: {
          updated_at: new Date(),
        },
        create: {
          id: aiResponse.conversation_id,
          user_id: userInfo.userId,
          title: body.question.substring(0, 100),
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Store message
      await (prisma as any).aIMessage.create({
        data: {
          id: aiResponse.id,
          conversation_id: aiResponse.conversation_id,
          role: "assistant",
          question: body.question,
          answer: aiResponse.answer,
          citations: aiResponse.citations,
          processing_time_ms: aiResponse.process_metadata.time_ms,
          llm_model: "gemini-2.5-flash",
          tokens_used: aiResponse.process_metadata.tokens_used,
          confidence_score: Number(aiResponse.confidence.toFixed(2)),
          data_sources_hit: aiResponse.process_metadata.data_sources_hit,
          created_at: new Date(),
        },
      });
    } catch (error) {
      console.error("[AI Chat] Failed to store message in database:", error);
      // Continue anyway - don't fail the response
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(`[AI Chat Error ${correlationId}]`, error);

    return respondError(
      AIErrorCodes.INTERNAL_ERROR,
      "Internal server error",
      { error: error instanceof Error ? error.message : String(error) },
      500,
      correlationId
    );
  }
}

/**
 * Helper: Send error response
 */
function respondError(
  code: string,
  message: string,
  details?: Record<string, any>,
  statusCode: number = 500,
  correlationId?: string
): NextResponse {
  const error: AIError = {
    code,
    message,
    details,
    correlationId,
    statusCode,
  };

  return NextResponse.json(error, { status: statusCode });
}
