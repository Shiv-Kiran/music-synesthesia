import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Qualia",
    template: "%s | Qualia",
  },
  description: "Synesthetic music companion for deep listening.",
  icons: {
    icon: [
      { url: "/QualiaIcon.png", type: "image/png" },
    ],
    apple: [
      { url: "/QualiaIcon.png" },
    ],
    shortcut: ["/QualiaIcon.png"],
  },
  openGraph: {
    title: "Qualia",
    description: "Synesthetic music companion for deep listening.",
    type: "website",
    url: "/",
    siteName: "Qualia",
    images: [
      {
        url: "/og-card.jpg?v=1",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "Qualia preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Qualia",
    description: "Synesthetic music companion for deep listening.",
    images: ["/og-card.jpg?v=1"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
