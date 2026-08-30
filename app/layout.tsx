import type { Metadata, Viewport } from "next";
import { Unbounded, Onest, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "As You Want",
  description: "A day that reshapes itself when the day changes.",
  applicationName: "As You Want",
  appleWebApp: {
    capable: true,
    title: "As You Want",
    // Transparent lets our own paper show through the status bar instead of
    // iOS painting a slab of its own behind it.
    statusBarStyle: "black-translucent",
  },
  // iOS ignores the manifest's icons for the Home Screen and reads this.
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  // Two values so the iOS status bar matches whichever theme is showing.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F0" },
    { media: "(prefers-color-scheme: dark)", color: "#16140F" },
  ],
  // Required for env(safe-area-inset-*) to report anything but zero once the
  // app is installed to the Home Screen.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  // A planner is chrome, not a document: pinch-zooming it only ever happens
  // by accident mid-drag.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The inline script below sets data-theme on this element before React
    // hydrates, so the server markup and the client DOM legitimately differ
    // by exactly that attribute. Suppressing the warning here is the standard
    // fix; it applies to this element only, not to the tree beneath it.
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${unbounded.variable} ${onest.variable} ${plexMono.variable} antialiased`}
      >
        {/* Applies the stored theme before the first paint. Without it a
            dark-theme user gets a flash of paper-white on every load, since
            the React tree resolves far too late to prevent it.

            It sits at the top of <body> rather than in a hand-written <head>:
            the App Router builds the head itself, and a manual one there
            fights hydration. The browser still runs this before painting any
            of the content below it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("ayw.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
