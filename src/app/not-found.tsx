import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-svh w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold">404 Không tìm thấy trang</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Có thể bạn chưa thêm trang này vào bộ định tuyến.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
