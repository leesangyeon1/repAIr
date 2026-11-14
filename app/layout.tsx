import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "repAIr · Technical knowledge in 3D",
  description:
    "Explore Knowledge. Diagnose Smarter. Repair Faster. A voice-controlled holographic knowledge graph for maintenance teams.",
};

export const viewport: Viewport = {
  themeColor: "#02040c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
