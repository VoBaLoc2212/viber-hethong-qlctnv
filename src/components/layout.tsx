"use client";

import { ReactNode, useEffect, useState } from "react";
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
  ChevronDown,
  LogOut,
  Check,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentUser,
  useLogout,
  useGetNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useGetApprovals,
} from "@/lib/api-client";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/approvals", label: "Quy trình Duyệt chi (Approval)", icon: CheckCircle2 },
  { href: "/reimbursement", label: "Hoàn ứng (Reimbursement)", icon: Undo2 },
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/ai-assistant", label: "AI Assistant", icon: Bot },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col hidden md:flex z-10 shadow-sm shadow-black/5">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg font-bold text-primary cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            BudgetFlow
          </Link>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5">
          <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Menu
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const showBadge = item.href === "/approvals" && pendingApprovalCount > 0;
            return (
              <Link key={item.href} href={item.href}>
                <div className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer
                  ${isActive 
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }
                `}>
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
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

        <div className="p-4 border-t border-border/50">
          <div className="bg-secondary/50 rounded-xl p-4">
            <h4 className="text-sm font-semibold mb-1">Need help?</h4>
            <p className="text-xs text-muted-foreground mb-3">Check our documentation or contact support.</p>
            <Button variant="outline" className="w-full text-xs" size="sm">Documentation</Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4 w-full max-w-md">
            <div className="relative w-full max-w-sm hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search transactions..." 
                className="pl-9 bg-secondary/50 border-transparent focus-visible:bg-background transition-colors h-9 rounded-full"
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
                <Sun className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Moon className="w-5 h-5 text-muted-foreground" />
              )}
            </Button>
            <div className="h-6 w-px bg-border mx-1" />

            {/* ─── User Menu ─── */}
            <Popover>
              <PopoverTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer hover:bg-secondary/50 p-1.5 pr-3 rounded-full transition-colors">
                  <Avatar className="w-8 h-8 border border-border/50">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium leading-none">{currentUser?.fullName ?? "..."}</p>
                    <p className="text-xs text-muted-foreground">{currentUser?.role ?? ""}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2">
                <div className="px-2 py-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{currentUser?.fullName}</p>
                      <p className="text-sm text-muted-foreground truncate">{currentUser?.email}</p>
                      <Badge variant="outline" className="text-xs mt-1">{currentUser?.role}</Badge>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <button
                    className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary/70"
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                  >
                    <LogOut className="w-4 h-4 text-muted-foreground" />
                    <span>{logout.isPending ? "Đang đăng xuất..." : "Đăng xuất"}</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-background p-4 md:p-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="max-w-6xl mx-auto h-full"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

