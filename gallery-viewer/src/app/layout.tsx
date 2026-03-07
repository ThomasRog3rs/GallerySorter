import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { readConfig } from "@/lib/config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await readConfig();
  return {
    title: config.siteName,
    description: "Your personal photo gallery - browse memories by year and month.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
