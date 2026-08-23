import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "life-map",
  description: "One input box. A map of the person you're building.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
