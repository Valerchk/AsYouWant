import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "As You Want",
    short_name: "As You Want",
    description: "A day that reshapes itself when the day changes.",
    start_url: "/today",
    // standalone is what lets iOS treat this as an app at all — and on iOS,
    // web push only works once the app has been added to the Home Screen.
    display: "standalone",
    background_color: "#FAF7F0",
    theme_color: "#FAF7F0",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
