import { prisma } from "@/lib/db/prisma/client";

import type { AuthContext } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

import type { AiCitation } from "../types";
import { getSqlCache, setSqlCache } from "./memory-service";

const FORBIDDEN = /(insert|update|delete|drop|alter|truncate|grant|revoke|copy|;|--|\/\*)/i;
const ALLOWED_TABLES = [/\btransaction\b/i, /\bbudget\b/i, /\bdepartment\b/i, /\bapproval\b/i, /\bfx_?rate\b/i];

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function buildHeuristicRoute(message: string):
  | { kind: "fx_latest"; limit: number }
  | { kind: "fx_average"; currentMonth: boolean }
  | { kind: "income_expense_totals" }
  | null {
  const normalized = normalizeSearchText(message);

  const isFxQuestion = /fx|ty\s*gia|usd|vnd|exchange\s*rate/.test(normalized);
  if (isFxQuestion) {
    if (/trung\s*binh|average|avg/.test(normalized)) {
      const currentMonth = /thang\s*nay|current\s*month|thang\s*hien\s*tai/.test(normalized);
      return { kind: "fx_average", currentMonth };
    }

    return { kind: "fx_latest", limit: 20 };
  }

  if (/thu\s*chi\s*hien\s*tai|current\s*income|current\s*expense|tong\s*thu|tong\s*chi/.test(normalized)) {
    return { kind: "income_expense_totals" };
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
  if (TEXT2SQL_ALLOWED_ROLES.has(auth.role)) {
    return sql;
  }

  throw new AppError("Text2SQL is unavailable for this role", "FORBIDDEN");
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

async function queryFxLatest(limit: number) {
  return prisma.fxRate.findMany({
    where: {
      fromCurrency: "USD",
      toCurrency: "VND",
    },
    orderBy: { rateDate: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      fromCurrency: true,
      toCurrency: true,
      rateDate: true,
      rate: true,
      source: true,
      fetchedAt: true,
    },
  });
}

async function queryFxAverage(currentMonth: boolean) {
  const now = new Date();
  const fromDate = currentMonth ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) : undefined;

  const aggregated = await prisma.fxRate.aggregate({
    where: {
      fromCurrency: "USD",
      toCurrency: "VND",
      ...(fromDate ? { rateDate: { gte: fromDate } } : {}),
    },
    _avg: { rate: true },
  });

  return [
    {
      avg_rate: aggregated._avg.rate ? Number(aggregated._avg.rate.toString()) : null,
      period: currentMonth ? "current_month" : "all_time",
    },
  ];
}

async function queryIncomeExpenseTotals() {
  const grouped = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      status: {
        notIn: ["REJECTED"],
      },
    },
    _sum: {
      amount: true,
    },
  });

  const totalIncome = grouped.find((row) => row.type === "INCOME")?._sum.amount ?? 0;
  const totalExpense = grouped.find((row) => row.type === "EXPENSE")?._sum.amount ?? 0;

  return [
    {
      total_income: Number(totalIncome.toString()),
      total_expense: Number(totalExpense.toString()),
    },
  ];
}

function toCitation(route: NonNullable<ReturnType<typeof buildHeuristicRoute>>) {
  if (route.kind === "fx_latest") {
    return "orm:FxRate.findMany(latest usd-vnd)";
  }

  if (route.kind === "fx_average") {
    return route.currentMonth
      ? "orm:FxRate.aggregate(avg usd-vnd current-month)"
      : "orm:FxRate.aggregate(avg usd-vnd all-time)";
  }

  return "orm:Transaction.groupBy(type,sum amount)";
}

const TEXT2SQL_ALLOWED_ROLES = new Set<string>(["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN"]);

export async function resolveByText2Sql(
  auth: AuthContext,
  message: string,
  options?: { policyKey?: string; dataDomain?: string; scopeApplied?: string },
): Promise<{
  answer: string;
  citations: AiCitation[];
  relatedData: Record<string, unknown>;
}> {
  if (!TEXT2SQL_ALLOWED_ROLES.has(auth.role)) {
    throw new AppError("Text2SQL is unavailable for this role", "FORBIDDEN");
  }

  const cached = await getSqlCache(auth.role, message);
  if (cached) {
    return {
      answer: cached.answer,
      citations: [{ source: "sql-cache", snippet: "recent safe query result" }],
      relatedData: cached.relatedData ?? {},
    };
  }

  const route = buildHeuristicRoute(message);
  if (!route) {
    throw new AppError("Không hỗ trợ truy vấn Text2SQL cho yêu cầu này", "UNPROCESSABLE_ENTITY");
  }

  const rows = route.kind === "fx_latest"
    ? await queryFxLatest(route.limit)
    : route.kind === "fx_average"
      ? await queryFxAverage(route.currentMonth)
      : await queryIncomeExpenseTotals();

  const answer = rows.length === 0
    ? "Không có dữ liệu phù hợp trong phạm vi truy vấn bạn vừa hỏi."
    : route.kind === "fx_latest"
      ? (() => {
        const latest = rows[0] as {
          rate?: number;
          rateDate?: Date;
          fromCurrency?: string;
          toCurrency?: string;
        };
        const rate = Number(latest.rate ?? 0).toLocaleString("vi-VN");
        const date = latest.rateDate ? new Date(latest.rateDate).toLocaleDateString("vi-VN") : "không rõ ngày";
        return `Tỷ giá ${latest.fromCurrency ?? "USD"}/${latest.toCurrency ?? "VND"} mới nhất là ${rate} tại ngày ${date}.`;
      })()
      : route.kind === "fx_average"
        ? (() => {
          const summary = rows[0] as { avg_rate?: number | null; period?: string };
          if (!summary.avg_rate) {
            return "Chưa có dữ liệu tỷ giá để tính trung bình trong phạm vi bạn hỏi.";
          }
          const period = summary.period === "current_month" ? "tháng hiện tại" : "toàn bộ dữ liệu";
          return `Tỷ giá USD/VND trung bình cho ${period} là ${Number(summary.avg_rate).toLocaleString("vi-VN")}.`;
        })()
        : (() => {
          const summary = rows[0] as { total_income?: number; total_expense?: number };
          const totalIncome = Number(summary.total_income ?? 0);
          const totalExpense = Number(summary.total_expense ?? 0);
          const delta = totalIncome - totalExpense;
          return `Tổng thu là ${totalIncome.toLocaleString("vi-VN")} VND, tổng chi là ${totalExpense.toLocaleString("vi-VN")} VND, chênh lệch ${delta.toLocaleString("vi-VN")} VND.`;
        })();

  const relatedData = {
    route: route.kind,
    rows,
    policyKey: options?.policyKey ?? "text2sql-default",
    dataDomain: options?.dataDomain ?? "DATA_RUNTIME",
    scopeApplied: options?.scopeApplied ?? `text2sql-${auth.role.toLowerCase()}`,
  };

  await setSqlCache(auth.role, message, { answer, relatedData });

  return {
    answer,
    citations: [{ source: "text2sql", snippet: toCitation(route) }],
    relatedData,
  };
}
