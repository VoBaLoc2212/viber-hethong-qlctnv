"use client";

import { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Banknote, Ban, Loader2 } from "lucide-react";
import {
  useGetCurrentUser,
  useGetApprovals,
  useApprovalAction,
  type ApprovalItem,
  type ApprovalStatus,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

// --- Status helpers ---

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Cho duyet", variant: "secondary" },
  APPROVED: { label: "Da duyet", variant: "default" },
  REJECTED: { label: "Tu choi", variant: "destructive" },
};

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
}

// --- Main page ---

export default function ApprovalsPage() {
  const { data: currentUser, isLoading: userLoading } = useGetCurrentUser();
  const [tab, setTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const statusFilter = tab === "all" ? undefined : (tab.toUpperCase() as ApprovalStatus);
  const { data: approvals, isLoading } = useGetApprovals(
    { status: statusFilter },
    { enabled: !!currentUser },
  );
  const [actionDialog, setActionDialog] = useState<{
    item: ApprovalItem;
    action: "approve" | "reject" | "execute" | "not-execute";
  } | null>(null);
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const actionMutation = useApprovalAction({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/approvals"] });
        toast({ title: "Thanh cong", description: "Da cap nhat trang thai phieu." });
        setActionDialog(null);
        setNote("");
      },
      onError: (err) => {
        toast({ title: "Loi", description: err.message, variant: "destructive" });
      },
    },
  });

  const submitForApproveMutation = useApprovalAction({
    mutation: {
      onSuccess: (submitted) => {
        approveAfterCreateMutation.mutate({
          id: submitted.id,
          data: { action: "approve", accountantId: Number(managerApproveAccountantId) },
        });
      },
      onError: (err) => {
        setIsSubmittingCreateAndApprove(false);
        toast({ title: "Lỗi", description: err.message, variant: "destructive" });
      },
    },
  });

  const approveAfterCreateMutation = useApprovalAction({
    mutation: {
      onSuccess: () => {
        setIsSubmittingCreateAndApprove(false);
        invalidate();
        toast({ title: "Thành công", description: "Phiếu đã được tạo, gửi và duyệt!" });
        setIsCreateOpen(false);
        setManagerApproveAccountantId("");
        createForm.reset();
      },
      onError: (err) => {
        setIsSubmittingCreateAndApprove(false);
        toast({ title: "Lỗi", description: err.message, variant: "destructive" });
      },
    },
  });

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { title: "", description: "", amount: 0 },
  });

  // Watch departmentId để hiển thị available budget
  const selectedDepartmentId = createForm.watch("departmentId");
  const { data: budgetData } = useBudgetAvailable(
    { departmentId: selectedDepartmentId },
  );

  const editForm = useForm<CreateFormValues>({
    resolver: zodResolver(createFormSchema),
  });

  const onOpenEdit = (item: ApprovalRequest) => {
    setEditItem(item);
    editForm.reset({
      title: item.title,
      description: item.description ?? "",
      amount: item.amount,
      departmentId: item.departmentId ?? undefined,
    });
  };

  const handleCreateAndSubmit = useCallback(
    (values: CreateFormValues) => {
      createAndSubmitMutation.mutate({ data: values });
    },
    [createAndSubmitMutation],
  );

  const handleCreateSubmitAndApprove = useCallback(
    (values: CreateFormValues) => {
      if (!managerApproveAccountantId) {
        toast({ title: "Lỗi", description: "Vui lòng chọn kế toán chi", variant: "destructive" });
        return;
      }
      setIsSubmittingCreateAndApprove(true);
      createForApproveMutation.mutate({ data: values });
    },
    [createForApproveMutation, managerApproveAccountantId, toast],
  );

  const isAnyCreatePending =
    createMutation.isPending ||
    createAndSubmitMutation.isPending ||
    submitAfterCreateMutation.isPending ||
    isSubmittingCreateAndApprove;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Danh sách phiếu yêu cầu chi của bạn
        </p>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Tạo phiếu yêu cầu chi
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : !approvals?.length ? (
        <Card className="p-8 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Bạn chưa có phiếu yêu cầu chi nào</p>
        </Card>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Mã phiếu</th>
                <th className="text-left p-3 font-medium">Tiêu đề</th>
                <th className="text-left p-3 font-medium">Phòng ban</th>
                <th className="text-right p-3 font-medium">Số tiền</th>
                <th className="text-center p-3 font-medium">Trạng thái</th>
                <th className="text-left p-3 font-medium">Ngày tạo</th>
                <th className="text-center p-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {approvals.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => setViewItem(item)}
                >
                  <td className="p-3 font-mono text-xs">{item.requestCode}</td>
                  <td className="p-3 font-medium">{item.title}</td>
                  <td className="p-3 text-muted-foreground">{item.departmentName ?? "—"}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                  <td className="p-3 text-center"><StatusBadge status={item.status} /></td>
                  <td className="p-3 text-muted-foreground">{format(new Date(item.createdAt), "dd/MM/yyyy")}</td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {item.status === "NOT_YET" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7 text-xs"
                            onClick={() => setSubmitConfirmItem(item)}
                          >
                            <Send className="w-3 h-3" /> Gửi duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => onOpenEdit(item)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmItem(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {item.status !== "NOT_YET" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setViewItem(item)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Xác nhận xóa ─── */}
      <AlertDialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Xác nhận xóa phiếu
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa phiếu &quot;{deleteConfirmItem?.title}&quot; ({deleteConfirmItem?.requestCode})?
              <br />Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmItem && deleteMutation.mutate({ id: deleteConfirmItem.id })}
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xác nhận xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Xác nhận gửi duyệt ─── */}
      <AlertDialog open={!!submitConfirmItem} onOpenChange={(open) => !open && setSubmitConfirmItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Xác nhận gửi duyệt
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn gửi phiếu &quot;{submitConfirmItem?.title}&quot; ({submitConfirmItem?.requestCode}) đi duyệt?
              <br />Số tiền: <strong>{submitConfirmItem && formatCurrency(submitConfirmItem.amount)}</strong>
              <br />Sau khi gửi, bạn sẽ không thể chỉnh sửa hoặc xóa phiếu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => submitConfirmItem && submitMutation.mutate({ id: submitConfirmItem.id, data: { action: "submit" } })}
            >
              {submitMutation.isPending ? "Đang gửi..." : "Xác nhận gửi duyệt"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Dialog tạo phiếu ─── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo phiếu yêu cầu chi</DialogTitle>
            <DialogDescription>Nhập thông tin phiếu yêu cầu chi mới</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit((values) =>
              createMutation.mutate({ data: values }),
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Tiêu đề *</Label>
              <Input {...createForm.register("title")} placeholder="VD: Thanh toán đơn hàng #123" />
              {createForm.formState.errors.title && (
                <p className="text-xs text-destructive">{createForm.formState.errors.title.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea {...createForm.register("description")} placeholder="Mô tả chi tiết..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Số tiền (VND) *</Label>
              <AmountInput
                value={createForm.watch("amount")}
                onChange={(val) => createForm.setValue("amount", val, { shouldValidate: true })}
                placeholder="VD: 10.000.000"
              />
              {createForm.formState.errors.amount && (
                <p className="text-xs text-destructive">{createForm.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Phòng ban</Label>
              <Select
                onValueChange={(v) => createForm.setValue("departmentId", Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="Chọn phòng ban" /></SelectTrigger>
                <SelectContent>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Hiển thị ngân sách khả dụng */}
              {budgetData && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-md border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                      Ngân sách khả dụng:
                    </span>
                    <span className={`font-bold ${budgetData.available >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {budgetData.available.toLocaleString("vi-VN")} VND
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-emerald-600/80 dark:text-emerald-400/80 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Tổng ngân sách:</span>
                      <span>{budgetData.amount.toLocaleString("vi-VN")} VND</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Đã giữ chỗ:</span>
                      <span>{budgetData.reserved.toLocaleString("vi-VN")} VND</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Đã chi:</span>
                      <span>{budgetData.used.toLocaleString("vi-VN")} VND</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Manager: chọn kế toán cho "Tạo, gửi và duyệt" */}
            {isManager && (
              <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <Label className="text-xs text-blue-700 dark:text-blue-300">Kế toán chi (dùng cho &quot;Tạo, gửi và duyệt&quot;)</Label>
                <Select value={managerApproveAccountantId} onValueChange={setManagerApproveAccountantId}>
                  <SelectTrigger><SelectValue placeholder="Chọn kế toán chi" /></SelectTrigger>
                  <SelectContent>
                    {accountants?.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.fullName} ({acc.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={isAnyCreatePending}>
                {createMutation.isPending ? "Đang tạo..." : "Tạo phiếu"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isAnyCreatePending}
                onClick={createForm.handleSubmit(handleCreateAndSubmit)}
              >
                {createAndSubmitMutation.isPending || submitAfterCreateMutation.isPending
                  ? "Đang xử lý..."
                  : "Tạo và gửi duyệt"}
              </Button>
              {isManager && (
                <Button
                  type="button"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={isAnyCreatePending || !managerApproveAccountantId}
                  onClick={createForm.handleSubmit(handleCreateSubmitAndApprove)}
                >
                  {isSubmittingCreateAndApprove ? "Đang xử lý..." : "Tạo, gửi và duyệt"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog sửa phiếu ─── */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa phiếu yêu cầu chi</DialogTitle>
            <DialogDescription>Chỉnh sửa thông tin phiếu ({editItem?.requestCode})</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((values) =>
              editItem && updateMutation.mutate({ id: editItem.id, data: values }),
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Tiêu đề *</Label>
              <Input {...editForm.register("title")} />
              {editForm.formState.errors.title && (
                <p className="text-xs text-destructive">{editForm.formState.errors.title.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea {...editForm.register("description")} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Số tiền (VND) *</Label>
              <AmountInput
                value={editForm.watch("amount")}
                onChange={(val) => editForm.setValue("amount", val, { shouldValidate: true })}
              />
              {editForm.formState.errors.amount && (
                <p className="text-xs text-destructive">{editForm.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Phòng ban</Label>
              <Select
                defaultValue={editItem?.departmentId ? String(editItem.departmentId) : undefined}
                onValueChange={(v) => editForm.setValue("departmentId", Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="Chọn phòng ban" /></SelectTrigger>
                <SelectContent>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditItem(null)}>Hủy</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog xem chi tiết ─── */}
      <ApprovalDetailDialog item={viewItem} onClose={() => setViewItem(null)} />
    </div>
  );
}

  if (!currentUser || (currentUser.role !== "MANAGER" && currentUser.role !== "ACCOUNTANT")) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-muted-foreground">
          Ban khong co quyen truy cap trang nay.
        </Card>
      </div>
    );
  }

  const isManager = currentUser.role === "MANAGER";
  const isAccountant = currentUser.role === "ACCOUNTANT";

  function handleOpenAction(item: ApprovalItem, action: "approve" | "reject" | "execute" | "not-execute") {
    setActionDialog({ item, action });
    setNote("");
  }

  function handleConfirmAction() {
    if (!actionDialog) return;
    actionMutation.mutate({
      id: actionDialog.item.id,
      data: { action: actionDialog.action, note: note || undefined },
    });
  }

  const actionLabels: Record<string, string> = {
    approve: "Duyet",
    reject: "Khong duyet",
    execute: "Chi",
    "not-execute": "Khong chi",
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Phiếu cần chi và lịch sử phiếu đã xử lý
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : !approvals?.length ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Banknote className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Không có phiếu nào</p>
        </Card>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Mã phiếu</th>
                <th className="text-left p-3 font-medium">Tiêu đề</th>
                <th className="text-left p-3 font-medium">Người yêu cầu</th>
                <th className="text-left p-3 font-medium">Duyệt bởi</th>
                <th className="text-right p-3 font-medium">Số tiền</th>
                <th className="text-center p-3 font-medium">Trạng thái</th>
                <th className="text-left p-3 font-medium">Ngày duyệt</th>
                <th className="text-center p-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {approvals.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => setViewItem(item)}
                >
                  <td className="p-3 font-mono text-xs">{item.requestCode}</td>
                  <td className="p-3 font-medium">{item.title}</td>
                  <td className="p-3 text-muted-foreground">{item.requesterName}</td>
                  <td className="p-3 text-muted-foreground">{item.approverName ?? "—"}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                  <td className="p-3 text-center"><StatusBadge status={item.status} /></td>
                  <td className="p-3 text-muted-foreground">
                    {item.approvedAt ? format(new Date(item.approvedAt), "dd/MM/yyyy HH:mm") : "—"}
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {item.status === "APPROVED" ? (
                        <>
                          <Button
                            size="sm"
                            className="gap-1 h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => openExecuteDialog(item)}
                          >
                            <Banknote className="w-3 h-3" /> Chi
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1 h-7 text-xs"
                            onClick={() => { setNotExecuteItem(item); setNotExecuteReason(""); }}
                          >
                            <Ban className="w-3 h-3" /> Không chi
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setViewItem(item)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Popup Chi → so sánh số tiền ─── */}
      <Dialog open={!!executeItem} onOpenChange={(open) => !open && setExecuteItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Xác nhận chi</DialogTitle>
            <DialogDescription>
              Phiếu: {executeItem?.requestCode} — &quot;{executeItem?.title}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2 p-4 bg-muted/50 rounded-xl">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Số tiền yêu cầu</Label>
              <p className="text-2xl font-bold text-foreground">
                {executeItem && formatDotNumber(executeItem.amount)} ₫
              </p>
            </div>
          ) : !approvals || approvals.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Khong co phieu nao.
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ma GD</TableHead>
                    <TableHead>Mo ta</TableHead>
                    <TableHead className="text-right">So tien</TableHead>
                    <TableHead>Trang thai GD</TableHead>
                    <TableHead>Trang thai duyet</TableHead>
                    <TableHead>Nguoi duyet</TableHead>
                    <TableHead>Ngay tao</TableHead>
                    <TableHead className="text-right">Hanh dong</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.transactionCode}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.transactionDescription || "\u2014"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.transactionAmount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.transactionStatus}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell>{item.approver?.fullName ?? "\u2014"}</TableCell>
                      <TableCell className="text-xs">{format(new Date(item.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell className="text-right">
                        <ActionButtons
                          item={item}
                          isManager={isManager}
                          isAccountant={isAccountant}
                          onAction={handleOpenAction}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Action confirmation dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog && actionLabels[actionDialog.action]} phieu {actionDialog?.item.transactionCode}
            </DialogTitle>
            <DialogDescription>
              So tien: {actionDialog && formatCurrency(actionDialog.item.transactionAmount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lý do không chi *</Label>
              <Textarea
                value={notExecuteReason}
                onChange={(e) => setNotExecuteReason(e.target.value)}
                placeholder="Nhập lý do không chi..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Huy
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={actionMutation.isPending}
              variant={
                actionDialog?.action === "reject" || actionDialog?.action === "not-execute"
                  ? "destructive"
                  : "default"
              }
            >
              {actionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionDialog && actionLabels[actionDialog.action]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Action buttons per row ---

function ActionButtons({
  item,
  isManager,
  isAccountant,
  onAction,
}: {
  item: ApprovalItem;
  isManager: boolean;
  isAccountant: boolean;
  onAction: (item: ApprovalItem, action: "approve" | "reject" | "execute" | "not-execute") => void;
}) {
  // Manager can approve/reject PENDING items
  if (isManager && item.status === "PENDING") {
    return (
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="default" onClick={() => onAction(item, "approve")}>
          <CheckCircle2 className="h-4 w-4 mr-1" /> Duyet
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onAction(item, "reject")}>
          <XCircle className="h-4 w-4 mr-1" /> Tu choi
        </Button>
      </div>
    );
  }

  // Accountant can execute/not-execute APPROVED items
  if (isAccountant && item.status === "APPROVED") {
    return (
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="default" onClick={() => onAction(item, "execute")}>
          <Banknote className="h-4 w-4 mr-1" /> Chi
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onAction(item, "not-execute")}>
          <Ban className="h-4 w-4 mr-1" /> Khong chi
        </Button>
      </div>
    );
  }

  return <span className="text-xs text-muted-foreground">\u2014</span>;
}
