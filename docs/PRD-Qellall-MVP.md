# Product Requirements Document: Qellal MVP

## Overview

**Product Name:** Qellal
**Problem Statement:** Tender notices in Ethiopia are scattered across newspapers, newsletters, and government portals. Existing platforms (2merkato) have no notification system, so companies and NGOs miss tender deadlines and lose business opportunities.
**MVP Goal:** Launch a free tender aggregation platform that beats 2merkato on user experience, with a notification system as the key differentiator.
**Target Launch:** 6–8 weeks from development start

---

## Target Users

### Primary User Profile
**Who:** Companies and NGOs across Ethiopia that bid on tenders — small contractors, suppliers, consultancies, and large NGOs
**Problem:** They must manually check multiple newspapers, newsletters, and portals daily; deadlines get missed
**Current Solution:** 2merkato (paid, no notifications), physical newspapers, word of mouth
**Why They'll Switch:** Free for 6 months, cleaner/faster UI, and alerts (email + Telegram) so they never miss a relevant tender

### User Persona: Selam
- **Demographics:** 28–45, Addis Ababa or regional cities, procurement/business development officer
- **Tech Level:** Beginner to intermediate — comfortable with Telegram and email, less so with complex web tools
- **Goals:** Find every relevant tender in her sector before the deadline, with minimal daily effort
- **Frustrations:** Checking multiple sources daily; discovering tenders after deadlines; cluttered existing platforms

---

## User Journey

### The Story
Selam hears about Qellal from a colleague. She lands on a clean listings page and browses current tenders **without signing up**. She finds it faster and better organized than 2merkato. She signs up to save her filters (e.g., "construction, Addis Ababa"). She subscribes to categories and keywords and connects the Telegram bot. Two days later, a matching tender is published — she gets a Telegram alert within the hour, opens the detail page, and prepares her bid a week before the deadline. She tells two colleagues.

### Key Touchpoints
1. **Discovery:** Word of mouth, Telegram groups, LinkedIn/Facebook business groups
2. **First Contact:** Public listings page — browsable without an account
3. **Onboarding:** Sign up → pick categories/keywords → choose notification channel(s)
4. **Core Loop:** Notification arrives → click through → read tender details → act
5. **Retention:** Reliable, relevant alerts; zero missed deadlines

---

## MVP Features

### Core Features (Must Have)

#### 1. Tender Listings
- **Description:** Browsable feed of tender notices aggregated from scrapers (newsletters + official portals) and manual entry by employees. Each listing: title, category, region, publishing entity, published date, deadline, description, source.
- **User Value:** One place for all tenders instead of many scattered sources
- **Success Criteria:**
  - Users can browse listings without an account
  - Listings show deadline prominently and are sorted by recency by default
  - Every listing has a source attribution
- **Priority:** Critical

#### 2. Search & Filtering
- **Description:** Keyword search plus filters for category, region, and deadline range
- **User Value:** Find relevant tenders in seconds
- **Success Criteria:**
  - Users can combine keyword + category + region filters
  - Results load in under 3 seconds
  - Filters work on mobile
- **Priority:** Critical

#### 3. User Accounts & Subscription Preferences
- **Description:** Email-based sign up/login. Users select categories and keywords they care about and choose notification channels.
- **User Value:** Personalized alerts; saved preferences
- **Success Criteria:**
  - Sign up in under 2 minutes
  - Users can add/edit/remove categories and keywords anytime
  - Password reset works
- **Priority:** Critical

#### 4. Notifications (Email + Telegram)
- **Description:** When a new tender matches a user's categories/keywords, send an alert via email and/or Telegram bot (user's choice). Digest option (daily) to avoid spam.
- **User Value:** The core differentiator — never miss a relevant tender
- **Success Criteria:**
  - Matching alerts delivered within 1 hour of a tender being published
  - Users can pause or unsubscribe in one click
  - Telegram bot connect flow works for a non-technical user
