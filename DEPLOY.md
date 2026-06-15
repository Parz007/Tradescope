# TradeScope — Deployment Guide

## Stack
- **Frontend**: React + Vite (static site) → Vercel / Netlify / Cloudflare Pages
- **Backend API**: Express 5 + Node.js → Railway / Render / Fly.io
- **Database**: PostgreSQL → Neon / Supabase / Railway
- **Telegram Bot**: Runs inside the API server process

---

## 1. Database Setup (Neon recommended — free tier)

1. Create a free database at https://neon.tech
2. Copy the connection string → set as `DATABASE_URL`
3. Run migrations:
   ```bash
   pnpm --filter @workspace/db run push
   ```

---

## 2. Backend API (Railway recommended)

1. Push this repo to GitHub
2. Create a new Railway project → "Deploy from GitHub repo"
3. Set root directory: `artifacts/api-server`
4. Set environment variables (see `.env.example`):
   - `DATABASE_URL`
   - `TELEGRAM_BOT_TOKEN`
   - `OPENROUTER_API_KEY`
   - `SESSION_SECRET`
   - `PORT=8080`
5. Railway auto-detects Node.js and runs `pnpm run build && pnpm run start`

Your API will be live at `https://your-app.railway.app`

---

## 3. Frontend (Vercel)

1. Import repo on https://vercel.com
2. Set **Root Directory** to `artifacts/tradescope`
3. Build settings:
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `dist/public`
4. Add environment variable:
   - `VITE_API_BASE_URL=https://your-api.railway.app`
5. Deploy

---

## 4. Telegram Bot Webhook (production)

After deploying the API, set the webhook:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-api.railway.app/api/bot/webhook
```

Then in `artifacts/api-server/src/bot.ts`, switch from polling to webhook mode.

---

## Local Development

```bash
# Install dependencies
pnpm install

# Copy env file
cp .env.example .env
# Edit .env with your values

# Push DB schema
pnpm --filter @workspace/db run push

# Start API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Start frontend (port 5173) — in another terminal
cd artifacts/tradescope && PORT=5173 BASE_PATH=/ pnpm run dev
```

Frontend will proxy `/api/*` requests to `localhost:8080` automatically.
