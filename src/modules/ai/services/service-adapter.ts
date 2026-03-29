import { prisma } from "@/lib/db/prisma/client";
import type { AuthContext } from "@/modules/shared";
import { getReportsOverview } from "@/modules/report";
import { listTransactions } from "@/modules/transaction";
import { listBudgets } from "@/modules/budgeting";
import { listApprovals } from "@/modules/approval";
import { listLogs } from "@/modules/security";
import { AppError } from "@/modules/shared/errors/app-error";

import type { AiIntent, AiResolution } from "../types";

const REPORT_ROLES = ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"] as const;
const SERVICE_DATA_PATTERN = /chi phí|ngân sách|giao dịch|expense|income|approval|phê duyệt|phòng ban|department|báo cáo|report|doanh thu|fx|tỷ giá|usd|vnd|q[1-4]|quý|tháng|năm|kpi|danh mục|audit|log|nhật ký|tổng thu|tổng chi|tổng ngân sách|số dư|doanh số|thu hiện tại|chi hiện tại/i;
const KPI_SUMMARY_PATTERN = /tổng ngân sách|tổng chi|tổng thu|số dư|còn lại hiện tại|kpi hiện tại/i;

function canUseReport(auth: AuthContext) {
  return REPORT_ROLES.includes(auth.role as (typeof REPORT_ROLES)[number]);
}

async function tryService<T>(runner: () => Promise<T>): Promise<T | null> {
  try {
    return await runner();
  } catch (error) {
    if (error instanceof AppError && (error.code === "FORBIDDEN" || error.code === "UNAUTHORIZED")) {
      return null;
    }

    throw error;
  }
}

