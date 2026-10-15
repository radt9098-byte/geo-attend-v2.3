declare module 'cloudflare:workers' {
 export const env: { DB: import('@cloudflare/workers-types').D1Database; NATIVE_OWNER_EMAIL?: string; FCM_SERVICE_ACCOUNT?: string };
}
