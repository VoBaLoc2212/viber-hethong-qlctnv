import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TransactionsPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground mt-1">Danh sách giao dịch sẽ hiển thị tại đây.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Transaction Workspace</CardTitle>
          <CardDescription>Đang chuẩn bị giao diện chi tiết cho module Transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Bạn có thể tiếp tục dùng Dashboard và Budgets trong lúc hoàn thiện module này.</p>
        </CardContent>
      </Card>
    </main>
  );
}
