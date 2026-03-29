"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  BarChart3,
  ShieldCheck,
  Users,
  WalletCards,
  Bot,
  Bell,
  Search,
  Wallet,
  Sun,
  Moon,
  Menu,
  Coins,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NAV_ITEMS } from "@/lib/auth/rbac";
import { useGetDashboardKpis, useGetTransactions } from "@/lib/api-client";
import { getRoleLabel, getTransactionStatusLabel, getTransactionTypeLabel } from "@/lib/ui-labels";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ICONS: Record<(typeof NAV_ITEMS)[number]["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  transactions: Receipt,
  budgeting: WalletCards,
  budgets: PieChart,
  reports: BarChart3,
  security: ShieldCheck,
  users: Users,
  assistant: Bot,
  fxRates: Coins,
  approvals: ClipboardCheck,
};

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { currentUser, logout, initializing } = useAuthSession();
  const [mounted, setMounted] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  const { data: dashboardKpis } = useGetDashboardKpis({ enabled: Boolean(currentUser) });
  const { data: recentTransactions } = useGetTransactions({ limit: 5, page: 1 }, { enabled: Boolean(currentUser) });

  const unreadCount = (dashboardKpis?.pendingCount ?? 0) + (recentTransactions?.data.length ?? 0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthPage = pathname === "/auth";

  const visibleNavItems = useMemo(() => {
    if (!currentUser) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(currentUser.role));
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

  function handleHeaderSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const keyword = searchKeyword.trim();
    const params = new URLSearchParams();
    if (keyword) params.set("q", keyword);

    const query = params.toString();
    router.push(query ? `/transactions?${query}` : "/transactions");
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
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Điều hướng</div>
          {visibleNavItems.map((item) => {
            const Icon = ICONS[item.icon];
            const isActive = pathname === item.href;
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
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/50 p-4">
          <div className="rounded-xl bg-secondary/50 p-4">
            <h4 className="mb-1 text-sm font-semibold">Cần hỗ trợ?</h4>
            <p className="mb-3 text-xs text-muted-foreground">Xem tài liệu hoặc liên hệ bộ phận hỗ trợ.</p>
            <Button asChild variant="outline" className="w-full text-xs" size="sm">
              <Link href="/help">Tài liệu</Link>
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/50 bg-card/80 px-3 backdrop-blur-md sm:px-4 md:px-6">
          <div className="flex w-full items-center gap-2 sm:gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full md:hidden" aria-label="Mở menu điều hướng">
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
                  <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Điều hướng</div>
                  {visibleNavItems.map((item) => {
                    const Icon = ICONS[item.icon];
                    const isActive = pathname === item.href;
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
                          {item.label}
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
            <form className="relative hidden w-full max-w-sm sm:block" onSubmit={handleHeaderSearch}>
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="Tìm kiếm giao dịch..."
                className="h-9 rounded-full border-transparent bg-secondary/50 pl-9 transition-colors focus-visible:bg-background"
              />
            </form>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Thông báo">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-card bg-destructive" />
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-3">
                <div>
                  <p className="text-sm font-semibold">Thông báo</p>
                  <p className="text-xs text-muted-foreground">Hiện có {dashboardKpis?.pendingCount ?? 0} giao dịch chờ phê duyệt.</p>
                </div>

                <div className="space-y-2">
                  {recentTransactions?.data.length ? (
                    recentTransactions.data.map((tx) => (
                      <div key={tx.id} className="rounded-md border border-border/60 p-2 text-xs">
                        <p className="font-medium">{tx.transactionCode}</p>
                        <p className="text-muted-foreground">
                          {getTransactionTypeLabel(tx.type)} · {getTransactionStatusLabel(tx.status)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Chưa có giao dịch gần đây.</p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard">Xem tổng quan</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/transactions">Xem giao dịch</Link>
                  </Button>
                </div>
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
            <div className="mx-0.5 hidden h-6 w-px bg-border sm:block" />
            <button
              type="button"
              className="flex items-center gap-3 rounded-full p-1.5 pr-3 transition-colors hover:bg-secondary/50"
              onClick={() => setLogoutDialogOpen(true)}
              disabled={initializing || loggingOut}
            >
              <Avatar className="h-8 w-8 border border-border/50">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                  {currentUser?.fullName?.slice(0, 2).toUpperCase() ?? "--"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-none">{currentUser?.fullName ?? "Chưa có"}</p>
                <p className="text-xs text-muted-foreground">{getRoleLabel(currentUser?.role) ?? "Chưa có"}</p>
              </div>
            </button>
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
