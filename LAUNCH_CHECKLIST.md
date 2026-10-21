# Launch checklist

Things deliberately deferred until launch. Work through these before announcing marketjump.app publicly.

## Security

- [ ] **Rotate the Supabase secret key.** The current one (ending `…2u306LGP`) was exposed in a screenshot during setup on 2026-10-21.
  1. Supabase → project `ninxdugnskspyeepsvjg` → Project Settings → API Keys → Secret keys → **Create new secret key**.
  2. Vercel → project **market-jump** → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` → paste the new value (type **Secret**, **Production** only) → Save.
  3. Vercel → Deployments → latest Production → **Redeploy**, wait for Ready.
  4. Supabase → API Keys → **delete the old key**.
  5. Vercel → Settings → Cron Jobs → run `/api/judgment-day` and check the log says `"status":"ok"`.
- [ ] **Mark `FINNHUB_API_KEY` as a Secret** in Vercel (it shows "Needs Attention").
- [ ] **Tighten the notifications insert policy.** `supabase-schema-final.sql` lets any logged-in user insert notifications for any user (`with check (true)`). Move `/api/resolve` notification inserts to a service-role client first, then restrict the policy.

## Hosting

- [ ] **Delete the duplicate Vercel project `marketjump`** (no dash). The live project is **market-jump**. On 2026-10-21 it was **paused** and its Ignored Build Step set to `exit 0`, so it no longer builds or runs crons. Delete it (Settings → General, bottom) once nothing has broken for a week. To undo instead: Unpause, and clear Settings → Git → Ignored Build Step.
- [ ] Confirm `/api/judgment-day` ran successfully after a real Friday 4:30 PM ET Judgment Day (Vercel → Cron Jobs → logs).

## Data

- [ ] **Clean up unscoreable predictions.** Moves saved before the server-side price fix may have `price_at_prediction = 0` or macro tickers (OIL, GEO, CRYPTO). They're skipped by scoring, but check whether any were already scored and inflated users' stats:
  ```sql
  select count(*) filter (where price_at_prediction <= 0) as zero_price,
         count(*) filter (where ticker in ('OIL','GEO','CRYPTO')) as macro,
         count(*) filter (where resolved and price_at_prediction <= 0) as zero_price_scored
  from public.predictions;
  ```

## Product

- [ ] **Conviction multiplier** — the scoring rules call for one, but every Move currently scores a flat +50 / −20. Needs a design (how users pick conviction, multiplier values) before it can be built.
