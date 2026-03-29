import type { UserRole } from "@/modules/shared";

export type AiIntent = "GREETING" | "QUERY" | "ANALYSIS" | "FORECAST" | "ALERT" | "GUIDANCE";

export type AiRouteUsed = "SERVICE" | "RAG" | "TEXT2SQL";

export type AiCitation = {
  source: string;
  snippet: string;
};

export type AiChatRequest = {
  sessionId?: string;
  message: string;
  clientMessageId?: string;
};

export type AiChatResponse = {
  sessionId: string;
  answer: string;
  intent: AiIntent;
  routeUsed: AiRouteUsed;
  citations: AiCitation[];
  relatedData?: Record<string, unknown>;
  suggestedActions: string[];
};

export type AiSessionSummary = {
  id: string;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  intent: AiIntent | null;
  routeUsed: AiRouteUsed | null;
  citations: AiCitation[];
  createdAt: string;
};

export type AiOrchestratorInput = {
  auth: {
    userId: string;
    role: UserRole;
    email: string;
  };
  request: AiChatRequest;
  correlationId: string;
};

export type AiResolution = {
  intent: AiIntent;
  routeUsed: AiRouteUsed;
  rawAnswer: string;
  citations: AiCitation[];
  relatedData?: Record<string, unknown>;
  suggestedActions?: string[];
};

export type RagChunk = {
  id: string;
  source: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type KnowledgeDocumentSummary = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
  errorMessage: string | null;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
};
