/**
 * AI Module - Domain Types
 * Financial Q&A assistant types
 */

import type { UserRole } from "@prisma/client";

// ============ ENUMS ============

export enum QuestionIntent {
  SUMMARIZE = "SUMMARIZE",
  COMPARE = "COMPARE",
  FORECAST = "FORECAST",
  ANOMALY_DETECT = "ANOMALY_DETECT",
  CLARIFY = "CLARIFY",
  TREND_ANALYSIS = "TREND_ANALYSIS",
}

export enum DataType {
  STRING = "string",
  NUMBER = "number",
  DATE = "date",
  CURRENCY = "currency",
  PERCENTAGE = "percentage",
}

// ============ QUESTION ANALYSIS ============

export type QuestionEntities = {
  category?: string;
  department?: string;
  time_range?: {
    start: string;
    end: string;
  };
  compared_to?: string;
  anomaly_threshold?: number;
  extra: Record<string, any>;
};

export type ApiCall = {
  endpoint: string;
  method?: "GET" | "POST";
  params?: Record<string, any>;
  description?: string;
};

export type AnalyzedQuestion = {
  intent: QuestionIntent;
  entities: QuestionEntities;
  required_apis: ApiCall[];
  sql_patterns: string[];
  confidence: number;
};

// ============ PERMISSION & CONTEXT ============

export type PermissionFilter = {
  departments?: string[];
  categories?: string[];
  statuses?: string[];
  extra: Record<string, any>;
};

export type UserFilters = {
  budget_filter: PermissionFilter;
  transaction_filter: PermissionFilter;
  read_only_mode: boolean;

  // ✅ thêm camelCase alias
  budgetFilter?: PermissionFilter;
  transactionFilter?: PermissionFilter;
  readOnlyMode?: boolean;
};

export type UserContext = {
  user_id: string;
  auth_token?: string;

  // camelCase alias
  userId?: string;
  authToken?: string;

  role: UserRole;
  department?: string;
  department_ids: string[];
  filters: UserFilters;
};

// ============ DATA RETRIEVAL & TRANSFORMATION ============

export type RetrievedData = {
  source: string;
  data?: any;
  fetch_time?: number;

  // ✅ alias
  fetchTime?: number;

  error?: string;
};

export type ColumnDef = {
  id: string;
  label: string;

  // snake_case
  data_type: DataType;

  // ✅ alias camelCase
  dataType?: DataType;

  width?: number;
  sortable?: boolean;
  format?: string;
};

export type DataSummary = {
  total?: number;
  average?: number;
  trend?: "UP" | "DOWN" | "STABLE";
  anomalies?: any[];
};

export type TransformedData = {
  type: "table" | "metric" | "timeseries";
  columns?: ColumnDef[];
  rows?: Array<Record<string, any>>;
  summary?: DataSummary;
};

// ============ CONVERSATION ============

export type Citation = {
  source: string;
  reference?: Record<string, any>;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  question?: string;
  answer?: string;
  table_data?: Array<Record<string, any>>;
  citations?: Citation[];
  processing_time_ms?: number;
  tokens_used?: number;
  created_at: Date;
};

export type Conversation = {
  id: string;
  user_id: string;
  title?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
};

// ============ RESPONSE TYPES ============

export type ProcessMetadata = {
  time_ms: number;
  data_sources_hit: string[];
  vectors_retrieved: number;
  tokens_used: number;
};

export type AIResponse = {
  id: string;
  conversation_id: string;
  question: string;
  answer: string;
  citations: Citation[];
  confidence: number;
  suggested_follow_ups: string[];
  process_metadata: ProcessMetadata;
};

// ============ REQUEST TYPES ============

export interface ChatRequestContext {
  department_id?: string;
  category_id?: string;
  time_range?: {
    start: string;
    end: string;
  };
}

export interface ChatRequest {
  question: string;
  conversation_id?: string;
  context?: ChatRequestContext;
}

export interface ChatResponse {
  data: AIResponse;
  meta: Record<string, any>;
}

// ============ GEMINI (LLM) TYPES ============

export type GeminiMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GeminiRequest = {
  system: string;
  messages: GeminiMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type GeminiTokenUsage = {
  prompt: number;
  completion: number;
  total: number;
};

export type GeminiResponse = {
  answer: string;
  citations: Citation[];
  tokens: GeminiTokenUsage;
};