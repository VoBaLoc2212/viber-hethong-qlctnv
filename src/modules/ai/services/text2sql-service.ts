import { prisma } from "@/lib/db/prisma/client";

import type { AuthContext } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

import type { AiCitation } from "../types";
import { generateWithGemini } from "./gemini-client";
import { getSqlCache, setSqlCache } from "./memory-service";
import { buildText2SqlPrompt, buildText2SqlSystemPrompt } from "./prompt-builder";

const FORBIDDEN = /(insert|update|delete|drop|alter|truncate|grant|revoke|copy|;|--|\/\*)/i;
const ALLOWED_TABLES = [/\btransaction\b/i, /\bbudget\b/i, /\bdepartment\b/i, /\bapproval\b/i, /\bfx_?rate\b/i];

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function buildHeuristicSql(message: string): string | null {
  const normalized = normalizeSearchText(message);

  const isFxQuestion = /fx|ty\s*gia|usd|vnd|exchange\s*rate/.test(normalized);
  if (isFxQuestion) {
    const fromCurrency = /\busd\b/.test(normalized) ? "USD" : "USD";
    const toCurrency = /\bvnd\b/.test(normalized) ? "VND" : "VND";
    const currentMonth = /thang\s*nay|current\s*month|thang\s*hien\s*tai/.test(normalized);

    if (/trung\s*binh|average|avg/.test(normalized)) {
      return currentMonth
        ? `SELECT AVG(rate) AS avg_rate FROM "FxRate" WHERE "fromCurrency" = '${fromCurrency}' AND "toCurrency" = '${toCurrency}' AND date_trunc('month', "rateDate") = date_trunc('month', now()) LIMIT 100`
        : `SELECT AVG(rate) AS avg_rate FROM "FxRate" WHERE "fromCurrency" = '${fromCurrency}' AND "toCurrency" = '${toCurrency}' LIMIT 100`;
    }

    return `SELECT "fromCurrency", "toCurrency", "rateDate", rate, source, "fetchedAt" FROM "FxRate" WHERE "fromCurrency" = '${fromCurrency}' AND "toCurrency" = '${toCurrency}' ORDER BY "rateDate" DESC LIMIT 20`;
  }

  if (/thu\s*chi\s*hien\s*tai|current\s*income|current\s*expense|tong\s*thu|tong\s*chi/.test(normalized)) {
    return "SELECT SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS total_income, SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS total_expense FROM \"Transaction\" WHERE status <> 'REJECTED' LIMIT 100";
  }

  return null;
}

export function ensureSafeSelect(sql: string) {
  const trimmed = sql.trim();

  if (!/^select\s/i.test(trimmed)) {
    throw new AppError("Only SELECT is allowed", "FORBIDDEN");
  }

  if (FORBIDDEN.test(trimmed)) {
    throw new AppError("Unsafe SQL pattern detected", "FORBIDDEN");
  }

  const hasAllowedTable = ALLOWED_TABLES.some((pattern) => pattern.test(trimmed));
  if (!hasAllowedTable) {
    throw new AppError("SQL references table outside allowlist", "FORBIDDEN");
  }

  if (!/\blimit\s+\d+/i.test(trimmed)) {
    return `${trimmed} LIMIT 100`;
  }

  return trimmed;
}

export function applyRoleScope(sql: string, auth: AuthContext) {
  if (auth.role !== "EMPLOYEE") {
    return sql;
  }

  throw new AppError("Text2SQL is unavailable for EMPLOYEE role", "FORBIDDEN");
}

export function normalizeSql(raw: string | null): string {
  if (!raw) {
    throw new AppError("Text2SQL model did not return SQL", "UNPROCESSABLE_ENTITY");
  }

  const oneLine = raw.replace(/```sql|```/gi, "").trim();
  if (oneLine.toUpperCase() === "UNSAFE") {
    throw new AppError("Query was rejected as unsafe by model", "FORBIDDEN");
  }

  return oneLine;
}

export async function resolveByText2Sql(
  auth: AuthContext,
  message: string,
  options?: { policyKey?: string; dataDomain?: string; scopeApplied?: string },
): Promise<{
  answer: string;
  citations: AiCitation[];
  relatedData: Record<string, unknown>;
}> {
  const cached = await getSqlCache(auth.role, message);
  if (cached) {
    return {
      answer: cached.answer,
      citations: [{ source: "sql-cache", snippet: "recent safe query result" }],
      relatedData: cached.relatedData ?? {},
    };
  }

  const generated = await generateWithGemini(buildText2SqlPrompt(message, buildText2SqlSystemPrompt(auth)));
  const heuristic = buildHeuristicSql(message);
  const sql = normalizeSql(generated ?? heuristic);
  const safeSql = applyRoleScope(ensureSafeSelect(sql), auth);

  const rows = (await prisma.$queryRawUnsafe(safeSql)) as unknown[];

  const answer = rows.length === 0
    ? "Không có dữ liệu phù hợp với truy vấn này."
    : `Đã truy vấn ${rows.length} dòng dữ liệu phù hợp. Dưới đây là kết quả tổng hợp theo truy vấn của bạn.`;
  const relatedData = {
    sql: safeSql,
    rows,
    policyKey: options?.policyKey ?? "text2sql-default",
    dataDomain: options?.dataDomain ?? "DATA_RUNTIME",
    scopeApplied: options?.scopeApplied ?? `text2sql-${auth.role.toLowerCase()}`,
  };

  await setSqlCache(auth.role, message, { answer, relatedData });

  return {
    answer,
    citations: [{ source: "text2sql", snippet: safeSql.slice(0, 200) }],
    relatedData,
  };
}
