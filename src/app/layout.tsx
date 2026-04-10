import type { Metadata } from "next";
import { IBM_Plex_Mono, Sora, Space_Grotesk } from "next/font/google";
import "./globals.css";

const displayFont = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "EquiLens | Unbiased AI Decision Studio",
  description:
    "Inspect datasets and AI decision models for hidden bias, fairness gaps, and actionable mitigation pathways.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-[color:var(--color-ink)]">
        {children}
      </body>
    </html>
  );
}
