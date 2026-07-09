import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrainForge Kids AI",
  description: "Unlimited, personalized developmental activities for every child.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
