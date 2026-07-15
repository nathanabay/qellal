import type { NextConfig } from "next";

// F19: keep the payload lean for 3G. SSR + minimal client JS is the default;
// these settings shave a little more and drop noise from production bundles.
const nextConfig: NextConfig = {
  poweredByHeader: false, // no unnecessary response header
  productionBrowserSourceMaps: false, // don't ship source maps to users
  compiler: {
    // Strip console.* from production bundles, but keep error/warn for real logs.
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
};

export default nextConfig;
