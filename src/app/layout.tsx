import type { Metadata } from "next";
import "./globals.css";
import dynamic from "next/dynamic";

export const metadata: Metadata = {
  title: "BOSSO Member Portal | Business of Sports",
  description:
    "Member portal for the Business of Sports Student Organization (BOSSO) at UT Austin. Track events, projects, opportunities, and the business of sports.",
};

const AppShell = dynamic(() => import("@/components/AppShell"), { ssr: false });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
