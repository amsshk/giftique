# Giftique website on the Oracle host

This runs the Next.js server on `127.0.0.1:3000`. Configure a separate HTTPS
hostname in your existing proxy or Cloudflare tunnel to forward to that port.
Keep ERPNext's port 8080 as its own service.

Create `.env.production` in the repository root on Oracle (do not commit it):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
PROXC_URL=http://host.docker.internal:8080
PROXC_API_KEY=YOUR_API_KEY
PROXC_API_SECRET=YOUR_API_SECRET
```

The PROXC API key belongs to a dedicated ERPNext user with the `Giftique Staff`
or `Giftique Owner` role. Keep the secret on the server only. The published
Supabase role metadata must designate website users as `owner` or `staff`.

Build and start:

```bash
docker compose --env-file .env.production -f deploy/compose.yml up -d --build
curl -fsS http://127.0.0.1:3000/api/proxc-health/
```

Verify sign-in and management data from the HTTPS website. Do not route public
traffic to port 3000 until the HTTPS hostname and PROXC API account work.
