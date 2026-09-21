import type { Metadata } from "next";
import { Geist, Geist_Mono, Didact_Gothic } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Velure Design System v1's approved display typeface — only 400 weight
// exists for this face. Scoped to the sidebar + Overview via the
// `font-didact` utility (see globals.css); the rest of the app keeps
// Geist until the design system is propagated further.
const didactGothic = Didact_Gothic({
  variable: "--font-didact-gothic",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Velure",
  description: "Booking, payments, and queueing for service businesses",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${didactGothic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