- **Priority:** Critical

#### 5. Admin Panel
- **Description:** Internal dashboard for employees to add tenders manually, review/approve scraped tenders, and edit or remove listings
- **User Value:** (Internal) Guarantees data quality and coverage where scrapers fail
- **Success Criteria:**
  - Employee can publish a tender in under 3 minutes
  - Scraped items enter a review queue before going live
  - Role-based access (admin vs. data-entry staff)
- **Priority:** Critical

### Future Features (Not in MVP)
| Feature | Why Wait | Planned For |
|---------|----------|-------------|
| Payments & subscriptions (Chapa + Telebirr) | Free period first; validate demand | Month 6 |
| SMS notifications | Gateway costs money; email + Telegram cover most users | Fast-follow after launch |
| WhatsApp notifications | Business API costs + approval process | Fast-follow / v2 |
| Native mobile apps | Responsive web/PWA covers mobile at launch | v2 |
| Saved/bookmarked tenders, bid tracking | Nice-to-have; not core to differentiation | v2 |
| Company profiles / tender analytics | Beyond MVP scope | v2 |

---

## Success Metrics

### Primary Metrics
1. **Signups: 300 in the first 30 days** (adjustable target)
   - How to measure: Auth provider / analytics dashboard
   - Why it matters: Free-period growth is the whole strategy — signups are the funnel top

2. **Notification adoption: 60% of signups subscribe to at least one category by day 30**
   - How to measure: Database query / analytics event
   - Why it matters: Notifications are the differentiator; adoption proves the value proposition

### Secondary Metrics
- Weekly active users: 40% of signups by month 3
- Tenders published: 50+ per week (coverage credibility)
- Notification click-through rate: 25%+

---

## UI/UX Direction

**Design Feel:** Modern, clean, simple, fast
**Inspiration:** 2merkato's simplicity — but decluttered, mobile-first, and faster

### Key Screens
1. **Home / Listings**
   - Purpose: Browse and filter all tenders (public, no login required)
   - Key Elements: Search bar, category/region/deadline filters, tender cards with deadline badges
   - User Actions: Search, filter, open tender, sign-up prompt

2. **Tender Detail**
   - Purpose: Full tender information
   - Key Elements: Title, entity, category, region, deadline countdown, description, source link
   - User Actions: Read, share, (v2: bookmark)

3. **Sign Up / Login**
   - Purpose: Fast account creation
   - Key Elements: Email + password, minimal fields
   - User Actions: Register, login, reset password

4. **Notification Preferences**
   - Purpose: The differentiator's control center
   - Key Elements: Category picker, keyword input, channel toggles (email/Telegram), digest vs. instant, Telegram connect button
   - User Actions: Subscribe, edit, pause, unsubscribe

5. **Admin Dashboard** (internal)
   - Purpose: Data entry and moderation
   - Key Elements: Add-tender form, scraped-items review queue, listings table with edit/delete
   - User Actions: Create, approve, edit, remove tenders

### Design Principles
- **Mobile-first:** Most Ethiopian users will arrive on phones — design for small screens, then scale up
- **Zero clutter:** Every screen has one clear job; no ads, no noise
- **Deadline-forward:** Deadlines are the user's #1 anxiety — make them visually prominent everywhere

---

## Technical Considerations

**Platform:** Responsive web app (PWA-ready) covering desktop + mobile
**Responsive:** Mobile-first
**Performance Goals:**
- Load time: < 3 seconds on 3G/4G connections common in Ethiopia
- Works on 3-year-old Android devices
- Lightweight pages (low data usage matters to users)

**Security/Privacy:** Standard auth (hashed passwords / managed auth provider), HTTPS everywhere, minimal personal data collected (email, phone optional)
**Scalability:** Free tiers must handle ~1,000 users and ~5,000 listings in the first 6 months; architecture should allow adding a payments/subscription layer at month 6 without a rewrite (e.g., a `plan` field on user accounts and gated features behind a single access check)

