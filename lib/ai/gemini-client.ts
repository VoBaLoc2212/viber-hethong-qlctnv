/**
 * Gemini LLM Client
 * Wrapper for Google's Gemini API for AI responses
 */

interface GenerateContentConfig {
  max_output_tokens?: number;
  temperature?: number;
}

interface GeminiResponse {
  answer: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
}

export class GeminiClient {
  private apiKey: string | null;
  private modelName = "gemini-2.5-flash";
  private isConfigured = false;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || null;

    // Initialize Gemini - in production you'd use google.generativeai package
    if (this.apiKey) {
      this.isConfigured = true;
    }
  }

  isGeminiConfigured(): boolean {
    return this.isConfigured;
  }

  async complete(
    prompt: string,
    maxTokens: number = 1024,
    temperature: number = 0.7
  ): Promise<string> {
    if (!this.isConfigured) {
      throw new Error("Gemini API not configured");
    }

    // In production, call actual Gemini API
    // This is a mock implementation
    return this.mockGeminiCall(prompt);
  }

  async chat(
    system: string | null,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number = 1024,
    temperature: number = 0.7
  ): Promise<GeminiResponse> {
    if (!this.isConfigured) {
      throw new Error("Gemini API not configured");
    }

    // Build full prompt
    let fullPrompt = "";

    if (system) {
      fullPrompt += `System: ${system}\n\n`;
    }

    for (const msg of messages) {
      const role = msg.role;
      const content = msg.content.trim();

      if (!content) continue;

      if (role === "user") {
        fullPrompt += `User: ${content}\n\n`;
      } else if (role === "assistant") {
        fullPrompt += `Assistant: ${content}\n\n`;
      } else if (role === "system") {
        fullPrompt += `System: ${content}\n\n`;
      }
    }

    fullPrompt += "Assistant:";

    // In production, call actual Gemini API
    const answer = await this.mockGeminiCall(fullPrompt);

    return {
      answer,
      tokens: {
        input: Math.ceil(fullPrompt.length / 4),
        output: Math.ceil(answer.length / 4),
        total: Math.ceil((fullPrompt.length + answer.length) / 4),
      },
    };
  }

  private async mockGeminiCall(prompt: string): Promise<string> {
    // This is a mock implementation
    // Replace with actual Gemini API call in production
    return (
      "Dựa trên dữ liệu được cung cấp, tôi có thể giúp bạn phân tích thông tin tài chính. " +
      "Vui lòng cung cấp dữ liệu cụ thể để tôi có thể đưa ra câu trả lời chi tiết.\n\n" +
      "Một số phân tích mà tôi có thể thực hiện:\n" +
      "- Tóm tắt chi tiêu theo danh mục\n" +
      "- So sánh ngân sách so với thực tế\n" +
      "- Phát hiện các bất thường trong giao dịch\n" +
      "- Phân tích xu hướng chi tiêu"
    );
  }
}

// Global client instance
let geminiClientInstance: GeminiClient | null = null;

export function getGeminiClient(apiKey?: string): GeminiClient {
  if (geminiClientInstance === null) {
    geminiClientInstance = new GeminiClient(apiKey);
  }
  return geminiClientInstance;
}

export function createGeminiClient(apiKey: string): GeminiClient {
  return new GeminiClient(apiKey);
}
