import type { AiIntent } from "../types";
import { generateWithChatEndpoint } from "./openai-chat-client";
import { buildIntentPrompt } from "./prompt-builder";
import { getIntentCache, setIntentCache } from "./memory-service";

const GREETING_PATTERN = /^(hello|hi|hey|xin chào|chào|alo|yo)([\s!.,?]*)$/i;
const ALERT_PATTERN = /vượt ngân sách|sắp vượt|cảnh báo|bất thường|treo quá/i;
const FORECAST_PATTERN = /dự báo|tháng tới|quý tới|xu hướng|trend|nếu giữ tốc độ|khi nào[^\n]{0,80}(chạm|cạn|hết)/i;
const TOP_CATEGORY_PATTERN = /top danh mục|xếp hạng danh mục|top category/i;
const ANALYSIS_PATTERN = /so sánh|phân tích|vì sao|nguyên nhân|xếp hạng|q1|q2|q3|q4/i;
const GUIDANCE_PATTERN = /làm sao|hướng dẫn|quy trình|hard stop|chính sách|help|hỗ trợ|tài liệu|document|docs/i;
const NORMALIZED_GUIDANCE_PATTERN = /lam sao|huong dan|quy trinh|hard stop|chinh sach|help|ho tro|tai lieu|document|docs|policy/i;
const KPI_DATA_PATTERN = /tổng ngân sách|tổng chi|tổng thu|số dư|còn lại hiện tại|kpi hiện tại/i;
const SERVICE_DATA_PATTERN = /chi phí|chi tiêu|ngân sách|giao dịch|expense|income|approval|phê duyệt|phòng ban|department|báo cáo|report|doanh thu|fx|tỷ giá|usd|vnd|q[1-4]|quý|tháng|năm|kpi|danh mục|tổng ngân sách|tổng chi|tổng thu|số dư|còn lại hiện tại|lịch sử|history|quyền|vai trò|role|permission|hoàn ứng|settlement|quỹ tiền mặt|cashbook|nhật ký|security|audit|log/i;
const NORMALIZED_SERVICE_DATA_PATTERN = /chi phi|chi tieu|ngan?\s*sach|giao dich|expense|income|approval|phe duyet|phong ban|department|bao cao|report|doanh thu|fx|ty gia|usd|vnd|q[1-4]|quy|thang|nam|kpi|danh muc|tong ngan sach|tong chi|tong thu|so du|con lai hien tai|lich su|history|quyen|vai tro|role|permission|budget|hoan ung|settlement|quy tien mat|cashbook|nhat ky|security|audit|log/i;

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function ruleBasedIntent(message: string): AiIntent {
  const trimmed = message.trim();

  if (GREETING_PATTERN.test(trimmed)) return "GREETING";
  if (KPI_DATA_PATTERN.test(trimmed)) return "QUERY";
  if (ALERT_PATTERN.test(trimmed)) return "ALERT";
  if (FORECAST_PATTERN.test(trimmed)) return "FORECAST";
  if (TOP_CATEGORY_PATTERN.test(trimmed) || ANALYSIS_PATTERN.test(trimmed)) return "ANALYSIS";
  if (GUIDANCE_PATTERN.test(trimmed) || NORMALIZED_GUIDANCE_PATTERN.test(normalizeSearchText(trimmed))) return "GUIDANCE";
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
  if (SERVICE_DATA_PATTERN.test(message)) return true;
  return NORMALIZED_SERVICE_DATA_PATTERN.test(normalizeSearchText(message));
}

function isAmbiguousIntentPair(ruled: AiIntent, fromModel: AiIntent) {
  if (ruled === fromModel) return false;
  const pair = new Set([ruled, fromModel]);
  if (pair.has("GUIDANCE") && pair.has("ALERT")) return true;
  if (pair.has("GUIDANCE") && pair.has("FORECAST")) return true;
  if (pair.has("GUIDANCE") && pair.has("ANALYSIS")) return true;
  if (pair.has("ANALYSIS") && pair.has("FORECAST")) return true;
  return false;
}

export async function resolveIntent(userId: string, message: string): Promise<AiIntent> {
  const isServiceDataQuestion = isLikelyServiceDataQuestion(message);

  if (!isServiceDataQuestion) {
    const cached = await getIntentCache(userId, message);
    const normalizedCached = normalizeIntent(cached?.intent ?? null);
    if (normalizedCached) {
      return normalizedCached;
    }
  }

  const ruled = ruleBasedIntent(message);
  const fromModel = normalizeIntent(await generateWithChatEndpoint(buildIntentPrompt(message)));
  const normalizedMessage = normalizeSearchText(message);
  const isGuidanceLike = GUIDANCE_PATTERN.test(message) || NORMALIZED_GUIDANCE_PATTERN.test(normalizedMessage);

  const resolved = isServiceDataQuestion && !isGuidanceLike
    ? ruled
    : ruled === "GUIDANCE" && isGuidanceLike
      ? ruled
      : fromModel && (ruled === "QUERY" || isAmbiguousIntentPair(ruled, fromModel))
        ? fromModel
        : ruled;

  await setIntentCache(userId, message, resolved);
  return resolved;
}