function parseQuarter(message: string): { year: number; quarter: number }[] {
  const normalized = message.toUpperCase();
  const yearMatch = normalized.match(/20\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();

  const found = [...normalized.matchAll(/Q([1-4])/g)].map((item) => Number(item[1]));
  return found.map((quarter) => ({ year, quarter }));
}

function monthRangeFromQuarter(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const fromDate = new Date(Date.UTC(year, startMonth, 1));
  const toDate = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59));
  return { fromDate: fromDate.toISOString(), toDate: toDate.toISOString() };
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function tokenizeSearchText(value: string) {
  return normalizeSearchText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

export async function resolveByService(auth: AuthContext, intent: AiIntent, message: string): Promise<AiResolution | null> {
  const text = message.toLowerCase();

  const isServiceDataQuestion = SERVICE_DATA_PATTERN.test(message);
  if (intent === "QUERY" && !isServiceDataQuestion) {
    return null;
  }

  if (intent === "GREETING") {
    return {
      intent,
      routeUsed: "SERVICE",
      rawAnswer: "Chào bạn! Mình có thể hỗ trợ truy vấn chi phí, phân tích ngân sách, dự báo, cảnh báo và hướng dẫn thao tác.",
      citations: [{ source: "ai-assistant", snippet: "greeting-intent" }],
      suggestedActions: ["Thử: Chi phí tháng 1 của phòng Marketing?", "Thử: So sánh chi phí Q1 vs Q2"],
    };
  }

  if (intent === "GUIDANCE") {
    return null;
  }

  if (intent === "ALERT" || text.includes("vượt ngân sách")) {
    const budgets = await tryService(() => listBudgets(auth, { page: 1, limit: 50 }));
    if (!budgets) return null;

    const warnings = budgets.data
      .map((item) => ({
        ...item,
        percentageUsed: Number(item.amount) > 0 ? (Number(item.used) / Number(item.amount)) * 100 : 0,
      }))
      .filter((item) => item.percentageUsed >= 80)
      .sort((a, b) => b.percentageUsed - a.percentageUsed);

    return {
      intent,
      routeUsed: "SERVICE",
      rawAnswer:
        warnings.length > 0
          ? `Có ${warnings.length} ngân sách đang chạm ngưỡng cảnh báo >=80%. Mức cao nhất hiện tại là ${warnings[0].percentageUsed.toFixed(2)}%.`
          : "Hiện chưa có ngân sách nào chạm ngưỡng cảnh báo 80%.",
      citations: [{ source: "budget-service", snippet: "get budget list + usage ratio" }],
      relatedData: { warnings },
      suggestedActions: warnings.length > 0 ? ["Rà soát các giao dịch chi lớn", "Cân nhắc chuyển ngân sách"] : ["Tiếp tục theo dõi theo tuần"],
    };
  }

  if (intent === "FORECAST" && canUseReport(auth)) {
    const overview = await tryService(() => getReportsOverview(auth, {}));
    if (!overview) return null;

    const forecast = overview.cashflowForecastNextMonth;
    const projectedOutflow = forecast.reduce((acc, row) => acc + row.projectedOutflow, 0);

    return {
      intent,
      routeUsed: "SERVICE",
      rawAnswer: `Dự báo tháng tới: tổng chi khoảng ${projectedOutflow.toLocaleString("vi-VN")} VND (dựa trên recurring transactions).`,
      citations: [{ source: "report-service", snippet: "cashflowForecastNextMonth" }],
      relatedData: { forecast },
      suggestedActions: ["Xem chi tiết theo từng tuần", "Chủ động điều chỉnh hạn mức ngân sách"],
    };
  }

  if ((KPI_SUMMARY_PATTERN.test(message) || /tổng\s*chi|tổng\s*thu|total\s*expense|total\s*income/i.test(message) || ((intent === "QUERY" || intent === "ANALYSIS") && /thu.*chi|chi.*thu/i.test(message))) && canUseReport(auth)) {
    const overview = await tryService(() => getReportsOverview(auth, {}));
    if (!overview) return null;

    const wantsBudget = /tổng ngân sách|ngân sách hiện tại|budget/i.test(message);
    const wantsRemaining = /số dư|còn lại|remaining|balance/i.test(message);

    const answer = wantsBudget || wantsRemaining
      ? `Tổng ngân sách hiện tại: ${overview.kpis.totalBudget.toLocaleString("vi-VN")} VND; tổng chi hiện tại: ${overview.kpis.totalSpent.toLocaleString("vi-VN")} VND; tổng thu hiện tại: ${overview.kpis.totalIncome.toLocaleString("vi-VN")} VND; số dư còn lại: ${overview.kpis.remainingBalance.toLocaleString("vi-VN")} VND.`
      : `Tổng chi hiện tại: ${overview.kpis.totalSpent.toLocaleString("vi-VN")} VND; tổng thu hiện tại: ${overview.kpis.totalIncome.toLocaleString("vi-VN")} VND.`;

    return {
      intent,
      routeUsed: "SERVICE",
      rawAnswer: answer,
      citations: [{ source: "report-service", snippet: "overview.kpis totalBudget + totalSpent + totalIncome + remainingBalance" }],
      relatedData: {
        totalBudget: overview.kpis.totalBudget,
        totalSpent: overview.kpis.totalSpent,
        totalIncome: overview.kpis.totalIncome,
        remainingBalance: overview.kpis.remainingBalance,
      },
      suggestedActions: ["Xem thêm theo từng tháng", "Lọc theo phòng ban để đối chiếu"],
    };
  }

  if (intent === "ANALYSIS" && canUseReport(auth)) {
    if (/top danh mục|xếp hạng danh mục|top category/i.test(message)) {
      const overview = await tryService(() => getReportsOverview(auth, {}));
      if (!overview) return null;

      const top = [...overview.expenseComposition].sort((a, b) => b.value - a.value).slice(0, 5);
      const summary = top.length
        ? top.map((row, index) => `${index + 1}. ${row.label}: ${row.value.toLocaleString("vi-VN")} VND`).join("; ")
        : "Chưa có dữ liệu danh mục chi phí.";

      return {
        intent,
        routeUsed: "SERVICE",
        rawAnswer: `Top danh mục chi phí: ${summary}`,
        citations: [{ source: "report-service", snippet: "expenseComposition top categories" }],
        relatedData: { topCategories: top },
        suggestedActions: ["Lọc theo phòng ban để xem chi tiết", "So sánh top danh mục theo từng tháng"],
      };
    }

    if (/q[1-4].*q[1-4]|quý/i.test(message)) {
      const quarters = parseQuarter(message);
      if (quarters.length >= 2) {
        const q1 = quarters[0];
        const q2 = quarters[1];

        const range1 = monthRangeFromQuarter(q1.year, q1.quarter);
        const range2 = monthRangeFromQuarter(q2.year, q2.quarter);

        const [ov1, ov2] = await Promise.all([
          getReportsOverview(auth, range1),
          getReportsOverview(auth, range2),
        ]);

        const delta = ov2.kpis.totalSpent - ov1.kpis.totalSpent;
        return {
          intent,
          routeUsed: "SERVICE",
          rawAnswer: `Tổng chi Q${q1.quarter}/${q1.year}: ${ov1.kpis.totalSpent.toLocaleString("vi-VN")} VND; Q${q2.quarter}/${q2.year}: ${ov2.kpis.totalSpent.toLocaleString("vi-VN")} VND. Chênh lệch ${delta >= 0 ? "tăng" : "giảm"} ${Math.abs(delta).toLocaleString("vi-VN")} VND.`,
          citations: [{ source: "report-service", snippet: "quarter comparison by date ranges" }],
          relatedData: {
            quarterA: { quarter: q1, totalSpent: ov1.kpis.totalSpent },
            quarterB: { quarter: q2, totalSpent: ov2.kpis.totalSpent },
          },
          suggestedActions: ["So sánh thêm theo phòng ban", "Xem top danh mục biến động giữa 2 quý"],
        };
      }
    }

    const overview = await tryService(() => getReportsOverview(auth, {}));
    if (!overview) return null;

    const monthly = overview.monthlySeries;
    const latest = monthly.at(-1);
    const prev = monthly.at(-2);

    if (!latest || !prev) {
      return {
        intent,
        routeUsed: "SERVICE",
        rawAnswer: "Chưa đủ dữ liệu để so sánh 2 kỳ gần nhất.",
        citations: [{ source: "report-service", snippet: "monthlySeries" }],
        relatedData: { monthly },
        suggestedActions: ["Mở rộng khoảng thời gian báo cáo"],
      };
    }

    const delta = latest.expenses - prev.expenses;

    return {
      intent,
      routeUsed: "SERVICE",
      rawAnswer: `Chi phí kỳ gần nhất ${delta >= 0 ? "tăng" : "giảm"} ${Math.abs(delta).toLocaleString("vi-VN")} so với kỳ trước.`,
      citations: [{ source: "report-service", snippet: "monthlySeries latest vs previous" }],
      relatedData: { latest, previous: prev },
      suggestedActions: ["Xem phân rã theo danh mục", "Kiểm tra top giao dịch lớn"],
    };
  }

  if (text.includes("ngân sách") || text.includes("budget") || /chi phí tháng\s*\d+/i.test(message)) {
    const budgets = await tryService(() => listBudgets(auth, { page: 1, limit: 200 }));
    if (!budgets) return null;

    const lower = message.toLowerCase();
    const monthMatch = lower.match(/tháng\s*(\d{1,2})/i);

    let filtered = budgets.data;
    let matchedPeriod: string | null = null;
    let matchedDepartment: { id: string; name: string; code: string; budgetAllocated: number } | null = null;

    if (monthMatch) {
      const month = Number(monthMatch[1]);
      if (month >= 1 && month <= 12) {
        const year = new Date().getFullYear();
        matchedPeriod = `${year}-${String(month).padStart(2, "0")}`;
        filtered = filtered.filter((item) => item.period === matchedPeriod);
      }
    }

    const departments = await prisma.department.findMany({
      select: { id: true, name: true, code: true, budgetAllocated: true },
    });

    const normalizedMessage = normalizeSearchText(message);
    const messageTokens = tokenizeSearchText(message);

    const selected = departments.find((department) => {
      const normalizedName = normalizeSearchText(department.name);
      const normalizedCode = normalizeSearchText(department.code);

      if (normalizedMessage.includes(normalizedName)) return true;
      if (normalizedMessage.includes(normalizedCode)) return true;

      return messageTokens.some((token) => token.length >= 2 && (normalizedName.includes(token) || normalizedCode === token));
    });

    if (selected) {
      matchedDepartment = {
        id: selected.id,
        name: selected.name,
        code: selected.code,
        budgetAllocated: Number(selected.budgetAllocated.toString()),
      };
      filtered = filtered.filter((item) => item.departmentId === selected.id);
    }

    const isRemainingQuestion = /còn bao nhiêu|còn lại|remaining|available/i.test(message);

    const budgetTotals = filtered.reduce(
      (acc, item) => ({
        amount: acc.amount + Number(item.amount),
        used: acc.used + Number(item.used),
        reserved: acc.reserved + Number(item.reserved),
      }),
      { amount: 0, used: 0, reserved: 0 },
    );

    let totalAmount = budgetTotals.amount;
    let totalUsed = budgetTotals.used;
    let totalReserved = budgetTotals.reserved;

    if (matchedDepartment) {
      const txRows = await prisma.transaction.findMany({
        where: {
          departmentId: matchedDepartment.id,
          type: "EXPENSE",
          status: { not: "REJECTED" },
        },
        select: { amount: true },
      });

      const spentByTransactions = txRows.reduce((sum, row) => sum + Number(row.amount.toString()), 0);
      totalAmount = matchedDepartment.budgetAllocated;
      totalUsed = spentByTransactions;
      totalReserved = 0;
    }

    const totalAvailable = totalAmount - totalUsed - totalReserved;

    const summary = isRemainingQuestion
      ? `Ngân sách còn lại hiện tại: ${totalAvailable.toLocaleString("vi-VN")} VND (đã dùng: ${totalUsed.toLocaleString("vi-VN")}, reserved: ${totalReserved.toLocaleString("vi-VN")}).`
      : `Tổng ngân sách: ${totalAmount.toLocaleString("vi-VN")} VND; đã dùng: ${totalUsed.toLocaleString("vi-VN")} VND; còn lại: ${totalAvailable.toLocaleString("vi-VN")} VND.`;

    const scopeParts: string[] = [];
    if (matchedDepartment) {
      scopeParts.push(`phòng ban ${matchedDepartment.name} (${matchedDepartment.code})`);
    }
    if (matchedPeriod) {
      scopeParts.push(`kỳ ${matchedPeriod}`);
    }
    const scopeText = scopeParts.length ? ` Phạm vi lọc: ${scopeParts.join(", ")}.` : " Phạm vi lọc: tất cả phòng ban và kỳ ngân sách.";

    return {
      intent,
      routeUsed: "SERVICE",
      rawAnswer: filtered.length > 0 || matchedDepartment ? `${summary}${scopeText}` : `Không tìm thấy ngân sách phù hợp với điều kiện bạn hỏi.${scopeText}`,
      citations: [{ source: "budget-service", snippet: matchedDepartment ? "department allocation + expense transactions" : "listBudgets aggregated by filter" }],
      relatedData: {
        budgets: filtered,
        scope: { matchedPeriod, matchedDepartment },
        totals: { totalAmount, totalUsed, totalReserved, totalAvailable },
      },
      suggestedActions: ["Thêm kỳ tháng hoặc phòng ban để lọc chính xác hơn"],
    };
  }

  if (text.includes("phê duyệt") || text.includes("approval")) {
    const approvals = await tryService(() => listApprovals(auth, { page: 1, limit: 20, status: "PENDING" }));
    if (!approvals) return null;

    return {
      intent,
      routeUsed: "SERVICE",
      rawAnswer: `Hiện có ${approvals.meta.total} yêu cầu phê duyệt đang chờ xử lý.`,
      citations: [{ source: "approval-service", snippet: "list pending approvals" }],
      relatedData: { approvals: approvals.data },
      suggestedActions: ["Ưu tiên xử lý yêu cầu quá hạn"],
    };
  }

  if (text.includes("giao dịch") || text.includes("expense") || text.includes("income")) {
    const transactions = await tryService(() => listTransactions(auth, { page: 1, limit: 10 }));
    if (!transactions) return null;

    return {
      intent,
      routeUsed: "SERVICE",
      rawAnswer:
        transactions.meta.total > 0
          ? `Tìm thấy ${transactions.meta.total} giao dịch liên quan.`
          : "Chưa tìm thấy giao dịch khớp từ khóa. Bạn có thể thêm phòng ban, tháng hoặc mã giao dịch để lọc tốt hơn.",
      citations: [{ source: "transaction-service", snippet: "listTransactions with keyword" }],
      relatedData: { transactions: transactions.data },
      suggestedActions: ["Lọc theo khoảng thời gian", "Lọc theo phòng ban/ngân sách"],
    };
  }

  if (text.includes("nhật ký") || text.includes("audit") || text.includes("log")) {
    const logs = await tryService(() => listLogs(auth, { page: 1, limit: 10 }));
    if (!logs) return null;

    return {
      intent,
      routeUsed: "SERVICE",
      rawAnswer: `Đã truy xuất ${logs.data.length} bản ghi nhật ký gần nhất.`,
      citations: [{ source: "log-service", snippet: "listLogs latest records" }],
      relatedData: { logs: logs.data },
      suggestedActions: ["Lọc theo entityType", "Lọc theo thời gian"],
    };
  }

  return null;
}
