import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lovask — Tesadüften fazlası",
    short_name: "Lovask",
    description: "Niyetlerin görünür, sohbetlerin gerçek olduğu eşleşme deneyimi.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff8f5",
    theme_color: "#fff8f5",
    categories: ["lifestyle", "social"],
    lang: "tr-TR",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
