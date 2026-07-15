# Product Requirements — Qellal MVP (from PRD)

## Primary User Story
Selam, a procurement officer (28–45, beginner-to-intermediate tech level, comfortable with Telegram and email), must check newspapers, newsletters, and portals daily and still misses deadlines. She browses Qellal without signing up, signs up to save filters ("construction, Addis Ababa"), connects the Telegram bot, and gets an alert within an hour of a matching tender being published — a week before its deadline.

## Must-Have Features (all P0)

### 1. Tender Listings
Feed aggregated from scrapers + manual admin entry. Fields: title, category, region, publishing entity, published date, deadline, description, source.
- ✅ Browsable without an account
- ✅ Deadline prominent; sorted by recency by default
- ✅ Source attribution on every listing

### 2. Search & Filtering
Keyword search + category, region, deadline-range filters.
- ✅ Filters combinable
- ✅ Results <3 seconds
- ✅ Works on mobile

### 3. User Accounts & Subscription Preferences
Email signup/login; users pick categories/keywords and channels.
- ✅ Signup <2 minutes
- ✅ Add/edit/remove categories & keywords anytime
- ✅ Password reset works

### 4. Notifications (Email + Telegram) — THE DIFFERENTIATOR
Alert on category/keyword match; daily digest option.
- ✅ Delivered within 1 hour of publish
- ✅ Pause/unsubscribe in one click
- ✅ Telegram connect works for non-technical users

### 5. Admin Panel
Manual entry, scraped-item review queue, edit/remove, roles.
- ✅ Publish a tender in <3 minutes
- ✅ Scraped items reviewed before going live
- ✅ Role-based access (admin vs data-entry staff)

## NOT in MVP (do not build)
Payments/subscriptions (month 6 — Chapa + Telebirr), SMS, WhatsApp, native apps, bookmarks/bid tracking, company profiles/analytics.

## Success Metrics
- **Primary:** 300 signups in 30 days (placeholder target); 60% of signups subscribe to ≥1 category by day 30
- **Secondary:** 40% WAU by month 3; 50+ tenders/week published; 25%+ notification CTR
- **Instrument these:** signup event, subscription-created event, notification-click event

## Design Vibe
Modern, clean, simple, fast. Mobile-first. Zero clutter. **Deadline-forward** — deadlines are the user's #1 anxiety; make them visually prominent everywhere.

## Constraints
- 6–8 weeks; $0/month free tiers; <3s loads on 3G; works on 3-year-old Android
- Legal: attribute + link every source; scrape public notices only
- Quality bar: no placeholder content at launch; features complete or cut; unreliable notifications are worse than none
