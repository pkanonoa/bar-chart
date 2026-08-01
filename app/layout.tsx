import type { Metadata, Viewport } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Navigation } from "@/components/Navigation";
import Script from "next/script";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clypto UI",
  description: "A tool for creating and editing bar chart notations.",
  generator: "Next.js",
  manifest: "/manifest.json",
  keywords: ["music", "chord", "chart", "editor"],
  authors: [
    { name: "ChordCraft" }
  ],
  icons: [
    { rel: "apple-touch-icon", url: "icon-192x192.png" },
    { rel: "icon", url: "icon-192x192.png" },
  ],
};

export const viewport: Viewport = {
  themeColor: "#0a0514",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
      </head>
      <body className="min-h-full flex flex-col font-sans bg-bg text-text-primary selection:bg-accent-solid/30" suppressHydrationWarning>
        <AuthProvider>
          {/* Glassmorphism gradient mesh background */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 no-print bg-[#080414]">
            <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-[#4c28a4] blur-[150px] mix-blend-screen opacity-40 animate-pulse" style={{ animationDuration: '12s' }} />
            <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] rounded-full bg-[#1b43b3] blur-[160px] mix-blend-screen opacity-30 animate-pulse" style={{ animationDuration: '18s' }} />
            <div className="absolute top-[40%] left-[30%] w-[50%] h-[50%] rounded-full bg-[#7534ff] blur-[140px] mix-blend-screen opacity-20" />
          </div>
          {children}
          <Navigation />
        </AuthProvider>
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('Service Worker registration successful with scope: ', registration.scope);
                  },
                  function(err) {
                    console.log('Service Worker registration failed: ', err);
                  }
                );
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
