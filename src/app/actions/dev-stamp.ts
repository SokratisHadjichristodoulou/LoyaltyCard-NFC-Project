"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isDevStampEnabled } from "@/lib/env";
import { stampCustomer } from "@/lib/stamping";

/** Dev-only stand-in for an NFC tap: stamps the signed-in customer. */
export async function addTestStamp() {
  if (!isDevStampEnabled()) throw new Error("Test stamps are only available on the dev server with DEV_STAMPS=1");
  const user = await getUser();
  if (!user) redirect("/login");

  const outcome = await stampCustomer(user.id);
  if (outcome.result === "coupon_issued") redirect("/coupon?new=1");
  if (outcome.result === "cooldown") redirect(`/?cooldown=${outcome.retryAfterSeconds}`);
  redirect("/?stamped=1");
}
