# Tech Stack & Tools — Qellal

## Stack
- **Frontend:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS (utility classes; design tokens in `tailwind.config`)
- **Backend/DB/Auth:** Supabase — PostgreSQL, Auth, Row Level Security. Region: **EU (Frankfurt)** (closest to Ethiopia)
- **Scrapers:** Python 3.11+, `requests`, `beautifulsoup4` — live in `/scrapers`, run via GitHub Actions cron every 4–6 hours
- **Notifications:** Telegram Bot API (primary), Resend or Brevo for email (digest default)
- **Hosting:** Vercel free tier (Git push = deploy)
- **Scheduling:** GitHub Actions cron (scrapers + hourly notification matcher)

## Setup Commands
```bash
# Web app
npx create-next-app@latest qellal --typescript --tailwind --app
cd qellal && npm install @supabase/supabase-js @supabase/ssr
npm run dev        # develop
npm run lint       # check
npm run build      # verify before commit

# Scrapers
cd scrapers && python -m venv .venv && source .venv/bin/activate
pip install requests beautifulsoup4 python-dotenv
```

## Environment Variables (`.env.local` — NEVER commit)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server/scrapers only — never expose to browser
TELEGRAM_BOT_TOKEN=
RESEND_API_KEY=              # or BREVO_API_KEY
```

## Database Schema (create via Supabase dashboard or SQL editor)
```sql
create table categories (
  id serial primary key,
  name text not null,
  slug text unique not null
);

create table tenders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category_id int references categories(id),
  region text,
  publishing_entity text,
  published_date date,
  deadline date not null,            -- deadline-forward: always required
  source_name text not null,        -- legal: attribution always
  source_url text,
  status text not null default 'pending_review'
    check (status in ('pending_review','published','rejected')),
  created_by text not null default 'scraper',
  created_at timestamptz default now()
);
create index on tenders (status, published_date desc);
create index on tenders (deadline);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  role text not null default 'user' check (role in ('user','staff','admin')),
  plan text not null default 'free',           -- month-6 payments hook
  telegram_chat_id text,
  email_notifications boolean default true,
  telegram_notifications boolean default false,
  digest_mode boolean default true,            -- protects free email tier
  created_at timestamptz default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  category_id int references categories(id),
  keyword text,
  region text,
  created_at timestamptz default now()
);

create table notifications_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tender_id uuid not null references tenders(id) on delete cascade,
  channel text not null check (channel in ('email','telegram')),
  sent_at timestamptz default now(),
  unique (user_id, tender_id, channel)          -- dedup at the DB level
);
```

## RLS Baseline (enable RLS on every table)
- `tenders`: SELECT where `status='published'` for everyone; full access for role in ('staff','admin')
- `profiles`: users SELECT/UPDATE own row only
- `subscriptions`: users full CRUD on own rows only
- `notifications_sent`: insert via service role only; users SELECT own rows

## Example Component (project style)
```tsx
// components/TenderCard.tsx — server-renderable, lightweight, deadline-forward
import Link from "next/link";

type Tender = {
  id: string; title: string; region: string | null;
  deadline: string; source_name: string;
};

export function TenderCard({ tender }: { tender: Tender }) {
  const daysLeft = Math.ceil(
    (new Date(tender.deadline).getTime() - Date.now()) / 86_400_000
  );
  return (
    <Link href={`/tenders/${tender.id}`}
      className="block rounded-lg border p-4 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">{tender.title}</h3>
        {/* Deadline badge: the user's #1 anxiety — always visible */}
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs
          ${daysLeft <= 3 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
          {daysLeft}d left
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {tender.region ?? "Ethiopia"} · Source: {tender.source_name}
      </p>
    </Link>
  );
}
```

## Error Handling Pattern
```ts
// Never swallow errors. Surface them, log them, give the user a way forward.
const { data, error } = await supabase
  .from("tenders").select("*").eq("status", "published");

if (error) {
  console.error("tenders fetch failed:", error.message);
  // UI: render an error state with a retry button — never a blank page
  return <ErrorState message="Couldn't load tenders." retryHref="/" />;
}
```

## Naming Conventions
- Components: `PascalCase.tsx` · hooks: `useThing.ts` · utils: `camelCase.ts`
- DB: `snake_case` tables/columns · Routes: kebab-case URLs
- Python scrapers: `scrape_<source>.py`, one source per file
- Booleans read as questions: `digest_mode`, `email_notifications`
