import type { Metadata } from "next";
import { Inter_Tight, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "@/styles/japanese-theme.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Providers } from "@/components/Providers";
// Removed NetworkStatus import - debug panel not needed on main page
import { AutoWalletProvider } from "@/components/AutoWalletProvider";
import { WebSocketStatus } from "@/components/WebSocketStatus";
import { NavigationBar } from "@/components/NavigationBar";

// Custom fonts
const fkDisplay = localFont({
  src: "../fonts/FKDisplay-RegularAlt.woff",
  variable: "--font-fk-display",
  weight: "400",
  display: "swap",
});

const fkGrotesk = localFont({
  src: [
    {
      path: "../fonts/FKGrotesk-Regular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/FKGrotesk-Bold.woff",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-fk-grotesk",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Dojima CLOB",
  description: "The world's first rice exchange, reimagined for the digital age",
  icons: {
    icon: [
      // Light mode favicon
      {
        url: "/favicon_light.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      // Dark mode favicon
      {
        url: "/favicon_dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
      // Fallback favicon
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/images/rise-logo-light.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fkDisplay.variable} ${fkGrotesk.variable} ${interTight.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          <ThemeProvider>
            <AutoWalletProvider>
              <div className="min-h-screen flex flex-col relative">
                <NavigationBar />
                <main className="flex-1 relative">
                  <div className="relative z-10">
                    {children}
                  </div>
                </main>
                <WebSocketStatus />
              </div>
            </AutoWalletProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}