**Browser/Device Support:**
- Chrome, Safari, Firefox (latest)
- Android 10+, iOS 14+
- Tablet optimized: Yes (responsive)

---

## Constraints & Requirements

### Budget
- Development tools: $0/month (free tiers only)
- Hosting/Infrastructure: $0/month during free period
- Third-party services: $0/month (free email tier + free Telegram bot API)
- **Total:** $0/month until month 6; then hosting + SMS + payment gateway fees apply

### Timeline
- MVP Development: 6–8 weeks
- Beta Testing: 1–2 weeks (friends, colleagues, 5–10 target businesses)
- Launch Target: Within 2 months of starting

### Technical Constraints
- Free-tier limits (database rows, emails/month, bandwidth) must be monitored
- Scrapers depend on source site structures — pair with manual entry as a fallback
- Builder is learning while building — prefer well-documented, AI-assistant-friendly tools

---

## Open Questions & Assumptions
- **Open:** Exact signup target (300 is a placeholder — set your own number)
- **Open:** Legality/copyright of republishing tender notices in Ethiopia — verify before launch; always attribute sources
- **Open:** Telebirr developer/merchant onboarding requirements — confirm with official sources well before month 6
- **Assumption:** Email + Telegram reach the majority of target users; SMS/WhatsApp deferred without major churn risk
- **Assumption:** 2merkato will not ship notifications before Qellal launches
- **Assumption:** Employees are available for daily manual data entry during the free period

---

## Quality Standards

**Code Quality:**
- Use TypeScript when possible — it catches errors early
- Handle errors explicitly — don't hide them
- Test the important paths (signup → subscribe → notification delivery) before launch

**Design Quality:**
- Use consistent colors and spacing (design tokens)
- Test on mobile before desktop
- Check accessibility basics (contrast, labels)

**What This Project Will NOT Accept:**
- Placeholder content ("Lorem ipsum") at launch
- Features that half-work — complete or cut
- Skipping mobile testing
- Launching notifications that are unreliable — a broken differentiator is worse than none

---

## Risk Mitigation

| Risk | Impact | Mitigation Strategy |
|------|--------|-------------------|
| Scrapers break when source sites change | High | Manual-entry admin panel is a first-class feature, not a fallback afterthought |
| Free-tier limits hit (emails, DB rows) | Medium | Daily digest option reduces email volume; monitor usage monthly; Telegram is unlimited/free |
| Low notification adoption | High | Prompt channel setup during onboarding; make Telegram connect one-tap |
| 2merkato copies the notification feature | Medium | Move fast; win on UX + free period; build user loyalty early |
| Republishing legality challenge | Medium | Attribute all sources; link to originals; get legal clarity during free period |
| Beginner builder gets blocked | Medium | Choose beginner-friendly stack with strong docs; use AI coding tools; cut scope, not quality |

---

## MVP Completion Checklist

### Development Complete
- [ ] All 5 core features working
- [ ] Basic error handling
- [ ] Mobile responsive
- [ ] Cross-browser tested

### Launch Ready
- [ ] Analytics configured (signups, notification subscriptions, CTR)
- [ ] Basic SEO setup (tender pages indexable)
- [ ] Contact/support method (email or Telegram)
- [ ] Privacy policy & terms

### Quality Checks
- [ ] Friends & family + 5–10 real businesses tested
- [ ] Core journey works end-to-end: browse → sign up → subscribe → receive alert → open tender
- [ ] No critical bugs
- [ ] Performance acceptable on mobile data

---

## Next Steps

1. **Immediate:** Review and approve this PRD
2. **Next:** Create Technical Design Document (Part 3) — stack choice, data model, notification architecture
3. **Then:** Set up development environment
4. **Build:** Implement with AI assistance
5. **Test:** Beta with 10–20 target users
6. **Launch:** Go live!

---
*Created: July 15, 2026*
*Status: Ready for Technical Design*
