import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PageWorld",
  description: "Upload a PDF and walk through its story as a chain of interactive 3D scenes.",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
