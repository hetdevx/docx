import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfjs-dist (via pdf-parse) resolves its worker script with a relative
  // import at runtime; bundling it rewrites that path into a chunk that
  // doesn't exist, breaking PDF text extraction in Route Handlers. Leaving
  // it external makes Next.js resolve it via plain Node `require` instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
