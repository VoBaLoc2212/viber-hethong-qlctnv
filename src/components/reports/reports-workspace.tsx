"use client";

import { useMemo, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { getRoleLabel, getTransactionStatusLabel, getTransactionTypeLabel } from "@/lib/ui-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ReportsWorkspaceProps = {
  token: string | null;
  currentUser: AuthUser | null;
};

type ReportsResponse = {
  kpis: {
    totalBudget: number;
    totalSpent: number;
    totalIncome: number;
    remainingBalance: number;
    transactionCount: number;
    pendingCount: number;
  };
  monthlySeries: Array<{ month: string; income: number; expenses: number }>;
  recentTransactions: Array<{
    id: string;
    code: string;
    type: "INCOME" | "EXPENSE";
    amount: string;
    date: string;
    status: string;
    description?: string | null;
  }>;
  expenseComposition: Array<{ label: string; value: number }>;
  budgetVsActual: Array<{ label: string; budget: number; actual: number }>;
  cashflowForecastNextMonth: Array<{ period: string; projectedOutflow: number; projectedInflow: number }>;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const PIE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#9333ea", "#dc2626", "#0d9488", "#475569", "#0891b2"];

export function ReportsWorkspace({ token, currentUser }: ReportsWorkspaceProps) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportsResponse | null>(null);

  const expenseCompositionChartData = useMemo(
    () => data?.expenseComposition.filter((row) => row.value > 0) ?? [],
    [data?.expenseComposition],
  );

  const budgetVsActualChartData = useMemo(() => data?.budgetVsActual ?? [], [data?.budgetVsActual]);

  const cashflowForecastChartData = useMemo(() => data?.cashflowForecastNextMonth ?? [], [data?.cashflowForecastNextMonth]);

  async function loadReports(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (fromDate) query.set("fromDate", fromDate);
      if (toDate) query.set("toDate", toDate);
      if (departmentId) query.set("departmentId", departmentId);

      const suffix = query.toString() ? `?${query.toString()}` : "";
      const payload = await apiRequest<ReportsResponse>(`/api/reports${suffix}`, { token });
      setData(payload);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Không tải được dữ liệu báo cáo";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Báo cáo & Phân tích</CardTitle>
          <CardDescription>Báo cáo tổng hợp theo kỳ, phòng ban và trạng thái giao dịch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Vai trò hiện tại:</span>
            <Badge variant="outline">{getRoleLabel(currentUser?.role)}</Badge>
          </div>

          {!token ? (
            <Alert>
              <AlertDescription>Vui lòng đăng nhập để sử dụng mô-đun báo cáo.</AlertDescription>
            </Alert>
          ) : null}

          <form className="grid grid-cols-1 gap-4 md:grid-cols-4" onSubmit={loadReports}>
            <div className="space-y-2">
              <Label htmlFor="report-from-date">Từ ngày</Label>
              <Input id="report-from-date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-to-date">Đến ngày</Label>
              <Input id="report-to-date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-department-id">ID phòng ban</Label>
              <Input
                id="report-department-id"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={!token || loading} className="w-full">
                {loading ? "Đang tải..." : "Tải báo cáo"}
              </Button>
            </div>
          </form>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Tổng ngân sách</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(data.kpis.totalBudget)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Tổng chi</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(data.kpis.totalSpent)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Tổng thu</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(data.kpis.totalIncome)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Số dư còn lại</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(data.kpis.remainingBalance)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Giao dịch</CardDescription>
                <CardTitle className="text-2xl">{data.kpis.transactionCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Chờ phê duyệt</CardDescription>
                <CardTitle className="text-2xl">{data.kpis.pendingCount}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Biểu đồ tròn cơ cấu chi phí</CardTitle>
                <CardDescription>Tỷ trọng chi phí theo nhóm danh mục.</CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                {expenseCompositionChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseCompositionChartData}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={92}
                        labelLine={false}
                      >
                        {expenseCompositionChartData.map((entry, index) => (
                          <Cell key={`${entry.label}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatMoney(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Chưa có dữ liệu cơ cấu chi phí.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>So sánh Kế hoạch vs Thực tế</CardTitle>
                <CardDescription>Kế hoạch theo ngân sách và chi thực tế theo từng kỳ.</CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                {budgetVsActualChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={budgetVsActualChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${Math.round(val / 1_000_000)}M`} />
                      <Tooltip formatter={(value: number) => formatMoney(value)} />
                      <Legend />
                      <Bar dataKey="budget" name="Kế hoạch" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Thực tế" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Chưa có dữ liệu so sánh ngân sách.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Dự báo dòng tiền tháng sau</CardTitle>
              <CardDescription>Dự báo từ các khoản chi/thu định kỳ đang kích hoạt.</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              {cashflowForecastChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashflowForecastChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${Math.round(val / 1_000_000)}M`} />
                    <Tooltip formatter={(value: number) => formatMoney(value)} />
                    <Legend />
                    <Bar dataKey="projectedInflow" name="Dự thu" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="projectedOutflow" name="Dự chi" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Chưa có dữ liệu dự báo tháng sau.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Thu - Chi theo tháng (6 kỳ gần nhất)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tháng</TableHead>
                    <TableHead>Thu</TableHead>
                    <TableHead>Chi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.monthlySeries.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell>{row.month}</TableCell>
                      <TableCell>{formatMoney(row.income)}</TableCell>
                      <TableCell>{formatMoney(row.expenses)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Giao dịch gần đây</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Số tiền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Mô tả</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.code}</TableCell>
                      <TableCell>{getTransactionTypeLabel(tx.type)}</TableCell>
                      <TableCell>{formatMoney(Number(tx.amount))}</TableCell>
                      <TableCell>{getTransactionStatusLabel(tx.status)}</TableCell>
                      <TableCell>{new Date(tx.date).toLocaleString("vi-VN")}</TableCell>
                      <TableCell>{tx.description ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}
