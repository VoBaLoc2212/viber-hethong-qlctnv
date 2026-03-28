export default function ReimbursementPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Hoàn ứng</h1>
          <p className="text-muted-foreground mt-1">Màn hình giao diện (chưa có xử lý nghiệp vụ).</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
            Coming soon
          </span>
          <p className="text-sm font-medium text-foreground">Danh sách yêu cầu hoàn ứng</p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Khu vực này sẽ hiển thị danh sách phiếu hoàn ứng, trạng thái, và các bước xử lý.
        </p>
      </div>
    </div>
  );
}
