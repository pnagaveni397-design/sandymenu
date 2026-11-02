// Lets browsers show TableServe as an installable app with its own icon.
export default function manifest() {
  return {
    name: "TableServe",
    short_name: "TableServe",
    description: "Billing, orders and receipts for restaurants",
    start_url: "/login",
    display: "standalone",
    background_color: "#FBF6EA",
    theme_color: "#2E7D53",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
