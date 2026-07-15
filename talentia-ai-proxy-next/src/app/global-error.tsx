"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        {/* NextError's type requires a statusCode prop, but Next.js doesn't expose one for this boundary. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
