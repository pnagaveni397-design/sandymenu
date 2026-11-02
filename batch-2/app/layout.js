import "./globals.css";

export const metadata = {
  title: "TableServe — QR Menu & Ordering",
  description: "Scan, browse, order — the QR menu platform for restaurants and hotels.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Quicksand:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="font-body min-h-screen">{children}</body>
    </html>
  );
}
