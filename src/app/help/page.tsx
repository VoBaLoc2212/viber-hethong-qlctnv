import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const QUICK_LINKS = [
  { href: "/dashboard", label: "Tổng quan", description: "Theo dõi KPI và biến động tài chính gần đây." },
  { href: "/transactions", label: "Giao dịch", description: "Tra cứu, lọc và theo dõi giao dịch theo mã/mô tả." },
  { href: "/budgeting", label: "Điều phối ngân sách", description: "Tạo, cập nhật và chuyển ngân sách giữa các quỹ." },
  { href: "/budgets", label: "Ngân sách", description: "Theo dõi ngân sách theo phòng ban và mức sử dụng." },
  { href: "/security", label: "Bảo mật & Nhật ký", description: "Theo dõi nhật ký kiểm toán và bút toán sổ cái." },
];

export default function HelpPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trung tâm hỗ trợ</h1>
        <p className="mt-1 text-muted-foreground">Hướng dẫn nhanh để sử dụng các mô-đun chính trong hệ thống.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Bắt đầu nhanh</CardTitle>
          <CardDescription>Chọn khu vực bạn muốn thao tác để mở ngay chức năng tương ứng.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map((item) => (
            <div key={item.href} className="rounded-lg border border-border/50 p-4">
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
              <Button asChild className="mt-3" size="sm" variant="outline">
                <Link href={item.href}>Mở {item.label}</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Mẹo sử dụng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Bạn có thể tìm nhanh giao dịch từ thanh tìm kiếm ở đầu trang.</p>
          <p>• Nút chuông hiển thị số lượng giao dịch chờ phê duyệt và giao dịch mới nhất.</p>
          <p>• Quyền truy cập từng module phụ thuộc vào vai trò tài khoản hiện tại.</p>
        </CardContent>
      </Card>
    </main>
  );
}
