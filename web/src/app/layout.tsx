import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import ServiceWorker from "@/components/ServiceWorker";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "My Dashboard",
  description: "Your personal health and finances dashboard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "My Dashboard",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0c12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <ServiceWorker />
        <NavBar />
        <main className="mx-auto max-w-screen-2xl px-5 py-8 sm:px-8 animate-fade-up">
          {children}
        </main>
      </body>
    </html>
  );
}
