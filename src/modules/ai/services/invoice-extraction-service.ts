import { AppError } from "@/modules/shared/errors/app-error";

const ALLOWED_MIME_TYPES = (process.env.TRANSACTION_ATTACHMENT_ALLOWED_MIME_TYPES ?? "application/pdf,image/jpeg,image/png,image/webp")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const MAX_FILE_SIZE = Number(process.env.TRANSACTION_ATTACHMENT_MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024);
const EXTRACTION_ENABLED = (process.env.AI_INVOICE_EXTRACTION_ENABLED ?? "true").toLowerCase() !== "false";
const AI_CHAT_API_KEY = process.env.AI_CHAT_API_KEY?.trim();
const AI_CHAT_MODEL = process.env.AI_CHAT_MODEL?.trim();
const AI_GEMINI_API_KEY = process.env.AI_GEMINI_API_KEY?.trim();
const AI_GEMINI_MODEL = process.env.AI_GEMINI_MODEL?.trim();
const AI_TEMPERATURE = Number(process.env.AI_TEMPERATURE ?? 0.1);
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 30000);

type ChatProvider = {
  endpoint: string;
  apiKey: string;
  model: string;
};

function resolveChatEndpoint(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const normalized = raw.replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) return normalized;
  if (normalized.endsWith("/v1")) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

function resolveProviders(): ChatProvider[] {
  const primaryEndpoint = resolveChatEndpoint(process.env.AI_CHAT_ENDPOINT?.trim() || process.env.AI_CHAT_BASE_URL?.trim());
  const geminiEndpoint = resolveChatEndpoint(
    process.env.AI_GEMINI_ENDPOINT?.trim() || process.env.AI_GEMINI_BASE_URL?.trim() || process.env.AI_CHAT_ENDPOINT?.trim() || process.env.AI_CHAT_BASE_URL?.trim(),
  );

  const providers: ChatProvider[] = [];

  if (primaryEndpoint && AI_CHAT_API_KEY && AI_CHAT_MODEL) {
    providers.push({
      endpoint: primaryEndpoint,
      apiKey: AI_CHAT_API_KEY,
      model: AI_CHAT_MODEL,
    });
  }

  if (geminiEndpoint && AI_GEMINI_API_KEY && AI_GEMINI_MODEL) {
    providers.push({
      endpoint: geminiEndpoint,
      apiKey: AI_GEMINI_API_KEY,
      model: AI_GEMINI_MODEL,
    });
  }

  return providers;
}

function normalizeDecimal(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalizedRaw = String(value).replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.-]/g, "");
  const numberValue = Number(normalizedRaw);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return null;
  return numberValue.toFixed(2);
}

function normalizeText(value: unknown, max = 300): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, max);
}

export type InvoiceExtractionSplit = {
  amount: string;
  categoryCode?: string | null;
  note?: string | null;
};

export type InvoiceExtractionResult = {
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  amount?: string | null;
  description?: string | null;
  splits?: InvoiceExtractionSplit[];
  confidence?: number | null;
  warnings?: string[];
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{ type?: string; text?: string; image_url?: { url?: string } }>;
    };
  }>;
};

