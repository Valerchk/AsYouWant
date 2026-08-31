import type { MetadataRoute } from "next";

/* Only the pitch is for the public. Everything behind sign-in already
   redirects, but saying so keeps those paths out of search results and out of
   the crawl budget of anything that ignores the redirect. */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/today", "/inbox", "/review", "/settings", "/add", "/api/", "/auth/", "/bench"],
    },
  };
}
