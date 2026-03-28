/**
 * AI Service - Main Orchestrator
 * Orchestrates the RAG pipeline
 */

import { randomUUID } from "crypto";
import type { UserRole } from "@prisma/client";

import {
  AIResponse,
  AnalyzedQuestion,
  ChatRequest,
  ChatResponse,
  Citation,
  ProcessMetadata,
  UserContext,
} from "../types";
import { QuestionAnalyzer } from "./question-analyzer";
import { PermissionValidator } from "./permission-validator";
import { DataRetriever } from "./data-retriever";
import { DataTransformer } from "./data-transformer";
import { ConversationManager } from "./conversation-manager";
import { getGeminiClient } from "@/lib/ai/gemini-client";

export class AIService {
  private analyzer: QuestionAnalyzer;
  private permissionValidator: PermissionValidator;
  private dataRetriever: DataRetriever;
  private dataTransformer: DataTransformer;
  private conversationManager: ConversationManager;
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:3001") {
    this.baseUrl = baseUrl;
    this.analyzer = new QuestionAnalyzer();
    this.permissionValidator = new PermissionValidator();
    this.dataRetriever = new DataRetriever(baseUrl);
    this.dataTransformer = new DataTransformer();
    this.conversationManager = new ConversationManager();
  }

  async chat(
    request: ChatRequest,
    userId: string,
    userRole: UserRole,
    departmentIds: string[] = [],
    authToken?: string
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    const correlationId = randomUUID();

    try {
      // 1. Build user context
      let userContext = this.permissionValidator.buildUserContext(
        userId,
        userRole,
        departmentIds
      );
      userContext.auth_token = authToken;

      // 2. Analyze question
      console.log(`[${correlationId}] Analyzing question: ${request.question}`);
      const analysis = await this.analyzer.analyze(request.question);

      // 3. Retrieve data from APIs
      console.log(
        `[${correlationId}] Retrieving data from ${analysis.required_apis.length} APIs`
      );
      const dataResult = await this.dataRetriever.aggregateData(
        analysis.required_apis,
        userContext
      );

      // 4. Transform data
      console.log(`[${correlationId}] Transforming retrieved data`);
      let tableContext = "";
      const citations: Citation[] = [];

      for (const [source, data] of Object.entries(dataResult.data)) {
        if (typeof data === "object" && data !== null && "error" in data) {
          continue;
        }

        const normalized = this.dataRetriever.normalizeResponse(data);
        if (normalized.items && normalized.items.length > 0) {
          tableContext += `\n## ${source}\n`;
          tableContext += JSON.stringify(normalized.items.slice(0, 5), null, 2);
        }

        citations.push({
          source,
          reference: {
            id: source,
            description: `Data from ${source}`,
          },
        });
      }

      // 5. Get or create conversation
      let conversationId = request.conversation_id;
      if (conversationId) {
        const conv = await this.conversationManager.getConversation(conversationId);
        if (!conv) {
          const newConv = await this.conversationManager.createConversation(userId);
          conversationId = newConv.id;
        }
      } else {
        const conv = await this.conversationManager.createConversation(userId);
        conversationId = conv.id;
      }

      // Get conversation history
      const conversationHistory = await this.conversationManager.getRecentMessages(
        conversationId,
        5
      );

      // 6. Build LLM prompt
      const systemPrompt = `You are an AI financial assistant for a corporate budget management system.

SCOPE: Read-only access to financial data. You CANNOT perform transactions, approvals, or any write operations.

BUSINESS CONTEXT:
- Budget flow: Budget → Approval (if required) → Transaction → Ledger
- Roles: EMPLOYEE, MANAGER, ACCOUNTANT, FINANCE_ADMIN, AUDITOR
- All amounts in VND (Vietnamese Dong)
- Data is current as of the system's last update

INSTRUCTIONS:
1. Provide clear, data-backed answers using the data provided
2. If data is incomplete or ambiguous, state this explicitly
3. Format numbers with thousand separators
4. Cite data sources when providing facts
5. Answer in Vietnamese
6. Keep response concise but informative`;

      let msgContext = "";
      if (conversationHistory.length > 0) {
        msgContext = this.conversationManager.buildConversationContext(conversationHistory);
        msgContext = `\nConversation context:\n${msgContext}\n`;
      }

      const userPrompt = `Question: ${request.question}

Available Data:
${tableContext}

${msgContext}

Please answer based on the data above. If you cannot answer due to missing data, say so explicitly.`;

      // 7. Call Gemini
      const gemini = getGeminiClient();
      console.log(`[${correlationId}] Calling Gemini API`);
      const llmResponse = await gemini.chat({
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
      });

      const answer = llmResponse.answer;
      const tokensUsed = llmResponse.tokens.total;

      // 8. Store in conversation
      await this.conversationManager.addUserMessage(conversationId, request.question);

      const processingTime = Date.now() - startTime;

      await this.conversationManager.addAssistantMessage(
        conversationId,
        request.question,
        answer,
        citations,
        processingTime,
        tokensUsed
      );

      // 9. Build response
      const responseId = randomUUID();

      const aiResponse: AIResponse = {
        id: responseId,
        conversation_id: conversationId,
        question: request.question,
        answer,
        citations,
        confidence:
          analysis.confidence *
          (1 - dataResult.error_count / Math.max(1, analysis.required_apis.length)),
        suggested_follow_ups: [
          "Tell me more details about this",
          "Compare this with last month",
          "Show me the breakdown by category",
        ],
        process_metadata: {
          time_ms: processingTime,
          data_sources_hit: dataResult.sources
            .filter((s) => !s.error)
            .map((s) => s.source),
          vectors_retrieved: 0,
          tokens_used: tokensUsed,
        },
      };

      console.log(`[${correlationId}] Chat completed successfully`);

      return {
        data: aiResponse,
        meta: {
          correlation_id: correlationId,
          processing_time_ms: processingTime,
        },
      };
    } catch (error) {
      console.error(`[${correlationId}] Error in chat:`, error);
      throw error;
    }
  }
}
