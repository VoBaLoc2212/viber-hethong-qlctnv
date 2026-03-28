/**
 * AI Service Contract - Public API for other modules
 * Defines the interface that other modules can consume
 */

import type { UserRole } from "@prisma/client";
import type { AIResponse, ChatRequest, ChatResponse } from "../types";

/**
 * Public AI Service Interface
 * Used by other modules and API routes to interact with AI functionality
 */
export interface IAIService {
  /**
   * Send a chat message and get AI response with citations
   * @param request Chat request with question and optional conversation ID
   * @param userId User making the request
   * @param userRole User's role for permission filtering
   * @param departmentIds User's department IDs
   * @param authToken JWT token for API calls
   * @returns Chat response with AI answer and metadata
   */
  chat(
    request: ChatRequest,
    userId: string,
    userRole: UserRole,
    departmentIds?: string[],
    authToken?: string
  ): Promise<ChatResponse>;
}

/**
 * Chat response format expected by API consumers
 */
export interface ChatResponseFormatted {
  data: AIResponse;
  meta: {
    correlation_id: string;
    processing_time_ms: number;
  };
}
