"use client";

import { useState } from "react";

import { apiRequest } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

export function ReportsWorkspace({ token, currentUser }: ReportsWorkspaceProps) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportsResponse | null>(null);

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
          <CardTitle>Reports & Analytics</CardTitle>
          <CardDescription>Báo cáo tổng hợp theo kỳ, phòng ban và trạng thái giao dịch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Current role:</span>
            <Badge variant="outline">{currentUser?.role ?? "N/A"}</Badge>
          </div>

          {!token ? (
            <Alert>
              <AlertDescription>Vui lòng đăng nhập để sử dụng module báo cáo.</AlertDescription>
            </Alert>
          ) : null}

          <form className="grid grid-cols-1 gap-4 md:grid-cols-4" onSubmit={loadReports}>
            <div className="space-y-2">
              <Label htmlFor="report-from-date">From Date</Label>
              <Input id="report-from-date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-to-date">To Date</Label>
              <Input id="report-to-date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-department-id">Department ID</Label>
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
                <CardDescription>Total Budget</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(data.kpis.totalBudget)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Total Spent</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(data.kpis.totalSpent)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Total Income</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(data.kpis.totalIncome)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Remaining Balance</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(data.kpis.remainingBalance)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Transactions</CardDescription>
                <CardTitle className="text-2xl">{data.kpis.transactionCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Pending Approvals</CardDescription>
                <CardTitle className="text-2xl">{data.kpis.pendingCount}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Monthly Income vs Expense (6 kỳ gần nhất)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Income</TableHead>
                    <TableHead>Expense</TableHead>
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
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.code}</TableCell>
                      <TableCell>{tx.type}</TableCell>
                      <TableCell>{tx.amount}</TableCell>
                      <TableCell>{tx.status}</TableCell>
                      <TableCell>{new Date(tx.date).toLocaleString()}</TableCell>
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
