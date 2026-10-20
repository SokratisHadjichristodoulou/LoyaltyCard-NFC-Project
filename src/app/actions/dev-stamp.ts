"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isDevStampEnabled } from "@/lib/env";
import { outcomePath, stampCustomer } from "@/lib/stamping";

/** Dev-only stand-in for an NFC tap: stamps the signed-in customer. */
export async function addTestStamp() {
  if (!isDevStampEnabled()) throw new Error("Test stamps are only available on the dev server with DEV_STAMPS=1");
  const user = await getUser();
  if (!user) redirect("/login");

  redirect(outcomePath(await stampCustomer(user.id)));
}
