"use client";

import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Activity,
} from "lucide-react";
import {
  useGetDashboardKpis,
  useGetDepartments,
  useGetExpensesByMonth,
  useGetTransactions,
} from "@/lib/api-client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { formatVnd, getTransactionStatusBadgeClass, getTransactionStatusLabel, getTransactionTypeLabel } from "@/lib/ui-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const { data: kpis, isLoading: isLoadingKpis } = useGetDashboardKpis({
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
  const { data: monthlyData, isLoading: isLoadingChart } = useGetExpensesByMonth({
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
  const { data: departments } = useGetDepartments({
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  const { data: recentTransactions, isLoading: isLoadingTxs } = useGetTransactions(
    { limit: 5, page: 1 },
    {
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    },
  );

  const formatCurrency = (val: number) => formatVnd(val);

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tổng quan</h1>
        <p className="text-muted-foreground mt-1">Đây là tóm tắt tình hình tài chính hiện tại.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Tổng ngân sách" value={kpis?.totalBudget} icon={<Wallet className="w-5 h-5" />} loading={isLoadingKpis} />
        <KpiCard title="Tổng chi" value={kpis?.totalSpent} icon={<ArrowDownRight className="w-5 h-5 text-destructive" />} loading={isLoadingKpis} valueClass="text-destructive" />
        <KpiCard title="Số dư còn lại" value={kpis?.remainingBalance} icon={<DollarSign className="w-5 h-5 text-primary" />} loading={isLoadingKpis} />
        <KpiCard title="Tổng thu" value={kpis?.totalIncome} icon={<ArrowUpRight className="w-5 h-5 text-green-500" />} loading={isLoadingKpis} valueClass="text-green-600 dark:text-green-500" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Dòng tiền (6 tháng gần nhất)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] px-2 sm:h-[350px] sm:px-6">
            {isLoadingChart ? (
              <Skeleton className="w-full h-full rounded-xl" />
            ) : monthlyData && monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                  <YAxis
                    width={56}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(val) => `${Math.round(val / 1000)}k ₫`}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--secondary))" }}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />
                  <Bar dataKey="income" name="Thu" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expenses" name="Chi" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground flex-col">
                <p>Không có dữ liệu biểu đồ</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 flex flex-col">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-lg font-semibold">Giao dịch gần đây</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            {isLoadingTxs ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : recentTransactions?.data && recentTransactions.data.length > 0 ? (
              <div className="divide-y divide-border/50">
                {recentTransactions.data.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === "INCOME" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                        {tx.type === "INCOME" ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm line-clamp-1">{tx.description || tx.transactionCode}</p>
                        <p className="text-xs text-muted-foreground">
                          {getTransactionTypeLabel(tx.type)} • {format(new Date(tx.date), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold text-sm ${tx.type === "INCOME" ? "text-green-600 dark:text-green-500" : "text-foreground"}`}>
                        {tx.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </p>
                      <Badge variant="outline" className={`mt-1 text-[10px] ${getTransactionStatusBadgeClass(tx.status)}`}>
                        {getTransactionStatusLabel(tx.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">Không có giao dịch gần đây.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Ngân sách phòng ban</CardTitle>
        </CardHeader>
        <CardContent>
          {!departments || departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có dữ liệu phòng ban.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Phòng ban</th>
                    <th className="py-2 pr-3">Mã</th>
                    <th className="py-2 text-right">Ngân sách phân bổ</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <tr key={department.id} className="border-b border-border/40">
                      <td className="py-2 pr-3 font-medium">{department.name}</td>
                      <td className="py-2 pr-3">{department.code}</td>
                      <td className="py-2 text-right">{formatVnd(department.budgetAllocated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  loading,
  valueClass = "",
}: {
  title: string;
  value?: number;
  icon: React.ReactNode;
  loading: boolean;
  valueClass?: string;
}) {
  return (
    <Card className="shadow-sm border-border/50 hover-elevate group">
      <CardContent className="p-6 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="p-2 rounded-lg bg-secondary/50 group-hover:bg-primary/10 transition-colors">{icon}</div>
        </div>
        <div>
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <h3 className={`text-3xl font-bold tracking-tight ${valueClass}`}>{formatVnd(value ?? 0)}</h3>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

