/**
 * Gemini Flash API Client
 * Wrapper for Google Generative AI (Gemini) API calls
 * Includes rate limiting and retry logic
 */

import { GeminiRequest, GeminiResponse } from "@/modules/ai/types";

const API_KEY = process.env.GEMINI_API_KEY;
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-2.5-flash"; // or gemini-2.5-pro for higher accuracy

interface GeminiContentBlock {
  text: string;
}

interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiContentBlock[];
}

interface GeminiMessageRequest {
  contents: GeminiMessage[];
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

class GeminiClient {
  private apiKey: string;
  private model: string;
  private requestQueue: Promise<any> = Promise.resolve();
  private requestDelay: number = 100; // ms between requests
  private maxRetries: number = 3;
  private baseRetryDelay: number = 1000; // ms

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || API_KEY || "";
    this.model = model || MODEL;

    if (!this.apiKey) {
      console.warn("⚠️ GEMINI_API_KEY not set. AI features will not work.");
    }
  }

  /**
   * Configure rate limiting and retry behavior
   */
  setRateLimitConfig(options: {
    requestDelay?: number;
    maxRetries?: number;
    baseRetryDelay?: number;
  }): void {
    if (options.requestDelay !== undefined) {
      this.requestDelay = options.requestDelay;
    }
    if (options.maxRetries !== undefined) {
      this.maxRetries = options.maxRetries;
    }
    if (options.baseRetryDelay !== undefined) {
      this.baseRetryDelay = options.baseRetryDelay;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Queue request to prevent rate limiting
   */
  private async queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue = this.requestQueue
        .then(async () => {
          await this.sleep(this.requestDelay);
          return fn();
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Retry logic with exponential backoff for rate limit errors
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const isRateLimitError =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("Too Many Requests") ||
          error.message.includes("RESOURCE_EXHAUSTED"));

      if (isRateLimitError && retryCount < this.maxRetries) {
        const delayMs = this.baseRetryDelay * Math.pow(2, retryCount);
        console.warn(
          `Rate limited. Retrying after ${delayMs}ms (attempt ${retryCount + 1}/${this.maxRetries})`
        );
        await this.sleep(delayMs);
        return this.retryWithBackoff(fn, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Call Gemini API with structured prompt
   */
  async chat(request: GeminiRequest): Promise<GeminiResponse> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    return this.queueRequest(() =>
      this.retryWithBackoff(async () => {
        const url = `${API_BASE}/${this.model}:generateContent?key=${this.apiKey}`;

        // Convert to Gemini format - parts should only contain text, not type
        const payload: GeminiMessageRequest = {
          systemInstruction: {
            parts: [{ text: request.system }],
          },
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens ?? 2048,
            topP: 0.95,
            topK: 40,
          },
          contents: request.messages.map((msg) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          })),
        };

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          const statusCode = response.status;
          const errorMessage =
            error.error?.message || response.statusText || "Unknown error";

          throw new Error(
            `Gemini API error (${statusCode}): ${errorMessage}`
          );
        }

        const data = await response.json();

        // Extract answer from response
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
          throw new Error("No content in Gemini response");
        }

        // Parse usage tokens
        const usageMetadata = data.usageMetadata || {};

        return {
          answer: content,
          citations: [],
          tokens: {
            prompt: usageMetadata.promptTokenCount || 0,
            completion: usageMetadata.candidatesTokenCount || 0,
            total: usageMetadata.totalTokenCount || 0,
          },
        };
      })
    );
  }

  /**
   * Simple text completion
   */
  async complete(prompt: string, maxTokens = 1024): Promise<string> {
    const response = await this.chat({
      system: "You are a helpful AI assistant for financial analysis.",
      messages: [{ role: "user", content: prompt }],
      maxTokens,
      temperature: 0.7,
    });
    return response.answer;
  }

  /**
   * Extract structured data from text using function calling
   * (Future: implement tool_choice for guaranteed extraction)
   */
  async extractStructured(text: string, schema: string): Promise<any> {
    const prompt = `Extract structured data from the following text according to this schema:

Schema: ${schema}

Text:
${text}

Return ONLY valid JSON matching the schema.`;

    const response = await this.complete(prompt);

    try {
      return JSON.parse(response);
    } catch {
      console.error("Failed to parse structured response:", response);
      throw new Error("Failed to extract structured data");
    }
  }

  /**
   * Intent classification
   */
  async classifyIntent(
    question: string,
    intents: string[]
  ): Promise<{ intent: string; confidence: number }> {
    const intentList = intents.join(", ");
    const prompt = `Classify the following question into ONE of these intents: ${intentList}

Question: "${question}"

Respond with JSON: {"intent": "<selected_intent>", "confidence": <0-1>}`;

    const response = await this.complete(prompt);

    try {
      return JSON.parse(response);
    } catch {
      // Fallback
      return { intent: intents[0], confidence: 0.5 };
    }
  }

  /**
   * SQL query generation from natural language
   */
  async generateSQL(
    question: string,
    schema: string,
    context?: string
  ): Promise<string> {
    const prompt = `Generate a SQL query for the following question.

Database Schema:
${schema}

${context ? `Context:\n${context}\n` : ""}

Question: "${question}"

Return ONLY the SQL query without explanation.`;

    return this.complete(prompt);
  }

  /**
   * Get model info
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Singleton instance
let geminiClient: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!geminiClient) {
    geminiClient = new GeminiClient();
  }
  return geminiClient;
}

export function createGeminiClient(
  apiKey?: string,
  model?: string
): GeminiClient {
  return new GeminiClient(apiKey, model);
}

export default GeminiClient;
