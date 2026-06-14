import type { Metadata } from "next";
import BrowserBranding from "./browser-branding";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIXRAM NextGen AutoHub",
  description: "Next.js and Prisma migration foundation for SIXRAM NextGen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <BrowserBranding />
        {children}
      </body>
    </html>
  );
}
