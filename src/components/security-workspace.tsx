"use client";

import { useState } from "react";

import {
  apiCreateReversal,
  apiDeleteUser,
  apiListLedger,
  apiListLogs,
  apiListUsers,
  apiRegisterUser,
  apiUpdateUser,
} from "@/lib/api";
import type { AuditLogItem, AuthUser, LedgerEntryItem } from "@/lib/api";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SecurityWorkspaceProps = {
  token: string | null;
  currentUser: AuthUser | null;
};

type UserRole = "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";

function generateIdempotencyKey(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function SecurityWorkspace({ token, currentUser }: SecurityWorkspaceProps) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    role: "EMPLOYEE" as UserRole,
  });

  const [updateForm, setUpdateForm] = useState({
    id: "",
    username: "",
    fullName: "",
    email: "",
    role: "EMPLOYEE" as UserRole,
    isActive: true,
  });

  const [deleteUserId, setDeleteUserId] = useState("");
  const [logFilter, setLogFilter] = useState({
    entityType: "",
    entityId: "",
    userId: "",
    fromDate: "",
    toDate: "",
  });

  const [ledgerFilter, setLedgerFilter] = useState({
    referenceType: "",
    referenceId: "",
    reversalTargetId: "",
    reversalReason: "",
  });

  async function reloadAllData() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [usersPayload, logsPayload, ledgerPayload] = await Promise.all([
        apiListUsers(token),
        apiListLogs(token),
        apiListLedger(token),
      ]);

      setUsers(usersPayload.users);
      setLogs(logsPayload.logs);
      setLedgerEntries(ledgerPayload.entries);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Không tải được dữ liệu security";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setError(null);

    try {
      await apiRegisterUser(token, registerForm);
      setRegisterForm({
        username: "",
        password: "",
        fullName: "",
        email: "",
        role: "EMPLOYEE",
      });
      await reloadAllData();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Đăng ký user thất bại";
      setError(message);
    }
  }

  async function handleUpdateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !updateForm.id) return;

    setError(null);

    try {
      await apiUpdateUser(token, updateForm.id, {
        username: updateForm.username || undefined,
        fullName: updateForm.fullName || undefined,
        email: updateForm.email || undefined,
        role: updateForm.role,
        isActive: updateForm.isActive,
      });

      await reloadAllData();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Cập nhật user thất bại";
      setError(message);
    }
  }

  async function handleDeleteUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !deleteUserId) return;

    setError(null);

    try {
      await apiDeleteUser(token, deleteUserId);
      setDeleteUserId("");
      await reloadAllData();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Xóa user thất bại";
      setError(message);
    }
  }

  async function handleFilterLogs(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setError(null);

    try {
      const payload = await apiListLogs(token, {
        entityType: logFilter.entityType || undefined,
        entityId: logFilter.entityId || undefined,
        userId: logFilter.userId || undefined,
        fromDate: logFilter.fromDate || undefined,
        toDate: logFilter.toDate || undefined,
      });

      setLogs(payload.logs);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Lọc logs thất bại";
      setError(message);
    }
  }

  async function handleFilterLedger(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setError(null);

    try {
      const payload = await apiListLedger(token, {
        referenceType: ledgerFilter.referenceType || undefined,
        referenceId: ledgerFilter.referenceId || undefined,
      });

      setLedgerEntries(payload.entries);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Lọc ledger thất bại";
      setError(message);
    }
  }

  async function handleCreateReversal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !ledgerFilter.reversalTargetId || !ledgerFilter.reversalReason) return;

    setError(null);

    try {
      await apiCreateReversal(
        token,
        ledgerFilter.reversalTargetId,
        ledgerFilter.reversalReason,
        generateIdempotencyKey("ledger-reversal"),
      );

      setLedgerFilter((prev) => ({ ...prev, reversalTargetId: "", reversalReason: "" }));
      await reloadAllData();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Tạo reversal thất bại";
      setError(message);
    }
  }

  return (
    <section className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Security & Logs</CardTitle>
          <CardDescription>Quản trị người dùng, audit logs và immutable ledger.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Current role:</span>
            <Badge variant="outline">{currentUser?.role ?? "N/A"}</Badge>
          </div>

          {!token ? (
            <Alert>
              <AlertDescription>Vui lòng đăng nhập để sử dụng module security.</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={reloadAllData} disabled={!token || loading}>
              {loading ? "Đang tải..." : "Tải dữ liệu security"}
            </Button>
          </div>

          {token && currentUser?.role !== "FINANCE_ADMIN" ? (
            <Alert>
              <AlertDescription>
                Lưu ý: chỉ FINANCE_ADMIN có toàn quyền quản trị user; các thao tác khác phụ thuộc role.
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Register User</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleRegisterUser}>
              <div className="space-y-2">
                <Label htmlFor="register-username">Username</Label>
                <Input
                  id="register-username"
                  value={registerForm.username}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, username: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-full-name">Full Name</Label>
                <Input
                  id="register-full-name"
                  value={registerForm.fullName}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, fullName: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-role">Role</Label>
                <Select
                  value={registerForm.role}
                  onValueChange={(value) =>
                    setRegisterForm((prev) => ({
                      ...prev,
                      role: value as UserRole,
                    }))
                  }
                >
                  <SelectTrigger id="register-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                    <SelectItem value="MANAGER">MANAGER</SelectItem>
                    <SelectItem value="ACCOUNTANT">ACCOUNTANT</SelectItem>
                    <SelectItem value="FINANCE_ADMIN">FINANCE_ADMIN</SelectItem>
                    <SelectItem value="AUDITOR">AUDITOR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={!token || currentUser?.role !== "FINANCE_ADMIN"}>
                Tạo user
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Update User</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleUpdateUser}>
              <div className="space-y-2">
                <Label htmlFor="update-id">User ID</Label>
                <Input
                  id="update-id"
                  value={updateForm.id}
                  onChange={(event) => setUpdateForm((prev) => ({ ...prev, id: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="update-username">Username</Label>
                <Input
                  id="update-username"
                  value={updateForm.username}
                  onChange={(event) => setUpdateForm((prev) => ({ ...prev, username: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="update-full-name">Full Name</Label>
                <Input
                  id="update-full-name"
                  value={updateForm.fullName}
                  onChange={(event) => setUpdateForm((prev) => ({ ...prev, fullName: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="update-email">Email</Label>
                <Input
                  id="update-email"
                  value={updateForm.email}
                  onChange={(event) => setUpdateForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="update-role">Role</Label>
                <Select
                  value={updateForm.role}
                  onValueChange={(value) =>
                    setUpdateForm((prev) => ({
                      ...prev,
                      role: value as UserRole,
                    }))
                  }
                >
                  <SelectTrigger id="update-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                    <SelectItem value="MANAGER">MANAGER</SelectItem>
                    <SelectItem value="ACCOUNTANT">ACCOUNTANT</SelectItem>
                    <SelectItem value="FINANCE_ADMIN">FINANCE_ADMIN</SelectItem>
                    <SelectItem value="AUDITOR">AUDITOR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="update-active"
                  checked={updateForm.isActive}
                  onCheckedChange={(checked) =>
                    setUpdateForm((prev) => ({
                      ...prev,
                      isActive: checked === true,
                    }))
                  }
                />
                <Label htmlFor="update-active">Active</Label>
              </div>

              <Button
                type="submit"
                disabled={!token || (currentUser?.role !== "FINANCE_ADMIN" && updateForm.id !== currentUser?.id)}
              >
                Cập nhật user
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Delete User</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleDeleteUser}>
              <div className="space-y-2">
                <Label htmlFor="delete-user-id">User ID</Label>
                <Input
                  id="delete-user-id"
                  value={deleteUserId}
                  onChange={(event) => setDeleteUserId(event.target.value)}
                  required
                />
              </div>

              <Button type="submit" variant="destructive" disabled={!token || currentUser?.role !== "FINANCE_ADMIN"}>
                Xóa user
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.fullName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "secondary" : "outline"}>{String(user.isActive)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleFilterLogs}>
              <div className="space-y-2">
                <Label htmlFor="log-entity-type">Entity Type</Label>
                <Input
                  id="log-entity-type"
                  value={logFilter.entityType}
                  onChange={(event) => setLogFilter((prev) => ({ ...prev, entityType: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="log-entity-id">Entity ID</Label>
                <Input
                  id="log-entity-id"
                  value={logFilter.entityId}
                  onChange={(event) => setLogFilter((prev) => ({ ...prev, entityId: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="log-user-id">User ID</Label>
                <Input
                  id="log-user-id"
                  value={logFilter.userId}
                  onChange={(event) => setLogFilter((prev) => ({ ...prev, userId: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="log-from-date">From Date (ISO)</Label>
                <Input
                  id="log-from-date"
                  value={logFilter.fromDate}
                  onChange={(event) => setLogFilter((prev) => ({ ...prev, fromDate: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="log-to-date">To Date (ISO)</Label>
                <Input
                  id="log-to-date"
                  value={logFilter.toDate}
                  onChange={(event) => setLogFilter((prev) => ({ ...prev, toDate: event.target.value }))}
                />
              </div>

              <Button
                type="submit"
                disabled={!token || (currentUser?.role !== "FINANCE_ADMIN" && currentUser?.role !== "AUDITOR")}
              >
                Lọc logs
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Ledger Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleFilterLedger}>
              <div className="space-y-2">
                <Label htmlFor="ledger-reference-type">Reference Type</Label>
                <Input
                  id="ledger-reference-type"
                  value={ledgerFilter.referenceType}
                  onChange={(event) => setLedgerFilter((prev) => ({ ...prev, referenceType: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ledger-reference-id">Reference ID</Label>
                <Input
                  id="ledger-reference-id"
                  value={ledgerFilter.referenceId}
                  onChange={(event) => setLedgerFilter((prev) => ({ ...prev, referenceId: event.target.value }))}
                />
              </div>

              <Button
                type="submit"
                disabled={
                  !token ||
                  (currentUser?.role !== "FINANCE_ADMIN" &&
                    currentUser?.role !== "ACCOUNTANT" &&
                    currentUser?.role !== "AUDITOR")
                }
              >
                Lọc ledger
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Audit Logs Result</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Correlation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.createdAt}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>
                    {log.entityType}:{log.entityId}
                  </TableCell>
                  <TableCell>{log.result}</TableCell>
                  <TableCell>{log.actor.username}</TableCell>
                  <TableCell>{log.correlationId ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Ledger (immutable) & Reversal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleCreateReversal}>
            <div className="space-y-2">
              <Label htmlFor="reversal-target-id">Target Ledger Entry ID</Label>
              <Input
                id="reversal-target-id"
                value={ledgerFilter.reversalTargetId}
                onChange={(event) => setLedgerFilter((prev) => ({ ...prev, reversalTargetId: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reversal-reason">Reversal Reason</Label>
              <Input
                id="reversal-reason"
                value={ledgerFilter.reversalReason}
                onChange={(event) => setLedgerFilter((prev) => ({ ...prev, reversalReason: event.target.value }))}
                required
              />
            </div>

            <div className="md:col-span-2">
              <Button
                type="submit"
                disabled={!token || (currentUser?.role !== "FINANCE_ADMIN" && currentUser?.role !== "ACCOUNTANT")}
              >
                Tạo reversal
              </Button>
            </div>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Reversal Of</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.entryCode}</TableCell>
                  <TableCell>{entry.type}</TableCell>
                  <TableCell>
                    {entry.amount} {entry.currency}
                  </TableCell>
                  <TableCell>
                    {entry.referenceType}:{entry.referenceId}
                  </TableCell>
                  <TableCell>{entry.reversalOfEntryCode ?? entry.reversalOfId ?? "-"}</TableCell>
                  <TableCell>{entry.createdBy.username}</TableCell>
                  <TableCell>{entry.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
