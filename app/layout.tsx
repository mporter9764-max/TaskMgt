import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Timeline",
  description: "A lightweight task management and timeline app.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
