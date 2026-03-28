/**
 * Question Analyzer Service
 */

import {
  AnalyzedQuestion,
  ApiCall,
  QuestionEntities,
  QuestionIntent,
} from "@/modules/ai/types";
import { getGeminiClient } from "@/lib/ai/gemini-client";

const INTENTS: QuestionIntent[] = [
  QuestionIntent.SUMMARIZE,
  QuestionIntent.COMPARE,
  QuestionIntent.FORECAST,
  QuestionIntent.ANOMALY_DETECT,
  QuestionIntent.CLARIFY,
  QuestionIntent.TREND_ANALYSIS,
];

const INTENT_TO_APIS: Record<QuestionIntent, string[]> = {
  SUMMARIZE: ["/api/transactions"],
  COMPARE: ["/api/transactions"],
  FORECAST: ["/api/transactions"],
  ANOMALY_DETECT: ["/api/transactions"],
  CLARIFY: ["/api/transactions"],
  TREND_ANALYSIS: ["/api/transactions"],
};

export class QuestionAnalyzer {
  private gemini = getGeminiClient();

  async analyze(question: string): Promise<AnalyzedQuestion> {
    const intentResult = await this.classifyIntent(question);
    const entities = await this.extractEntities(question, intentResult.intent);

    return {
      intent: intentResult.intent,
      entities,
      required_apis: this.getRequiredApis(intentResult.intent, entities),
      sql_patterns: [],
      confidence: intentResult.confidence,
    };
  }

  private async classifyIntent(
    question: string
  ): Promise<{ intent: QuestionIntent; confidence: number }> {
    if (!this.gemini.isConfigured()) {
      return this.classifyIntentFallback(question);
    }

    try {
      const prompt = `Classify intent: ${question}`;
      const result = await this.gemini.complete(prompt);
      return JSON.parse(result);
    } catch {
      return this.classifyIntentFallback(question);
    }
  }

  private classifyIntentFallback(
    question: string
  ): { intent: QuestionIntent; confidence: number } {
    const lower = question.toLowerCase();

    if (lower.includes("tóm tắt")) {
      return { intent: QuestionIntent.SUMMARIZE, confidence: 0.7 };
    }

    if (lower.includes("so sánh")) {
      return { intent: QuestionIntent.COMPARE, confidence: 0.7 };
    }

    return { intent: QuestionIntent.CLARIFY, confidence: 0.5 };
  }

  private async extractEntities(
    question: string,
    intent: QuestionIntent
  ): Promise<QuestionEntities> {
    const entities: QuestionEntities = {
      extra: {},
    };

    const now = new Date();

    if (question.toLowerCase().includes("tháng này")) {
      entities.time_range = {
        start: new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split("T")[0],
        end: now.toISOString().split("T")[0],
      };
    }

    if (intent === QuestionIntent.ANOMALY_DETECT) {
      entities.anomaly_threshold = 2.5;
    }

    return entities;
  }

  private getRequiredApis(
    intent: QuestionIntent,
    entities: QuestionEntities
  ): ApiCall[] {
    const endpoints = INTENT_TO_APIS[intent] || [];

    return endpoints.map((endpoint) => ({
      endpoint,
      method: "GET",
      params: entities,
    }));
  }
}

// Singleton
let analyzer: QuestionAnalyzer | null = null;

export function getQuestionAnalyzer(): QuestionAnalyzer {
  if (!analyzer) {
    analyzer = new QuestionAnalyzer();
  }
  return analyzer;
}