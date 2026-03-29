"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Banknote, Ban, Loader2 } from "lucide-react";
import {
  useGetApprovals,
  useApprovalAction,
  type ApprovalItem,
  type ApprovalStatus,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/components/auth-session-provider";

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

const STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
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
  if (isManager && item.status === "PENDING") {
    return (
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="default" className="gap-1 h-7 text-xs" onClick={() => onAction(item, "approve")}>
          <CheckCircle2 className="w-3 h-3" /> Duyet
        </Button>
        <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => onAction(item, "reject")}>
          <XCircle className="w-3 h-3" /> Tu choi
        </Button>
      </div>
    );
  }
  if (isAccountant && item.status === "APPROVED") {
    return (
      <div className="flex gap-1 justify-end">
        <Button size="sm" className="gap-1 h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => onAction(item, "execute")}>
          <Banknote className="w-3 h-3" /> Chi
        </Button>
        <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => onAction(item, "not-execute")}>
          <Ban className="w-3 h-3" /> Khong chi
        </Button>
      </div>
    );
  }
  return null;
}

// --- Main page ---

export default function ApprovalsPage() {
  const { currentUser } = useAuthSession();
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
        Phieu can xu ly va lich su phieu da duyet
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">Tat ca</TabsTrigger>
          <TabsTrigger value="pending">Cho duyet</TabsTrigger>
          <TabsTrigger value="approved">Da duyet</TabsTrigger>
          <TabsTrigger value="rejected">Tu choi</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
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
                      <TableCell className="max-w-[200px] truncate">
                        {item.transactionDescription || "\u2014"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.transactionAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.transactionStatus}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell>{item.approver?.fullName ?? "\u2014"}</TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm")}
                      </TableCell>
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
              {actionDialog && actionLabels[actionDialog.action]} phieu{" "}
              {actionDialog?.item.transactionCode}
            </DialogTitle>
            <DialogDescription>
              So tien: {actionDialog && formatCurrency(actionDialog.item.transactionAmount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ghi chu</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhap ghi chu (khong bat buoc)..."
              rows={3}
            />
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
