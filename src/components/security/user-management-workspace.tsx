"use client";

import { useState } from "react";

import { apiDeleteUser, apiRegisterUser, apiUpdateUser } from "@/lib/api";
import type { AuthUser } from "@/lib/api";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getRoleLabel } from "@/lib/ui-labels";

type UserManagementWorkspaceProps = {
  token: string | null;
  currentUser: AuthUser | null;
};

type UserRole = "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";

export function UserManagementWorkspace({ token, currentUser }: UserManagementWorkspaceProps) {
  const [error, setError] = useState<string | null>(null);

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
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Cập nhật người dùng thất bại";
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
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Xóa người dùng thất bại";
      setError(message);
    }
  }

  return (
    <section className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Quản lý người dùng</CardTitle>
          <CardDescription>Tạo tài khoản, cập nhật vai trò và xóa tài khoản.</CardDescription>
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
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
            <CardTitle>Cập nhật người dùng</CardTitle>
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
                <Label htmlFor="update-active">Hoạt động</Label>
              </div>

              <Button
                type="submit"
                disabled={!token || (currentUser?.role !== "FINANCE_ADMIN" && updateForm.id !== currentUser?.id)}
              >
                Cập nhật người dùng
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Xóa người dùng</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleDeleteUser}>
              <div className="space-y-2">
                <Label htmlFor="delete-user-id">ID người dùng</Label>
                <Input
                  id="delete-user-id"
                  value={deleteUserId}
                  onChange={(event) => setDeleteUserId(event.target.value)}
                  required
                />
              </div>

              <Button type="submit" variant="destructive" disabled={!token || currentUser?.role !== "FINANCE_ADMIN"}>
                Xóa người dùng
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
