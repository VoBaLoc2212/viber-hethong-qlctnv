import type { AiIntent } from "../types";
import { generateWithGemini } from "./gemini-client";
import { buildIntentPrompt } from "./prompt-builder";
import { getIntentCache, setIntentCache } from "./memory-service";

const GREETING_PATTERN = /^(hello|hi|hey|xin chào|chào|alo|yo)\b/i;
const ALERT_PATTERN = /vượt ngân sách|sắp vượt|cảnh báo|bất thường|treo quá/i;
const FORECAST_PATTERN = /dự báo|tháng tới|quý tới|xu hướng|trend/i;
const TOP_CATEGORY_PATTERN = /top danh mục|xếp hạng danh mục|top category/i;
const ANALYSIS_PATTERN = /so sánh|phân tích|vì sao|nguyên nhân|top|xếp hạng|q1|q2|q3|q4/i;
const GUIDANCE_PATTERN = /làm sao|hướng dẫn|quy trình|hard stop|chính sách|help|hỗ trợ/i;
const SERVICE_DATA_PATTERN = /chi phí|ngân sách|giao dịch|expense|income|approval|phê duyệt|phòng ban|department|báo cáo|report|doanh thu|fx|tỷ giá|usd|vnd|q[1-4]|quý|tháng|năm|kpi|danh mục/i;

export function ruleBasedIntent(message: string): AiIntent {
  if (GREETING_PATTERN.test(message.trim())) return "GREETING";
  if (GUIDANCE_PATTERN.test(message)) return "GUIDANCE";
  if (ALERT_PATTERN.test(message)) return "ALERT";
  if (FORECAST_PATTERN.test(message)) return "FORECAST";
  if (TOP_CATEGORY_PATTERN.test(message) || ANALYSIS_PATTERN.test(message)) return "ANALYSIS";
  return "QUERY";
}

export function normalizeIntent(raw: string | null): AiIntent | null {
  if (!raw) return null;
  const value = raw.trim().toUpperCase();
  if (
    value === "GREETING" ||
    value === "QUERY" ||
    value === "ANALYSIS" ||
    value === "FORECAST" ||
    value === "ALERT" ||
    value === "GUIDANCE"
  ) {
    return value;
  }

  return null;
}

export function isLikelyServiceDataQuestion(message: string): boolean {
  return SERVICE_DATA_PATTERN.test(message);
}

export async function resolveIntent(userId: string, message: string): Promise<AiIntent> {
  const cached = await getIntentCache(userId, message);
  const normalizedCached = normalizeIntent(cached?.intent ?? null);
  if (normalizedCached) {
    return normalizedCached;
  }

  const ruled = ruleBasedIntent(message);
  if (ruled !== "QUERY") {
    await setIntentCache(userId, message, ruled);
    return ruled;
  }

  const fromGemini = normalizeIntent(await generateWithGemini(buildIntentPrompt(message)));
  const resolved = fromGemini ?? ruled;
  await setIntentCache(userId, message, resolved);
  return resolved;
}
