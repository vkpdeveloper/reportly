import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page and API response is dynamic, so no incremental cache is configured.
export default defineCloudflareConfig({});
