/**
 * Question Analyzer Service
 * Parses user questions to extract intent, entities, and required data sources
 */

import {
  AnalyzedQuestion,
  QuestionEntities,
  QuestionIntent,
  ApiCall,
} from "../types";

// Intent to required APIs mapping
const INTENT_TO_APIS: Record<QuestionIntent, string[]> = {
  [QuestionIntent.SUMMARIZE]: ["/api/transactions", "/api/budgeting/budgets", "/api/reports"],
  [QuestionIntent.COMPARE]: ["/api/transactions", "/api/budgeting/budgets", "/api/reports"],
  [QuestionIntent.FORECAST]: ["/api/reports", "/api/transactions", "/api/budgeting/budgets"],
  [QuestionIntent.ANOMALY_DETECT]: ["/api/transactions", "/api/controls", "/api/ledger"],
  [QuestionIntent.CLARIFY]: ["/api/budgeting/budgets", "/api/transactions"],
  [QuestionIntent.TREND_ANALYSIS]: ["/api/reports", "/api/transactions", "/api/ledger"],
};

// SQL patterns for common questions
const SQL_PATTERNS: Record<string, string[]> = {
  category_summary: [
    "SELECT category, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE date >= ? AND date <= ? GROUP BY category ORDER BY total DESC",
  ],
  department_budget: [
    "SELECT d.name, b.amount, b.used, b.reserved, (b.amount - b.used - b.reserved) as available FROM budgets b JOIN departments d ON b.department_id = d.id",
  ],
  anomalies: [
    "SELECT * FROM budget_control_logs WHERE anomaly_detected = true ORDER BY created_at DESC",
  ],
  trend: [
    "SELECT DATE_TRUNC('month', date) as month, SUM(amount) as total FROM transactions GROUP BY month ORDER BY month DESC LIMIT 12",
  ],
};

export class QuestionAnalyzer {
  async analyze(question: string): Promise<AnalyzedQuestion> {
    const intentResult = await this.classifyIntent(question);
    const entities = await this.extractEntities(question, intentResult.intent);
    const requiredApis = this.getRequiredApis(intentResult.intent, entities);
    const sqlPatterns = this.getRelevantSqlPatterns(intentResult.intent, question);

    return {
      intent: intentResult.intent,
      entities,
      required_apis: requiredApis,
      sql_patterns: sqlPatterns,
      confidence: intentResult.confidence,
    };
  }

  private async classifyIntent(
    question: string
  ): Promise<{ intent: QuestionIntent; confidence: number }> {
    const lower = question.toLowerCase();

    if (lower.includes("tóm tắt") || lower.includes("summary") || lower.includes("tổng")) {
      return { intent: QuestionIntent.SUMMARIZE, confidence: 0.7 };
    }

    if (lower.includes("compare") || lower.includes("so sánh") || lower.includes("khác")) {
      return { intent: QuestionIntent.COMPARE, confidence: 0.7 };
    }

    if (lower.includes("forecast") || lower.includes("dự báo") || lower.includes("predict")) {
      return { intent: QuestionIntent.FORECAST, confidence: 0.7 };
    }

    if (
      lower.includes("anomaly") ||
      lower.includes("bất thường") ||
      lower.includes("lạ") ||
      lower.includes("unusual")
    ) {
      return { intent: QuestionIntent.ANOMALY_DETECT, confidence: 0.7 };
    }

    if (lower.includes("trend") || lower.includes("xu hướng") || lower.includes("trend")) {
      return { intent: QuestionIntent.TREND_ANALYSIS, confidence: 0.7 };
    }

    return { intent: QuestionIntent.CLARIFY, confidence: 0.6 };
  }

  private async extractEntities(
    question: string,
    intent: QuestionIntent
  ): Promise<QuestionEntities> {
    const entities: QuestionEntities = { extra: {} };

    const timeRanges = this.parseTimeRange(question);
    if (timeRanges) {
      entities.time_range = timeRanges;
    }

    const departments = this.extractDepartments(question);
    if (departments) {
      entities.department = departments;
    }

    const categories = this.extractCategories(question);
    if (categories) {
      entities.category = categories;
    }

    return entities;
  }

  private parseTimeRange(question: string): { start: string; end: string } | null {
    const lower = question.toLowerCase();

    if (lower.includes("tháng này") || lower.includes("this month")) {
      const now = new Date();
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        start,
        end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
      };
    }

    if (lower.includes("tháng trước") || lower.includes("last month")) {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const start = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`;
      const end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
      return {
        start,
        end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
      };
    }

    if (lower.includes("3 tháng") || lower.includes("3 months") || lower.includes("quý")) {
      const start = new Date();
      start.setMonth(start.getMonth() - 3);
      return {
        start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`,
        end: new Date().toISOString().split("T")[0],
      };
    }

    return null;
  }

  private extractDepartments(question: string): string | null {
    const departments = ["IT", "HR", "Finance", "Marketing", "Sales", "Operations"];
    for (const dept of departments) {
      if (question.toLowerCase().includes(dept.toLowerCase())) {
        return dept;
      }
    }
    return null;
  }

  private extractCategories(question: string): string | null {
    const categories = ["travel", "equipment", "software", "training", "utilities"];
    for (const cat of categories) {
      if (question.toLowerCase().includes(cat.toLowerCase())) {
        return cat;
      }
    }
    return null;
  }

  private getRequiredApis(intent: QuestionIntent, entities: QuestionEntities): ApiCall[] {
    const apis = INTENT_TO_APIS[intent] || [];
    return apis.map((endpoint) => ({
      endpoint,
      method: "GET",
      params: this.buildApiParams(entities),
    }));
  }

  private buildApiParams(entities: QuestionEntities): Record<string, any> {
    const params: Record<string, any> = {};

    if (entities.department) {
      params.department = entities.department;
    }

    if (entities.category) {
      params.category = entities.category;
    }

    if (entities.time_range) {
      params.start_date = entities.time_range.start;
      params.end_date = entities.time_range.end;
    }

    return params;
  }

  private getRelevantSqlPatterns(intent: QuestionIntent, question: string): string[] {
    const patterns: string[] = [];

    if (intent === QuestionIntent.SUMMARIZE) {
      patterns.push(...SQL_PATTERNS.category_summary);
      patterns.push(...SQL_PATTERNS.department_budget);
    } else if (intent === QuestionIntent.COMPARE) {
      patterns.push(...SQL_PATTERNS.category_summary);
    } else if (intent === QuestionIntent.TREND_ANALYSIS) {
      patterns.push(...SQL_PATTERNS.trend);
    } else if (intent === QuestionIntent.ANOMALY_DETECT) {
      patterns.push(...SQL_PATTERNS.anomalies);
    }

    return patterns;
  }
}
