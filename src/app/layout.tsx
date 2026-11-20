import type { Metadata } from "next";
import "@fontsource/big-shoulders-display/latin-700";
import "@fontsource/big-shoulders-display/latin-900";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Truthful Pro — Check every claim before it ships",
  description:
    "Truthful Pro is a fact-checking API. Send a claim, get back a structured verdict with its sources.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
