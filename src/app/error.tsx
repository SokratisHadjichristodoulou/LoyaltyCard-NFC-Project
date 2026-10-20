"use client";

import { ServerErrorView } from "@/components/ServerErrorView";

// Shown when a page fails to render (e.g. the database can't be reached).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ServerErrorView error={error} reset={reset} />;
}
