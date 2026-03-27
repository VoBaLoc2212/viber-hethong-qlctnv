"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  BarChart3,
  Shield,
  Bot,
  Bell,
  Search,
  Wallet,
  Sun,
  Moon,
  CheckCircle2,
  Undo2,
  ChevronDown,
  LogOut,
  Check,
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
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/ai-assistant", label: "AI Assistant", icon: Bot },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { currentUser, logout, initializing } = useAuthSession();
  const [mounted, setMounted] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const queryClient = useQueryClient();
  const { data: currentUser } = useGetCurrentUser();
  const { data: notificationsResp } = useGetNotifications();

  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries();
        window.location.reload();
      },
    },
  });

  const markRead = useMarkNotificationRead({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
    },
  });

  const markAllRead = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
    },
  });

  // Pending approval count for sidebar badge
  const { data: pendingApprovals } = useGetApprovals(
    currentUser?.role === "MANAGER"
      ? { tab: "approve" }
      : currentUser?.role === "ACCOUNTANT"
        ? { tab: "execute" }
        : {},
  );
  const pendingApprovalCount = (pendingApprovals ?? []).filter(
    (a) => (currentUser?.role === "MANAGER" && a.status === "PENDING") || (currentUser?.role === "ACCOUNTANT" && a.status === "APPROVED"),
  ).length;

  const unreadCount = notificationsResp?.unreadCount ?? 0;
  const notifications = notificationsResp?.data ?? [];

  const initials = currentUser
    ? currentUser.fullName
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "??";

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
            const Icon = ICONS[item.icon];
            const isActive = pathname === item.href;
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
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  {item.label}
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
            <div className="relative hidden w-full max-w-sm sm:block">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                className="h-9 rounded-full border-transparent bg-secondary/50 pl-9 transition-colors focus-visible:bg-background"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-card" />
            </Button>
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
            <div className="flex items-center gap-3 cursor-pointer hover:bg-secondary/50 p-1.5 pr-3 rounded-full transition-colors">
              <Avatar className="w-8 h-8 border border-border/50">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">JD</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium leading-none">Jane Doe</p>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
            </div>
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
