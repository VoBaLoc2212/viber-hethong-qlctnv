"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import {
  Plus,
  Send,
  CheckCircle2,
  XCircle,
  Eye,
  Pencil,
  Trash2,
  Banknote,
  Ban,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  useGetCurrentUser,
  useGetApprovals,
  useCreateApproval,
  useUpdateApproval,
  useDeleteApproval,
  useApprovalAction,
  useGetDepartments,
  useGetUsers,
  useBudgetAvailable,
  type ApprovalRequest,
  type ApprovalRequestStatus,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

// ─── Status badge helpers ───

const STATUS_CONFIG: Record<ApprovalRequestStatus, { label: string }> = {
  NOT_YET: { label: "Chưa gửi" },
  PENDING: { label: "Chờ duyệt" },
  APPROVED: { label: "Đã duyệt" },
  NOT_APPROVED: { label: "Không duyệt" },
  EXECUTE: { label: "Đã chi" },
  NOT_EXECUTE: { label: "Không chi" },
};

function StatusBadge({ status }: { status: ApprovalRequestStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status };
  const colorMap: Record<string, string> = {
    NOT_YET: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    APPROVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    NOT_APPROVED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    EXECUTE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    NOT_EXECUTE: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[status] ?? ""}`}>
      {cfg.label}
    </span>
  );
}

// ─── Form schemas ───

const createFormSchema = z.object({
  title: z.string().min(3, "Tiêu đề ít nhất 3 ký tự"),
  description: z.string().optional(),
  amount: z.coerce.number().positive("Số tiền phải > 0"),
  departmentId: z.coerce.number().optional(),
});

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);

/** Format number with dot separator for display: 10000 → "10.000" */
const formatDotNumber = (val: number | string): string => {
  const num = typeof val === "string" ? parseFloat(val.replace(/\./g, "")) : val;
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("vi-VN").format(num);
};

/** Parse dot-separated string back to number: "10.000" → 10000 */
const parseDotNumber = (val: string): number => {
  return parseFloat(val.replace(/\./g, "")) || 0;
};

/** Controlled amount input with dot formatting */
function AmountInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(value ? formatDotNumber(value) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    if (raw === "") {
      setDisplay("");
      onChange(0);
      return;
    }
    const num = parseInt(raw, 10);
    setDisplay(formatDotNumber(num));
    onChange(num);
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      className={className}
      placeholder={placeholder ?? "0"}
    />
  );
}

// ─── Main Page ───

export default function ApprovalsPage() {
  const { data: currentUser, isLoading: isLoadingUser } = useGetCurrentUser();
  const isManager = currentUser?.role === "MANAGER";
  const isAccountant = currentUser?.role === "ACCOUNTANT";

  if (isLoadingUser) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Quy trình Duyệt chi
        </h1>
        <p className="text-muted-foreground mt-1">
          Quản lý phiếu yêu cầu chi — Đang đăng nhập:{" "}
          <span className="font-medium text-foreground">{currentUser?.fullName}</span>{" "}
          <Badge variant="outline" className="ml-1">{currentUser?.role}</Badge>
        </p>
      </div>

      <Tabs defaultValue="my" className="w-full">
        <TabsList>
          <TabsTrigger value="my" className="gap-1.5">
            <FileText className="w-4 h-4" />
            Phiếu yêu cầu chi
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="approve" className="gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Duyệt phiếu
            </TabsTrigger>
          )}
          {isAccountant && (
            <TabsTrigger value="execute" className="gap-1.5">
              <Banknote className="w-4 h-4" />
              Chi theo phiếu yêu cầu
            </TabsTrigger>
          )}
        </TabsList>

        {/* ─── Tab 1: Phiếu của tôi (mọi role) ─── */}
        <TabsContent value="my">
          <MyApprovalsTab />
        </TabsContent>

        {/* ─── Tab 2: Manager duyệt ─── */}
        {isManager && (
          <TabsContent value="approve">
            <ManagerApproveTab />
          </TabsContent>
        )}

        {/* ─── Tab 3: Accountant chi ─── */}
        {isAccountant && (
          <TabsContent value="execute">
            <AccountantExecuteTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: Phiếu yêu cầu chi của tôi
// ═══════════════════════════════════════════════════════════════

function MyApprovalsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useGetCurrentUser();
  const { data: approvals, isLoading } = useGetApprovals({ tab: "my" });
  const { data: departments } = useGetDepartments();
  const { data: accountants } = useGetUsers("ACCOUNTANT");
  const isManager = currentUser?.role === "MANAGER";

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ApprovalRequest | null>(null);
  const [viewItem, setViewItem] = useState<ApprovalRequest | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ApprovalRequest | null>(null);
  const [submitConfirmItem, setSubmitConfirmItem] = useState<ApprovalRequest | null>(null);

  // Manager "Tạo, gửi và duyệt" state
  const [managerApproveAccountantId, setManagerApproveAccountantId] = useState<string>("");
  const [isSubmittingCreateAndApprove, setIsSubmittingCreateAndApprove] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const createMutation = useCreateApproval({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Thành công", description: "Phiếu yêu cầu chi đã được tạo" });
        setIsCreateOpen(false);
        createForm.reset();
      },
      onError: (err) => toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateApproval({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Thành công", description: "Đã cập nhật phiếu" });
        setEditItem(null);
      },
      onError: (err) => toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteApproval({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Đã xóa", description: "Phiếu đã được xóa" });
        setDeleteConfirmItem(null);
      },
      onError: (err) => toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
    },
  });

  const submitMutation = useApprovalAction({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Đã gửi duyệt", description: "Phiếu đã chuyển sang trạng thái chờ duyệt" });
        setSubmitConfirmItem(null);
      },
      onError: (err) => toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
    },
  });

  // Mutation for "Tạo và gửi" (create then submit)
  const createAndSubmitMutation = useCreateApproval({
    mutation: {
      onSuccess: (created) => {
        // Step 2: immediately submit
        submitAfterCreateMutation.mutate({ id: created.id, data: { action: "submit" } });
      },
      onError: (err) => toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
    },
  });

  const submitAfterCreateMutation = useApprovalAction({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Thành công", description: "Phiếu đã được tạo và gửi duyệt" });
        setIsCreateOpen(false);
        createForm.reset();
      },
      onError: (err) => toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
    },
  });

  // Mutation chain for "Tạo, gửi và duyệt" (Manager only)
  const createForApproveMutation = useCreateApproval({
    mutation: {
      onSuccess: (created) => {
        submitForApproveMutation.mutate({ id: created.id, data: { action: "submit" } });
      },
      onError: (err) => {
        setIsSubmittingCreateAndApprove(false);
        toast({ title: "Lỗi", description: err.message, variant: "destructive" });
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

  const createForm = useForm<z.infer<typeof createFormSchema>>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { title: "", description: "", amount: 0 },
  });

  // Watch departmentId để hiển thị available budget
  const selectedDepartmentId = createForm.watch("departmentId");
  const { data: budgetData } = useBudgetAvailable(
    { departmentId: selectedDepartmentId },
  );

  const editForm = useForm<z.infer<typeof createFormSchema>>({
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
    (values: z.infer<typeof createFormSchema>) => {
      createAndSubmitMutation.mutate({ data: values });
    },
    [createAndSubmitMutation],
  );

  const handleCreateSubmitAndApprove = useCallback(
    (values: z.infer<typeof createFormSchema>) => {
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

// ═══════════════════════════════════════════════════════════════
// TAB 2: Manager duyệt phiếu
// ═══════════════════════════════════════════════════════════════

function ManagerApproveTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: approvals, isLoading } = useGetApprovals({ tab: "approve" });
  const { data: accountants } = useGetUsers("ACCOUNTANT");

  const [viewItem, setViewItem] = useState<ApprovalRequest | null>(null);
  const [approveItem, setApproveItem] = useState<ApprovalRequest | null>(null);
  const [rejectItem, setRejectItem] = useState<ApprovalRequest | null>(null);

  const [selectedAccountantId, setSelectedAccountantId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const actionMutation = useApprovalAction({
    mutation: {
      onSuccess: (data) => {
        invalidate();
        if (data.status === "APPROVED") {
          toast({ title: "Đã duyệt", description: `Phiếu ${data.requestCode} đã được duyệt` });
          setApproveItem(null);
        } else {
          toast({ title: "Không duyệt", description: `Phiếu ${data.requestCode} đã bị từ chối` });
          setRejectItem(null);
        }
        setSelectedAccountantId("");
        setRejectionReason("");
      },
      onError: (err) => toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Phiếu chờ duyệt và lịch sử phiếu đã xử lý
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : !approvals?.length ? (
        <Card className="p-8 text-center text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
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
                <th className="text-left p-3 font-medium">Phòng ban</th>
                <th className="text-right p-3 font-medium">Số tiền</th>
                <th className="text-center p-3 font-medium">Trạng thái</th>
                <th className="text-left p-3 font-medium">Ngày gửi</th>
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
                  <td className="p-3 text-muted-foreground">{item.departmentName ?? "—"}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                  <td className="p-3 text-center"><StatusBadge status={item.status} /></td>
                  <td className="p-3 text-muted-foreground">
                    {item.submittedAt ? format(new Date(item.submittedAt), "dd/MM/yyyy HH:mm") : "—"}
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {item.status === "PENDING" ? (
                        <>
                          <Button
                            size="sm"
                            className="gap-1 h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => { setApproveItem(item); setSelectedAccountantId(""); }}
                          >
                            <CheckCircle2 className="w-3 h-3" /> Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1 h-7 text-xs"
                            onClick={() => { setRejectItem(item); setRejectionReason(""); }}
                          >
                            <XCircle className="w-3 h-3" /> Không duyệt
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

      {/* ─── Popup Duyệt → chọn kế toán ─── */}
      <Dialog open={!!approveItem} onOpenChange={(open) => !open && setApproveItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kế toán chi</DialogTitle>
            <DialogDescription>
              Chọn kế toán thực hiện chi cho phiếu &quot;{approveItem?.title}&quot;
              <br />Số tiền: <strong>{approveItem && formatCurrency(approveItem.amount)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kế toán *</Label>
              <Select value={selectedAccountantId} onValueChange={setSelectedAccountantId}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveItem(null)}>Hủy</Button>
            <Button
              disabled={!selectedAccountantId || actionMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              onClick={() =>
                approveItem &&
                actionMutation.mutate({
                  id: approveItem.id,
                  data: { action: "approve", accountantId: Number(selectedAccountantId) },
                })
              }
            >
              {actionMutation.isPending ? "Đang xử lý..." : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Popup Không duyệt → nhập lý do ─── */}
      <Dialog open={!!rejectItem} onOpenChange={(open) => !open && setRejectItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lý do không duyệt</DialogTitle>
            <DialogDescription>
              Phiếu: {rejectItem?.requestCode} — &quot;{rejectItem?.title}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lý do *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Nhập lý do không duyệt..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectItem(null)}>Hủy</Button>
            <Button
              variant="destructive"
              disabled={!rejectionReason.trim() || actionMutation.isPending}
              onClick={() =>
                rejectItem &&
                actionMutation.mutate({
                  id: rejectItem.id,
                  data: { action: "reject", rejectionReason: rejectionReason.trim() },
                })
              }
            >
              {actionMutation.isPending ? "Đang xử lý..." : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog xem chi tiết (readonly) ─── */}
      <ApprovalDetailDialog item={viewItem} onClose={() => setViewItem(null)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: Accountant chi theo phiếu
// ═══════════════════════════════════════════════════════════════

function AccountantExecuteTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: approvals, isLoading } = useGetApprovals({ tab: "execute" });

  const [viewItem, setViewItem] = useState<ApprovalRequest | null>(null);
  const [executeItem, setExecuteItem] = useState<ApprovalRequest | null>(null);
  const [notExecuteItem, setNotExecuteItem] = useState<ApprovalRequest | null>(null);

  const [executedAmount, setExecutedAmount] = useState<string>("");
  const [notExecuteReason, setNotExecuteReason] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const actionMutation = useApprovalAction({
    mutation: {
      onSuccess: (data) => {
        invalidate();
        if (data.status === "EXECUTE") {
          toast({ title: "Đã chi", description: `Phiếu ${data.requestCode} đã được chi thành công` });
          setExecuteItem(null);
        } else {
          toast({ title: "Không chi", description: `Phiếu ${data.requestCode} đã bị từ chối chi` });
          setNotExecuteItem(null);
        }
        setExecutedAmount("");
        setNotExecuteReason("");
      },
      onError: (err) => toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
    },
  });

  const openExecuteDialog = (item: ApprovalRequest) => {
    setExecuteItem(item);
    setExecutedAmount(String(item.amount));
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
            <div className="space-y-2 p-4 bg-primary/5 rounded-xl border-2 border-primary/20">
              <Label className="text-primary text-xs uppercase tracking-wide">Số tiền chi</Label>
              <AmountInput
                value={parseDotNumber(executedAmount)}
                onChange={(val) => setExecutedAmount(String(val))}
                className="text-lg font-bold border-primary/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecuteItem(null)}>Hủy</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={!executedAmount || parseDotNumber(executedAmount) <= 0 || actionMutation.isPending}
              onClick={() =>
                executeItem &&
                actionMutation.mutate({
                  id: executeItem.id,
                  data: { action: "execute", executedAmount: parseDotNumber(executedAmount) },
                })
              }
            >
              {actionMutation.isPending ? "Đang xử lý..." : "Xác nhận chi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Popup Không chi → xác nhận + lý do ─── */}
      <Dialog open={!!notExecuteItem} onOpenChange={(open) => !open && setNotExecuteItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bạn xác nhận không muốn chi?</DialogTitle>
            <DialogDescription>
              Phiếu: {notExecuteItem?.requestCode} — &quot;{notExecuteItem?.title}&quot;
              <br />Số tiền: <strong>{notExecuteItem && formatCurrency(notExecuteItem.amount)}</strong>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotExecuteItem(null)}>Hủy</Button>
            <Button
              variant="destructive"
              disabled={!notExecuteReason.trim() || actionMutation.isPending}
              onClick={() =>
                notExecuteItem &&
                actionMutation.mutate({
                  id: notExecuteItem.id,
                  data: { action: "not-execute", notExecuteReason: notExecuteReason.trim() },
                })
              }
            >
              {actionMutation.isPending ? "Đang xử lý..." : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog xem chi tiết (readonly) ─── */}
      <ApprovalDetailDialog item={viewItem} onClose={() => setViewItem(null)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared: Dialog xem chi tiết phiếu (readonly)
// ═══════════════════════════════════════════════════════════════

function ApprovalDetailDialog({
  item,
  onClose,
}: {
  item: ApprovalRequest | null;
  onClose: () => void;
}) {
  if (!item) return null;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Mã phiếu", value: <span className="font-mono">{item.requestCode}</span> },
    { label: "Tiêu đề", value: item.title },
    { label: "Mô tả", value: item.description || "—" },
    { label: "Số tiền yêu cầu", value: <span className="font-bold">{formatCurrency(item.amount)}</span> },
    { label: "Phòng ban", value: item.departmentName ?? "—" },
    { label: "Trạng thái", value: <StatusBadge status={item.status} /> },
    { label: "Người yêu cầu", value: item.requesterName },
    { label: "Ngày tạo", value: format(new Date(item.createdAt), "dd/MM/yyyy HH:mm") },
  ];

  if (item.submittedAt) {
    rows.push({ label: "Ngày gửi duyệt", value: format(new Date(item.submittedAt), "dd/MM/yyyy HH:mm") });
  }
  if (item.approverName) {
    rows.push({ label: "Người duyệt", value: item.approverName });
  }
  if (item.approvedAt) {
    rows.push({ label: "Ngày duyệt", value: format(new Date(item.approvedAt), "dd/MM/yyyy HH:mm") });
  }
  if (item.rejectionReason) {
    rows.push({ label: "Lý do không duyệt", value: <span className="text-destructive">{item.rejectionReason}</span> });
  }
  if (item.accountantName) {
    rows.push({ label: "Kế toán chi", value: item.accountantName });
  }
  if (item.executedAmount != null) {
    rows.push({ label: "Số tiền đã chi", value: <span className="font-bold text-green-600">{formatCurrency(item.executedAmount)}</span> });
  }
  if (item.executedAt) {
    rows.push({ label: "Ngày chi", value: format(new Date(item.executedAt), "dd/MM/yyyy HH:mm") });
  }
  if (item.notExecuteReason) {
    rows.push({ label: "Lý do không chi", value: <span className="text-destructive">{item.notExecuteReason}</span> });
  }

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chi tiết phiếu yêu cầu chi</DialogTitle>
          <DialogDescription>{item.requestCode}</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border/50">
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between items-start py-2.5 gap-4">
              <span className="text-sm text-muted-foreground shrink-0">{r.label}</span>
              <span className="text-sm text-right">{r.value}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
