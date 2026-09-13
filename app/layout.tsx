import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { DeckPersistence } from "@/features/decks/components/DeckPersistence";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AI Presentation Builder",
    template: "%s · AI Presentation Builder",
  },
  description: "Create presentations with AI, then refine them by chat or by hand.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the color-mode class on <html> before hydration, so React must not warn about it.
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <DeckPersistence />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
