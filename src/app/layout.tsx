import type { Metadata } from "next";
import BrowserBranding from "./browser-branding";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sixram Technologies | Autohub Application",
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
