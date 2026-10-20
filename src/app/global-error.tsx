"use client";

import "@/styles/globals.css";
import { ServerErrorView } from "@/components/ServerErrorView";

// Last resort, when even the root layout fails. It replaces the layout, so it
// brings its own <html> and <body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="el">
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <title>Coffee Pause</title>
      </head>
      <body className="min-h-dvh antialiased">
        <ServerErrorView error={error} reset={reset} />
      </body>
    </html>
  );
}
