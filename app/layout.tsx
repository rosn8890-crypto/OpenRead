import "./globals.css";
import Navbar from "@/components/Navbar";
import ServiceWorkerCleanup from "@/components/ServiceWorkerCleanup";

// Next.js's metadata API does NOT automatically prepend the configured
// basePath to manifest/icon URLs the way it does for next/link and
// next/image — so without this, the browser looks for the manifest at
// the wrong address (site root instead of /OpenRead/) and reports
// "No manifest detected" even though the file itself is fine.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata = {
  title: "OpenRead — Read Anything, Anywhere",
  description: "A free online book reading platform.",
  manifest: `${basePath}/manifest.json`,
  icons: {
    icon: [
      { url: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OpenRead",
  },
};

// This is the actual fix for the "shows like a desktop site on mobile"
// problem — without it, phones assume a ~980px-wide page and shrink the
// whole thing to fit the screen, which is exactly the tiny/zoomed-out look.
// This tells the browser to render at the phone's real width and never
// force-zoom, while still letting the person pinch-zoom manually if they want.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0A0A0A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerCleanup />
        <Navbar />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
