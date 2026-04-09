"use client";

import { useEffect, useState } from "react";

import { apiListUsers, apiRegisterUser, apiUpdateUser } from "@/lib/api";
import type { AuthUser } from "@/lib/api";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getRoleLabel } from "@/lib/ui-labels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type UserManagementWorkspaceProps = {
  token: string | null;
  currentUser: AuthUser | null;
};

type UserRole = "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";

export function UserManagementWorkspace({ token, currentUser }: UserManagementWorkspaceProps) {
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

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


  async function loadUsers() {
    if (!token || currentUser?.role !== "FINANCE_ADMIN") {
      setUsers([]);
      return;
    }

    setLoadingUsers(true);

    try {
      const payload = await apiListUsers(token);
      setUsers(payload.users);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Không tải được danh sách người dùng";
      setError(message);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [token, currentUser?.role]);

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
      await loadUsers();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Đăng ký người dùng thất bại";
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
      await loadUsers();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Cập nhật người dùng thất bại";
      setError(message);
    }
  }

  return (
    <section className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Quản lý người dùng</CardTitle>
          <CardDescription>Tạo tài khoản và quản lý khóa/mở khóa người dùng.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <Alert>
              <AlertDescription>Vui lòng đăng nhập để sử dụng mục quản lý người dùng.</AlertDescription>
            </Alert>
          ) : null}

          {token && currentUser?.role !== "FINANCE_ADMIN" ? (
            <Alert>
              <AlertDescription>Chỉ {getRoleLabel("FINANCE_ADMIN")} có quyền thao tác trên mục này.</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Danh sách người dùng</CardTitle>
            <CardDescription>Xem toàn bộ user, role và ID để thao tác nhanh.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadUsers()} disabled={!token || currentUser?.role !== "FINANCE_ADMIN" || loadingUsers}>
            {loadingUsers ? "Đang tải..." : "Làm mới"}
          </Button>
        </CardHeader>
        <CardContent>
          {!token || currentUser?.role !== "FINANCE_ADMIN" ? (
            <p className="text-sm text-muted-foreground">Chỉ {getRoleLabel("FINANCE_ADMIN")} được xem danh sách đầy đủ.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tên đăng nhập</TableHead>
                  <TableHead>Họ và tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-xs">{user.id}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.fullName || "-"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getRoleLabel(user.role)}</TableCell>
                    <TableCell>{user.isActive ? "Hoạt động" : "Khóa"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Tạo người dùng</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleRegisterUser}>
              <div className="space-y-2">
                <Label htmlFor="register-username">Tên đăng nhập</Label>
                <Input
                  id="register-username"
                  value={registerForm.username}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, username: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Mật khẩu</Label>
                <Input
                  id="register-password"
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-full-name">Họ và tên</Label>
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
                <Label htmlFor="register-role">Vai trò</Label>
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
                    <SelectItem value="EMPLOYEE">{getRoleLabel("EMPLOYEE")}</SelectItem>
                    <SelectItem value="MANAGER">{getRoleLabel("MANAGER")}</SelectItem>
                    <SelectItem value="ACCOUNTANT">{getRoleLabel("ACCOUNTANT")}</SelectItem>
                    <SelectItem value="FINANCE_ADMIN">{getRoleLabel("FINANCE_ADMIN")}</SelectItem>
                    <SelectItem value="AUDITOR">{getRoleLabel("AUDITOR")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={!token || currentUser?.role !== "FINANCE_ADMIN"}>
                Tạo người dùng
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Khóa / Mở khóa người dùng</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleUpdateUser}>
              <div className="space-y-2">
                <Label htmlFor="update-id">ID người dùng</Label>
                <Input
                  id="update-id"
                  value={updateForm.id}
                  onChange={(event) => setUpdateForm((prev) => ({ ...prev, id: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="update-username">Tên đăng nhập</Label>
                <Input
                  id="update-username"
                  value={updateForm.username}
                  onChange={(event) => setUpdateForm((prev) => ({ ...prev, username: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="update-full-name">Họ và tên</Label>
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
                <Label htmlFor="update-role">Vai trò</Label>
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
                    <SelectItem value="EMPLOYEE">{getRoleLabel("EMPLOYEE")}</SelectItem>
                    <SelectItem value="MANAGER">{getRoleLabel("MANAGER")}</SelectItem>
                    <SelectItem value="ACCOUNTANT">{getRoleLabel("ACCOUNTANT")}</SelectItem>
                    <SelectItem value="FINANCE_ADMIN">{getRoleLabel("FINANCE_ADMIN")}</SelectItem>
                    <SelectItem value="AUDITOR">{getRoleLabel("AUDITOR")}</SelectItem>
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
                <Label htmlFor="update-active">Mở khóa tài khoản (bật để hoạt động)</Label>
              </div>

              <Button
                type="submit"
                disabled={!token || (currentUser?.role !== "FINANCE_ADMIN" && updateForm.id !== currentUser?.id)}
              >
                Lưu thay đổi khóa/mở khóa
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </section>
  );
}
