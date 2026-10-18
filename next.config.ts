import type { NextConfig } from "next";

/**
 * Static export is opt in, through NEXT_OUTPUT=export.
 *
 * Not switched on permanently because Vercel is still serving this and a
 * permanent `output: "export"` changes how it builds there too. Set the
 * variable in the AWS build and leave it unset everywhere else, so the two
 * targets can exist at the same time rather than one replacing the other on
 * the day the config changes.
 *
 * This app exports cleanly: it has no dynamic routes, no API routes, no
 * middleware and no server actions. It is a client rendered panel that talks
 * to the API, so there is nothing for a Node server to do.
 */
const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT === "export" ? "export" : undefined,
  // S3 serves /path/ as a directory; without this a refresh on a nested route
  // asks for an object that is not there and answers 404.
  trailingSlash: process.env.NEXT_OUTPUT === "export" ? true : undefined,
  images: {
    // There is no Next server to resize them when exported.
    unoptimized: process.env.NEXT_OUTPUT === "export",
  },
};

export default nextConfig;
