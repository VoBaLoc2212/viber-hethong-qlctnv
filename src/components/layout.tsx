"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  BarChart3,
  Bot,
  Bell,
  Search,
  Wallet,
  Sun,
  Moon,
  CheckCircle2,
  Undo2,
  Check,
  Menu,
  ChevronDown,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

import { useAuthSession } from "@/components/auth-session-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useGetNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useGetApprovals,
} from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems: { href: string; label: string; icon: LucideIcon; roles?: string[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/approvals", label: "Quy trình Duyệt chi (Approval)", icon: CheckCircle2, roles: ["MANAGER", "ACCOUNTANT"] },
  { href: "/reimbursement", label: "Hoàn ứng (Reimbursement)", icon: Undo2 },
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/ai-assistant", label: "AI Assistant", icon: Bot },
];

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { currentUser, logout, initializing } = useAuthSession();
  const [mounted, setMounted] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const notificationsQuery = useGetNotifications({ enabled: !!currentUser });
  const notifications = notificationsQuery.data?.data ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const approvalBadgeParams = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.role === "MANAGER" || currentUser.role === "FINANCE_ADMIN") {
      return { tab: "approve", status: "PENDING" as const };
    }
    if (currentUser.role === "ACCOUNTANT") {
      return { tab: "execute", status: "APPROVED" as const };
    }
    return null;
  }, [currentUser]);

  const approvalsQuery = useGetApprovals(approvalBadgeParams ?? {}, { enabled: !!currentUser && !!approvalBadgeParams });
  const pendingApprovalCount = approvalBadgeParams ? (approvalsQuery.data?.length ?? 0) : 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthPage = pathname === "/auth";

  const visibleNavItems = useMemo(() => {
    if (!currentUser) return [];
    return navItems.filter((item) => !item.roles || item.roles.includes(currentUser.role));
  }, [currentUser]);

  async function handleConfirmLogout() {
    if (loggingOut || initializing) return;
    setLoggingOut(true);
    try {
      await logout();
      setLogoutDialogOpen(false);
    } finally {
      setLoggingOut(false);
    }
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận đăng xuất</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc hiện tại không?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmLogout()} disabled={loggingOut}>
              {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-h-svh w-full bg-background">
      <aside className="z-10 hidden w-64 flex-col border-r bg-card shadow-sm shadow-black/5 md:flex">
        <div className="flex h-16 items-center border-b border-border/50 px-6">
          <Link
            href="/dashboard"
            className="flex cursor-pointer items-center gap-2 font-display text-lg font-bold text-primary transition-opacity hover:opacity-80"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            BudgetFlow
          </Link>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-6">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menu</div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = isPathActive(pathname, item.href);
            const showBadge = item.href === "/approvals" && pendingApprovalCount > 0;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`
                  flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200
                  ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }
                `}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {showBadge && (
                    <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-destructive text-destructive-foreground'
                    }`}>
                      {pendingApprovalCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/50 p-4">
          <div className="rounded-xl bg-secondary/50 p-4">
            <h4 className="mb-1 text-sm font-semibold">Need help?</h4>
            <p className="mb-3 text-xs text-muted-foreground">Check our documentation or contact support.</p>
            <Button variant="outline" className="w-full text-xs" size="sm">
              Documentation
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/50 bg-card/80 px-3 backdrop-blur-md sm:px-4 md:px-6">
          <div className="flex w-full items-center gap-2 sm:gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full md:hidden" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5 text-muted-foreground" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <div className="flex h-16 items-center border-b border-border/50 px-6">
                  <Link
                    href="/dashboard"
                    className="flex cursor-pointer items-center gap-2 font-display text-lg font-bold text-primary transition-opacity hover:opacity-80"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    BudgetFlow
                  </Link>
                </div>
                <nav className="space-y-1.5 px-3 py-6">
                  <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menu</div>
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = isPathActive(pathname, item.href);
                    const showBadge = item.href === "/approvals" && pendingApprovalCount > 0;
                    return (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={`
                          flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200
                          ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }
                        `}
                        >
                          <Icon className={`h-5 w-5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {showBadge && (
                            <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
                              isActive
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-destructive text-destructive-foreground"
                            }`}>
                              {pendingApprovalCount}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
            <div className="relative hidden w-full max-w-sm sm:block">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                className="h-9 rounded-full border-transparent bg-secondary/50 pl-9 transition-colors focus-visible:bg-background"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* ─── Notification bell ─── */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full relative">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 border-2 border-card">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[360px] p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h4 className="font-semibold text-sm">Thông báo</h4>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => markAllRead.mutate()}
                    >
                      <Check className="w-3 h-3 mr-1" /> Đánh dấu tất cả đã đọc
                    </Button>
                  )}
                </div>
                <ScrollArea className="max-h-80">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Không có thông báo
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {notifications.slice(0, 20).map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 cursor-pointer hover:bg-secondary/50 transition-colors ${
                            !n.isRead ? "bg-primary/5" : ""
                          }`}
                          onClick={() => !n.isRead && markRead.mutate({ id: n.id })}
                        >
                          <div className="flex items-start gap-2">
                            {!n.isRead && (
                              <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-snug ${
                                !n.isRead ? "font-medium" : "text-muted-foreground"
                              }`}>
                                {n.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {n.message}
                              </p>
                              <p className="text-[10px] text-muted-foreground/60 mt-1">
                                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: vi })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Đổi theme"
              onClick={() => {
                if (!mounted) return;
                setTheme(resolvedTheme === "dark" ? "light" : "dark");
              }}
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Moon className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
            <div className="h-6 w-px bg-border mx-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto gap-2 rounded-full p-1.5 pr-3 hover:bg-secondary/50">
                  <Avatar className="w-8 h-8 border border-border/50">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                      {currentUser?.fullName
                        ?.split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium leading-none">{currentUser?.fullName ?? "Người dùng"}</p>
                    <p className="text-xs text-muted-foreground">{currentUser?.role ?? "-"}</p>
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="space-y-1">
                  <p className="text-sm font-medium leading-none">{currentUser?.fullName ?? "Người dùng"}</p>
                  <p className="text-xs text-muted-foreground">{currentUser?.email ?? ""}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setLogoutDialogOpen(true); }}>
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

          <div className="flex-1 overflow-auto bg-background p-4 md:p-8">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mx-auto h-full max-w-6xl"
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </>
  );
}
