import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arcjet sensitive information detection example",
  description:
    "An example Next.js application demonstrating Arcjet sensitive information detection, including the on-device Rampart NER backend and Arcjet Guard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
