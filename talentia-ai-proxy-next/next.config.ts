import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

// Wrapping is safe even without a Sentry account: source map upload is
// silently skipped when SENTRY_AUTH_TOKEN/org/project aren't configured.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  // No account is configured for this project by default; skip release
  // tracking/annotation until SENTRY_AUTH_TOKEN is provided.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
