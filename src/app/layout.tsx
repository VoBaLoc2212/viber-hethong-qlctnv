import { AppNav } from "@/components/app-nav";

import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
