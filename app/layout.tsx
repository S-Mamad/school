import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "دفتر کلاسی آنلاین آذرمهر | دفتر هوشمند معلم",
  description: "مدیریت کلاس و ارزشیابی پودمانی — طراحی سعید آذرمهر",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
