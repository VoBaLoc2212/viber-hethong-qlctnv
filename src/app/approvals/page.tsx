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
  PENDING: { label: "Ch\u1EDD duy\u1EC7t", variant: "secondary" },
  APPROVED: { label: "\u0110\u00E3 duy\u1EC7t", variant: "default" },
  REJECTED: { label: "T\u1EEB ch\u1ED1i", variant: "destructive" },
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
          <CheckCircle2 className="w-3 h-3" /> Duy\u1EC7t
        </Button>
        <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => onAction(item, "reject")}>
          <XCircle className="w-3 h-3" /> T\u1EEB ch\u1ED1i
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
          <Ban className="w-3 h-3" /> Kh\u00F4ng chi
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
        toast({ title: "Th\u00E0nh c\u00F4ng", description: "\u0110\u00E3 c\u1EADp nh\u1EADt tr\u1EA1ng th\u00E1i phi\u1EBFu." });
        setActionDialog(null);
        setNote("");
      },
      onError: (err: Error) => {
        toast({ title: "L\u1ED7i", description: err.message, variant: "destructive" });
      },
    },
  });

  if (!currentUser || (currentUser.role !== "MANAGER" && currentUser.role !== "ACCOUNTANT")) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-muted-foreground">
          B\u1EA1n kh\u00F4ng c\u00F3 quy\u1EC1n truy c\u1EADp trang n\u00E0y.
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
    approve: "Duy\u1EC7t",
    reject: "Kh\u00F4ng duy\u1EC7t",
    execute: "Chi",
    "not-execute": "Kh\u00F4ng chi",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Quy tr\u00ECnh Duy\u1EC7t chi
        </h1>
        <p className="text-muted-foreground mt-1">
          Phi\u1EBFu c\u1EA7n x\u1EED l\u00FD v\u00E0 l\u1ECBch s\u1EED phi\u1EBFu \u0111\u00E3 duy\u1EC7t
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">T\u1EA5t c\u1EA3</TabsTrigger>
          <TabsTrigger value="pending">Ch\u1EDD duy\u1EC7t</TabsTrigger>
          <TabsTrigger value="approved">\u0110\u00E3 duy\u1EC7t</TabsTrigger>
          <TabsTrigger value="rejected">T\u1EEB ch\u1ED1i</TabsTrigger>
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
              Kh\u00F4ng c\u00F3 phi\u1EBFu n\u00E0o.
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>M\u00E3 GD</TableHead>
                    <TableHead>M\u00F4 t\u1EA3</TableHead>
                    <TableHead className="text-right">S\u1ED1 ti\u1EC1n</TableHead>
                    <TableHead>Tr\u1EA1ng th\u00E1i GD</TableHead>
                    <TableHead>Tr\u1EA1ng th\u00E1i duy\u1EC7t</TableHead>
                    <TableHead>Ng\u01B0\u1EDDi duy\u1EC7t</TableHead>
                    <TableHead>Ng\u00E0y t\u1EA1o</TableHead>
                    <TableHead className="text-right">H\u00E0nh \u0111\u1ED9ng</TableHead>
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
              {actionDialog && actionLabels[actionDialog.action]} phi\u1EBFu{" "}
              {actionDialog?.item.transactionCode}
            </DialogTitle>
            <DialogDescription>
              S\u1ED1 ti\u1EC1n: {actionDialog && formatCurrency(actionDialog.item.transactionAmount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ghi ch\u00FA</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nh\u1EADp ghi ch\u00FA (kh\u00F4ng b\u1EAFt bu\u1ED9c)..."
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              H\u1EE7y
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
