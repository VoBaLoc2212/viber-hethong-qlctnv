export type RagChunk = {
  id: string;
  source: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type RagChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type RagChatRequest = {
  conversationId: string;
  question: string;
};

export type RagChatResponse = {
  answer: string;
  citations: Array<{ source: string; snippet: string }>;
};
