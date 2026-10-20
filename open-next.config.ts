// Cloudflare adapter config (@opennextjs/cloudflare). Every page is rendered
// per request, so no incremental cache (R2) is needed.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
