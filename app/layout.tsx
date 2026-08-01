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
    { rel: "apple-touch-icon", url: "/icon.jpg" },
    { rel: "icon", url: "/icon.jpg" },
  ],
};

export const viewport: Viewport = {
  themeColor: "#080414",
  width: "device-width",
  initialScale: 1,
  maximumScale: 10,
  userScalable: true,
  viewportFit: "cover",
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
      <body className="min-h-[100dvh] flex flex-col font-sans bg-bg text-text-primary selection:bg-accent-solid/30" suppressHydrationWarning>
        <AuthProvider>
          {/* Background Layer 1: Blurred Cover for wide screens */}
          <div 
            className="fixed inset-0 pointer-events-none -z-20 no-print bg-[#080414] opacity-50"
            style={{
              backgroundImage: 'url(/bg.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center center',
              filter: 'blur(40px)',
              transform: 'scale(1.1)',
            }}
          />
          {/* Background Layer 2: Contained Logo */}
          <div 
            className="fixed inset-0 pointer-events-none -z-10 no-print"
            style={{
              backgroundImage: 'url(/bg.png)',
              backgroundSize: 'contain',
              backgroundPosition: 'center center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            {/* Dark overlay to ensure text remains readable over the image */}
            <div className="absolute inset-0 bg-black/60 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#080414]/40 via-transparent to-[#080414]/80" />
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
