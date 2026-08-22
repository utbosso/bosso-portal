import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import PortalAccessGate from "@/components/PortalAccessGate";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BOSSO Member Portal | Business of Sports",
  description:
    "Member portal for the Business of Sports Student Organization (BOSSO) at UT Austin. Track events, projects, opportunities, and the business of sports.",
  icons: {
    icon: "/bosso-logo-dark.png",
    apple: "/bosso-logo-dark.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const AppShell = dynamic(() => import("@/components/AppShell"), { ssr: false });
const ThemeProvider = dynamic(() => import("@/components/ThemeProvider"), { ssr: false });

const themeBootScript = `
  (function () {
    try {
      var theme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
      var root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
      root.style.colorScheme = theme;
    } catch (_) {
      document.documentElement.classList.add('light');
      document.documentElement.style.colorScheme = 'light';
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} light`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body className="antialiased">
        <ThemeProvider>
          <PortalAccessGate>
            <AppShell>{children}</AppShell>
          </PortalAccessGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
