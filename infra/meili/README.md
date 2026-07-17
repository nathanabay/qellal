# Meilisearch deploy (Qellal)

> Run these **on the VPS** (159.69.240.169). **Rotate the root password first** —
> it was shared in plaintext and must be treated as compromised. Ideally create a
> non-root sudo user + SSH key and disable password login.

## 1. Harden

```bash
passwd                                   # set a NEW root password
ufw allow 22 && ufw allow 443 && ufw --force enable
```

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

## 3. Deploy the stack

```bash
mkdir -p /opt/meili && cd /opt/meili
# copy docker-compose.yml + Caddyfile here (e.g. scp from repo infra/meili/)
export MEILI_MASTER_KEY="$(openssl rand -base64 48 | tr -d /=+ | cut -c1-40)"
echo "MEILI_MASTER_KEY=$MEILI_MASTER_KEY" > .env
echo ">>> SAVE THIS MASTER KEY (server-only, never in the app/repo): $MEILI_MASTER_KEY"
docker compose up -d
```

Verify (self-signed cert, so `-k`):

```bash
curl -sk https://159.69.240.169/health      # -> {"status":"available"}
```

## 4. Create scoped keys

```bash
# search-only key (for the app's server-side queries)
curl -sk -X POST 'https://159.69.240.169/keys' \
  -H "Authorization: Bearer $MEILI_MASTER_KEY" -H 'Content-Type: application/json' \
  -d '{"description":"qellal-search","actions":["search"],"indexes":["tenders"],"expiresAt":null}'

# admin key (for reindex + admin hooks)
curl -sk -X POST 'https://159.69.240.169/keys' \
  -H "Authorization: Bearer $MEILI_MASTER_KEY" -H 'Content-Type: application/json' \
  -d '{"description":"qellal-admin","actions":["documents.*","indexes.*","settings.*","tasks.get"],"indexes":["tenders"],"expiresAt":null}'
```

Copy each response's `"key"` value.

## 5. Set env (NOT on the VPS — in Vercel + GitHub Actions secrets, and `.env.local` for dev)

- `MEILI_HOST=https://159.69.240.169`
- `MEILI_SEARCH_KEY=<search key from step 4>`
- `MEILI_ADMIN_KEY=<admin key from step 4>`
- `MEILI_INSECURE_TLS=1`  ← interim only; drop once a domain + public cert exist

## 6. Populate the index

From the repo (with the env above plus Supabase creds):

```bash
cd scrapers && npm ci && npm run reindex
# -> Reindex complete: ~7500 documents.
```

## Later: add the domain

1. DNS A record `search.<domain>` → 159.69.240.169
2. In `Caddyfile`, replace `159.69.240.169` with `search.<domain>` and delete the
   `tls internal` line; `docker compose restart caddy`.
3. Set `MEILI_HOST=https://search.<domain>` and remove `MEILI_INSECURE_TLS`.
