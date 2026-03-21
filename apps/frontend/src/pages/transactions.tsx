import { useState } from "react";
import { format } from "date-fns";
import { Plus, Filter, FileText, CheckCircle2, XCircle, Clock, Receipt } from "lucide-react";
import { useGetTransactions, useCreateTransaction, useGetDepartments, useUpdateTransactionStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().min(3, "Description too short"),
  departmentId: z.coerce.number().optional(),
  date: z.string().min(1, "Date is required"),
});

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetTransactions({
    page,
    limit: 15,
    ...(statusFilter !== "ALL" && { status: statusFilter as any }),
    ...(typeFilter !== "ALL" && { type: typeFilter as any })
  });

  const { data: departments } = useGetDepartments();
  const createMutation = useCreateTransaction({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
        toast({ title: "Transaction Created", description: "The transaction has been successfully recorded." });
        setIsModalOpen(false);
        form.reset();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to create transaction", variant: "destructive" });
      }
    }
  });

  const updateStatusMutation = useUpdateTransactionStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        toast({ title: "Status Updated" });
      }
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "EXPENSE",
      amount: 0,
      description: "",
      date: new Date().toISOString().split('T')[0],
    }
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate({ 
      data: {
        ...values,
        date: new Date(values.date).toISOString(),
        status: "PENDING"
      }
    });
  };

  const handleStatusChange = (id: number, status: "PENDING" | "APPROVED" | "REJECTED") => {
    updateStatusMutation.mutate({ id, data: { status } });
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Transactions</h1>
          <p className="text-muted-foreground mt-1">Manage and track your business transactions.</p>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">
              <Plus className="w-4 h-4" /> New Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] border-border/50 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Create Transaction</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select onValueChange={(v) => form.setValue("type", v as any)} defaultValue={form.getValues("type")}>
                    <SelectTrigger className="border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXPENSE">Expense</SelectItem>
                      <SelectItem value="INCOME">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" {...form.register("amount")} className="border-border/50" />
                  {form.formState.errors.amount && <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="Office supplies..." {...form.register("description")} className="border-border/50" />
                {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select onValueChange={(v) => form.setValue("departmentId", parseInt(v))}>
                    <SelectTrigger className="border-border/50"><SelectValue placeholder="Select dept" /></SelectTrigger>
                    <SelectContent>
                      {departments?.map(d => (
                        <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" {...form.register("date")} className="border-border/50" />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save Transaction"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-wrap gap-3 bg-secondary/20">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filters:</span>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-card"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="INCOME">Income</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-muted-foreground border-b border-border/50">
              <tr>
                <th className="h-10 px-4 font-medium">Date & Code</th>
                <th className="h-10 px-4 font-medium">Description</th>
                <th className="h-10 px-4 font-medium text-right">Amount</th>
                <th className="h-10 px-4 font-medium">Department</th>
                <th className="h-10 px-4 font-medium">Status</th>
                <th className="h-10 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="p-4"><Skeleton className="h-4 w-24 mb-1" /><Skeleton className="h-3 w-16" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-48" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="p-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                    <td className="p-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-8 w-8 rounded-md ml-auto" /></td>
                  </tr>
                ))
              ) : data?.data && data.data.length > 0 ? (
                data.data.map((tx) => (
                  <tr key={tx.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="p-4 align-top">
                      <div className="font-medium text-foreground">{format(new Date(tx.date), "MMM dd, yyyy")}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{tx.transactionCode}</div>
                    </td>
                    <td className="p-4 align-top max-w-[300px]">
                      <div className="flex items-start gap-2">
                        {tx.type === 'INCOME' ? 
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 uppercase text-[9px] shrink-0 mt-0.5 tracking-wider">In</Badge> : 
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 uppercase text-[9px] shrink-0 mt-0.5 tracking-wider">Out</Badge>
                        }
                        <span className="truncate" title={tx.description || ""}>{tx.description || "-"}</span>
                      </div>
                    </td>
                    <td className={`p-4 align-top text-right font-semibold ${tx.type === 'INCOME' ? 'text-green-600 dark:text-green-500' : 'text-foreground'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                    <td className="p-4 align-top text-muted-foreground">
                      {tx.departmentName || "-"}
                    </td>
                    <td className="p-4 align-top">
                      <Badge variant="outline" className={`
                        ${tx.status === 'APPROVED' ? 'border-green-200 text-green-700 bg-green-50' : ''}
                        ${tx.status === 'REJECTED' ? 'border-red-200 text-red-700 bg-red-50' : ''}
                        ${tx.status === 'PENDING' ? 'border-yellow-200 text-yellow-700 bg-yellow-50' : ''}
                      `}>
                        {tx.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {tx.status === 'REJECTED' && <XCircle className="w-3 h-3 mr-1" />}
                        {tx.status === 'PENDING' && <Clock className="w-3 h-3 mr-1" />}
                        {tx.status}
                      </Badge>
                    </td>
                    <td className="p-4 align-top text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="sr-only">Open menu</span>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(tx.id, 'APPROVED')} disabled={tx.status === 'APPROVED'}>
                            <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(tx.id, 'REJECTED')} disabled={tx.status === 'REJECTED'}>
                            <XCircle className="w-4 h-4 mr-2 text-red-600" /> Reject
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(tx.id, 'PENDING')} disabled={tx.status === 'PENDING'}>
                            <Clock className="w-4 h-4 mr-2 text-yellow-600" /> Mark Pending
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Receipt className="w-12 h-12 mb-3 text-muted-foreground/30" />
                      <p>No transactions found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {data && data.total > 15 && (
          <div className="p-4 border-t border-border/50 flex items-center justify-between bg-card text-sm">
            <span className="text-muted-foreground">Showing page {page}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 15 >= data.total}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
