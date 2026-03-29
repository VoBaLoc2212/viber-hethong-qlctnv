import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ApprovalsPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Phê duyệt</h1>
        <p className="text-muted-foreground mt-1">Quản lý phê duyệt giao dịch và ngân sách.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Hàng đợi phê duyệt</CardTitle>
          <CardDescription>Giao diện bảng phê duyệt đang được đồng bộ theo bộ thành phần giao diện.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Hiện tại bạn có thể theo dõi số liệu tại Tổng quan và Báo cáo.</p>
        </CardContent>
      </Card>
    </main>
  );
}