function resolveMessageContent(
  content: string | Array<{ type?: string; text?: string; image_url?: { url?: string } }> | undefined,
): string | null {
  if (!content) return null;

  if (typeof content === "string") {
    const normalized = content.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (Array.isArray(content)) {
    const normalized = content
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

function parseExtractionPayload(raw: string): InvoiceExtractionResult {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: "FAILED",
      warnings: ["Không đọc được kết quả trích xuất JSON từ AI."],
    };
  }

  const value = parsed as {
    amount?: unknown;
    description?: unknown;
    splits?: Array<{ amount?: unknown; categoryCode?: unknown; note?: unknown }>;
    confidence?: unknown;
    warnings?: unknown;
  };

  const amount = normalizeDecimal(value.amount);
  const description = normalizeText(value.description, 500);
  const splits = Array.isArray(value.splits)
    ? value.splits
        .map((line) => ({
          amount: normalizeDecimal(line.amount),
          categoryCode: normalizeText(line.categoryCode, 64),
          note: normalizeText(line.note, 250),
        }))
        .filter((line): line is { amount: string; categoryCode: string | null; note: string | null } => Boolean(line.amount))
        .map((line) => ({
          amount: line.amount,
          categoryCode: line.categoryCode,
          note: line.note,
        }))
    : [];

  const confidence = typeof value.confidence === "number" && Number.isFinite(value.confidence)
    ? Math.max(0, Math.min(1, value.confidence))
    : null;

  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  if (amount && splits.length > 0) {
    const splitTotal = splits.reduce((sum, line) => sum + Number(line.amount), 0);
    if (Math.abs(splitTotal - Number(amount)) > 0.01) {
      warnings.push("Tổng chia tách không khớp số tiền tổng; vui lòng kiểm tra lại trước khi tạo phiếu.");
    }
  }

  if (amount || description || splits.length > 0) {
    return {
      status: warnings.length > 0 ? "PARTIAL" : "SUCCESS",
      amount,
      description,
      splits: splits.length > 0 ? splits : undefined,
      confidence,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  return {
    status: "FAILED",
    warnings: ["AI không trích xuất được dữ liệu phù hợp từ hóa đơn."],
  };
}

function buildPrompt() {
  return [
    "Bạn là hệ thống trích xuất dữ liệu hóa đơn tiếng Việt.",
    "Đọc ảnh hóa đơn và trả về CHÍNH XÁC một JSON object, không thêm markdown.",
    "Schema JSON:",
    "{",
    '  "amount": "string decimal tổng thanh toán",',
    '  "description": "string ngắn mô tả giao dịch",',
    '  "splits": [{ "amount": "string decimal", "categoryCode": "string|null", "note": "string|null" }],',
    '  "confidence": 0.0,',
    '  "warnings": ["string"]',
    "}",
    "Quy tắc:",
    "- amount là tổng cộng tiền thanh toán cuối hóa đơn.",
    "- splits là danh sách dòng hàng hóa/dịch vụ theo cột thành tiền.",
    "- Không bịa dữ liệu; không chắc thì để warnings.",
    "- Dùng dấu chấm cho số thập phân.",
  ].join("\n");
}

export async function extractInvoiceFromAttachment(file: File): Promise<InvoiceExtractionResult> {
  if (!EXTRACTION_ENABLED) {
    return { status: "SKIPPED", warnings: ["Đã tắt AI invoice extraction."] };
  }

  const mimeType = file.type?.trim().toLowerCase() || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new AppError("Unsupported attachment type", "INVALID_INPUT", { mimeType });
  }

  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new AppError("Attachment file size is invalid", "INVALID_INPUT", {
      maxFileSize: MAX_FILE_SIZE,
      actualSize: file.size,
    });
  }

  const providers = resolveProviders();
  if (providers.length === 0) {
    return { status: "SKIPPED", warnings: ["AI endpoint/model chưa được cấu hình."] };
  }

  if (!mimeType.startsWith("image/")) {
    return { status: "SKIPPED", warnings: ["Hiện chỉ hỗ trợ tự động trích xuất cho file ảnh (jpeg/png/webp)."] };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  for (const provider of providers) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number.isFinite(AI_TIMEOUT_MS) && AI_TIMEOUT_MS > 0 ? AI_TIMEOUT_MS : 30000,
    );

    try {
      const response = await fetch(provider.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: Number.isFinite(AI_TEMPERATURE) ? AI_TEMPERATURE : 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: buildPrompt() },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as OpenAiChatResponse;
      const content = resolveMessageContent(payload.choices?.[0]?.message?.content);
      if (!content) {
        continue;
      }

      return parseExtractionPayload(content);
    } catch {
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    status: "FAILED",
    warnings: ["Không thể trích xuất dữ liệu hóa đơn ở thời điểm hiện tại."],
  };
}
