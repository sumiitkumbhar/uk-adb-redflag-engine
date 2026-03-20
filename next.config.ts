import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16: serverComponentsExternalPackages moved out of `experimental`
  // Use this to keep pdfkit/pdfjs from being bundled in a way that breaks fonts.
  serverExternalPackages: ["pdfkit", "pdf-parse", "pdfjs-dist"],

  // Ensure pdfkit AFM/font data is included when server tracing happens.
  outputFileTracingIncludes: {
    "/api/report/pdf": ["./node_modules/pdfkit/js/data/*"],
  },
};

export default nextConfig;
