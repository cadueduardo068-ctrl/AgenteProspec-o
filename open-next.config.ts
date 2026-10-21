import { defineCloudflareConfig } from '@opennextjs/cloudflare';
// CRM routes are dynamic and private; do not cache authenticated records in R2/KV.
export default defineCloudflareConfig();
