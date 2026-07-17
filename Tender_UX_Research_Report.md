# Tender Opportunity Systems: A UI/UX Research Report

**Prepared for:** Qellal — Ethiopian tender aggregation platform
**Focus:** User interface and user experience of e-procurement / tender-discovery systems
**Date:** 17 July 2026
**Scope:** Pain points, user-centered design best practices, accessibility & information architecture, comparative platform review, modern interaction patterns, and actionable recommendations — grounded in the low-bandwidth, mobile-heavy Ethiopian market Qellal serves.

---

## Executive Summary

Tender and e-procurement platforms are, almost universally, hard to use. The strongest single piece of evidence in this report comes from the Government of Canada's own usability study of its procurement portal: in baseline testing, only **11% of small suppliers could complete a basic tender search** and just **6% could find the statement of work**. A redesign built on plain language, a single search box, scannable summaries, faceted filters, and the removal of PDFs raised those figures to **58% and 79%** — a four-to-thirteen-fold improvement driven entirely by UX changes, not new data. That study is the template for this report's recommendations.

Across the leading platforms — TED (EU), SAM.gov (US), Contracts Finder / Find a Tender (UK), GeBIZ (Singapore), and 2merkato (Ethiopia) — the same failure patterns recur: cluttered pages and information overload, procurement jargon, critical details buried in poorly-named PDFs, powerful-but-unintuitive search, painful registration and onboarding (SAM.gov's UEI transition is the textbook case), and keyword-alert systems that generate both noise and misses. The platforms that have modernized (TED's 2024 redesign, SAM.gov's consolidation, the UK's 2025 register-once Central Digital Platform, GeBIZ's Tender Lite) are all converging on the same model Qellal is building: **match opportunities to a saved profile and notify the user**.

One premise in the original brief needs correcting. **2merkato is not missing notifications** — as of 2024–25 it offers category- and region-based email alerts and mobile push, and its app has 50,000+ downloads at 4.4 stars. Qellal's real opening is not the *presence* of alerts but their *quality and reliability*: 2merkato's documented weaknesses are buggy search, broken in-page links, no copy/PDF export, an aging UI, and opaque paid gating. Qellal wins by doing notification relevance, search, and mobile performance demonstrably better — and by leaning on **Telegram**, which is uniquely dominant and data-light in Ethiopia.

The Ethiopian context sharpens every design decision. Internet penetration is roughly **21%**, smartphone ownership near **15%**, **3G is the realistic network baseline** (98% coverage vs. 33% for 4G), and affordability of devices and data is the top adoption barrier. This mandates an offline-capable, text-first, aggressively performance-budgeted product (target under ~170 KB critical path, under 5 s time-to-interactive on 3G), localized in Amharic (Ethiopic script, left-to-right), with flat navigation for first-time internet users.

The report closes with a prioritized set of recommendations organized around Qellal's discover → qualify → prepare → track journey, each tied to a sourced best practice.

---

## 1. Context and Method

Qellal aggregates Ethiopian tender notices from newspapers, newsletters, and government portals (including the national e-Procurement portal, egp.gov.et), and pushes relevant opportunities to companies and NGOs via email and Telegram. It is an MVP built by a small team on a zero-budget stack (Next.js + Supabase + Python scrapers), targeting a mobile-first, low-bandwidth audience, and positioning itself against the incumbent **2merkato** on user experience and notification quality.

This report was produced by fanning out five parallel research streams — pain points, design best practices, platform comparison, interaction patterns, and emerging-market context — each fetching primary sources (government usability studies, GOV.UK and US design-system guidance, W3C/WCAG standards, Nielsen Norman Group and Baymard Institute research, GSMA and DataReportal statistics, and platform documentation). Claims were cross-checked and conflicting or unverifiable items are flagged in the text. All sources are listed in Section 9 with URLs.

---

## 2. Common UI/UX Pain Points in Existing Tender Systems

### 2.1 Information overload and clutter

The dominant complaint across every platform is that tender interfaces overwhelm users. The Government of Canada study attributed task failure directly to "a lot of information, cluttered pages difficult to scan, technical terminology and jargon," and to "link splatter" — too many links pulling users away from their task. Homepage "canned searches" returned large volumes of expired opportunities and award notices, and tender summaries made it hard to separate relevant detail from noise. The EU Parliament's own SME briefing and the OECD's procurement work echo this: undue complexity in registering, finding, and bidding measurably lowers small-supplier participation.

### 2.2 Critical information buried in PDFs

In the Canada study, crucial details were locked inside PDF attachments with filenames meaningless to users. Removing PDFs — surfacing the key facts as scannable HTML — was named a top driver of the success-rate improvement. 2merkato users report the same class of problem from the opposite direction: no copy-text option and no PDF export, so they cannot easily extract the information they came for.

### 2.3 Powerful but unintuitive search

TED's search is described as "powerful but not always intuitive," and results appear only in the original publication language, forcing cross-border bidders to search in multiple languages. SAM.gov's keyword search is limited enough that GSA has publicly named improving it (adding any/all/exact-match modifiers and AND/OR operators) a top priority — an implicit admission it wasn't there. 2merkato's app historically shipped without search at all; when search was added, 2025 reviews report it as buggy ("the list of tender titles doesn't match what's inside when you open them").

### 2.4 Registration and onboarding friction

This is the single largest cluster of documented complaints, and SAM.gov is the cautionary tale. The April 2022 switch from DUNS to the Unique Entity Identifier (UEI) produced "substantial verification and validation delays." Trivial data mismatches — a comma in a business name, a differently formatted suite number, an address document over five years old — push entity validation into manual queues that take days or weeks. Registration requires a notarized letter plus separate Login.gov identity verification, and full registration is widely reported to take two to four weeks (practitioner estimates range up to 30 days; treat as a range, not an SLA). GeBIZ imposes its own friction: a paid annual Trading Partner subscription (~SGD 800/yr), CorpPass digital identity, and a 3–5 business-day wait before a supplier can bid.

### 2.5 Keyword alerts that both flood and miss

Keyword-based tender alerts rely on exact matches or simple Boolean logic, so a search for "IT support" misses a tender titled "digital service desk provision" — generating false negatives — while broad configurations produce "hundreds of notifications arriving daily," causing alert fatigue where users disengage entirely. TED compounds coverage gaps by indexing only above-threshold contracts, systematically excluding the below-threshold opportunities most relevant to SMEs.

### 2.6 Migration and reliability disruption

Large platform migrations repeatedly break the user experience. TED's mandatory October 2023 move to eForms made data more machine-readable but arguably harder for humans to read, fragmenting specifications across many form sections; old eNotices notices were not migrated. SAM.gov's UEI transition caused an "influx in civilian help desk tickets due to unclear instructions." The UK Public Procurement Review Service logged recurring "technical issue with e-portal" concerns across multiple annual reports.

**A note on evenhandedness:** Contracts Finder (UK) is a partial counter-example — several sources describe it as the *more* SME-accessible UK service, with milder complaints centered on process and eligibility rules than on interface failure. And for GeBIZ, independent usability critiques are thin in public sources; its weaknesses are inferred largely from the official rationale for its own modernization drive.

---

## 3. Best Practices for User-Centered Design in Procurement Workflows

### 3.1 Start with user needs and iterate in small releases

The UK's foremost government design principle is to start with real user needs identified through research, "because what they ask for isn't always what they need." GOV.UK principles 5 and 8 stress releasing a minimal service early and iterating alpha → beta → live, because iteration "reduces risk" and converts big failures into small lessons. This directly supports Qellal's incremental, one-slice-at-a-time build discipline. The US Web Design System adds a fourth principle especially relevant to an aggregator handling money decisions: **earn trust** — clearly identify the source and authority of every tender, and present it consistently and securely.

### 3.2 Consistency lowers the learning curve

Reusing the same language and design patterns across a service reduces cognitive load and helps users get familiar quickly; deviate only when user needs genuinely differ. For Qellal this means one tender-card pattern, one filter pattern, and one notification pattern used everywhere.

### 3.3 Form design for complex flows

Where Qellal collects structured input (subscription preferences, saved-search criteria, future bid data), GOV.UK's evidence-based patterns apply. Ask **one thing per page** for complex flows — it "is less disorientating for users and reduces the cognitive load" and makes error recovery easier. Fix the order, type, and number of questions *before* reaching for a progress indicator. Validate **inline, after the user leaves a field**, never as they type. Make error messages explicit, human-readable, polite, precise, and constructive, and avoid piling on redundant indicators (asterisk + red outline + message). Reduce load through chunking, sensible defaults, minimizing required input, and clear labels.

### 3.4 Plain language, even for specialists

GOV.UK content design cites research that even highly educated specialist readers prefer plain English (80% preferred clear English; 97% preferred "among other things" over "inter alia"). Aim for roughly a reading age of nine; technical procurement terms are permitted but must be explained on first use. This matters doubly for Qellal, whose audience includes first-time internet users.

### 3.5 The aggregator pattern is validated precedent

SAM.gov's modernization — opt-in alerts when new opportunities match a saved search, natural-language search, and modular agile releases — is the same "match to a profile and notify" model Qellal is building via email and Telegram. Qellal is not inventing an unproven pattern; it is applying a government-validated one to an underserved market.

---

## 4. Accessibility, Information Architecture, and User Journey Mapping

### 4.1 Accessibility: target WCAG 2.2 Level AA

Level AA is the near-universal regulatory baseline (Section 508 in the US, EN 301 549 in the EU) and the right target for Qellal. Text contrast must be at least **4.5:1** (3:1 for large text); UI components and graphics need **3:1**. Several new WCAG 2.2 AA criteria bear directly on a tender product:

- **Redundant Entry (3.3.7):** don't ask for the same information twice in a process — auto-populate or let users reselect. This favors the UK's register-once approach.
- **Accessible Authentication (3.3.8):** ban puzzle- or recall-only logins. This actively supports Qellal using email/Telegram magic-link style access over memorized passwords.
- **Target Size (2.5.8):** interactive targets need at least 24×24 CSS px (mobile UX research pushes this to ~44 px for thumb use).
- **Focus Not Obscured (2.4.11):** keep sticky headers/footers from hiding the focused field — a common mobile-form defect.
- **Dragging Movements (2.5.7):** provide a non-drag alternative for any drag interaction.

Beyond WCAG, plain language and keyboard operability are foundational, and for Ethiopia the Ethiopic (Ge'ez) script must render correctly — it is **left-to-right**, an abugida of 250+ syllable characters, so no bidirectional/RTL layout work is needed, but a well-hinted Ethiopic web font must be chosen and tested with mixed Amharic + Latin strings at 375 px.

### 4.2 Information architecture: faceted search done right

Nielsen Norman Group's faceted-search framework is the reference. Distinguish **filters** (narrow an existing set) from **facets** (structured attributes), and make categories **appropriate, predictable, jargon-free, and prioritized** — order the most decision-influential facets first. For tenders the high-value facets are **sector/category, submission deadline, region, buyer/agency, and contract value**. Offer domain-specific facets, not just generic ones; NN/g finds specialized sites win precisely because they expose the niche filters users need. Show a **result count next to each option** ("Construction (34)") — Baymard calls this one of the single highest-impact filter improvements — and never let a filter combination silently dead-end at zero results; offer a recovery path ("No tenders match. Try removing a filter.").

### 4.3 User journey mapping: discover → qualify → prepare → submit → track

18F recommends journey mapping to get a "bird's-eye view" of interactions, emotions, successes, and pain points, and to expose hand-offs across systems. Qellal's journey has five stages, each with a design implication:

1. **Discover** — a tender reaches the user via Telegram/email alert or by browsing. Design implication: relevance of alerts and scannability of the list.
2. **Qualify** — the user decides whether the tender is worth pursuing. Design implication: surface deadline, buyer, sector, and value *above the fold*, in plain language, without opening a PDF.
3. **Prepare** — the user gathers documents and drafts a bid (largely off-platform for an aggregator). Design implication: make it trivial to save, share, and export the tender detail (the exact thing 2merkato users complain they cannot do).
4. **Submit** — handled on the source portal (e.g., egp.gov.et). Design implication: link out cleanly and reliably (2merkato's broken in-page links are a documented failure here).
5. **Track** — the user monitors deadlines and outcomes. Design implication: saved tenders, deadline reminders, and status.

Apply **progressive disclosure** throughout: show primary options by default and reveal advanced facets, full tender text, and secondary actions on demand, rather than dumping every field up front.

---

## 5. Comparative Review of Leading Tender Platforms

### 5.1 Summary comparison

| Platform | Owner / Region | Cost to search | Registration to bid | Saved search & alerts | Mobile | Notable modernization |
|---|---|---|---|---|---|---|
| **TED** (Tenders Electronic Daily) | EU Publications Office | Free | N/A (bidding on member-state systems) | Email search & notice alerts via "My dashboard" | Responsive web | Jan 2024 redesign; eForms migration |
| **SAM.gov** | US GSA / IAE | Free | Yes — entity registration in SAM | Multiple saved searches + email alerts; "follow" opportunities | Responsive web | FBO → beta.SAM → SAM.gov merge (2021) |
| **Contracts Finder / Find a Tender** | UK Cabinet Office | Free | Yes — register once on the Central Digital Platform | Saved searches + email alerts | Responsive GOV.UK web | Central Digital Platform, Feb 2025 (Procurement Act 2023) |
| **GeBIZ** | Singapore Ministry of Finance | Free browse | Yes — paid Trading Partner sub (~SGD 800/yr) + CorpPass | Portal / account notifications | Web portal | Tender Lite + Supplier File Repository (2024) |
| **2merkato** | eBiz Online Solutions PLC (Ethiopia) | Freemium — paid for full access (**price unverified**) | Account (email or phone) | Category/region email + mobile push | iOS + Android apps (offline access) | Mobile apps; multilingual (Amharic / English / Oromo) |

### 5.2 Platform notes

**TED (EU).** The official EU procurement bulletin, run by the Publications Office. Strengths: authoritative EU-wide coverage, genuinely powerful multilingual full-text and expert search, open data/API, auto-translation, and free access. Weaknesses: the 2024 eForms migration made notices more machine-readable but harder for humans to read (specifications fragment across many sections); search is powerful but not intuitive; results appear in the original language; and only above-threshold contracts are indexed, a coverage gap for SMEs. Notifications are account-based email alerts via "My dashboard."

**SAM.gov (US).** The consolidated federal System for Award Management (successor to FBO.gov). Strengths: one portal for opportunities, entity registration, and awards; a robust multiple-saved-search and email-alert system; free. Weaknesses: widely perceived as hard to use ("most small business contractors get frustrated"); selecting a domain after other filters can wipe prior selections; keyword search is limited; and the UEI registration transition was a documented disaster of delays and support tickets. The lesson for Qellal: **registration friction and destructive filter behavior are the fastest ways to lose SME users.**

**Contracts Finder / Find a Tender (UK).** Two complementary Cabinet Office services — Contracts Finder for lower-value opportunities (SME-oriented), Find a Tender for higher-value notices. Strengths: free and open, no registration to browse, strong award-history transparency, and — since February 2025 — a register-once Central Digital Platform where a supplier's profile carries across every procurement (a direct application of WCAG's Redundant Entry principle). Weaknesses: two separate services confuse users about where to look, the new One Login registration adds an onboarding step, and split coverage forces SMEs to monitor both. This is the model Qellal should emulate on data unification and register-once.

**GeBIZ (Singapore).** A mature, end-to-end government portal (discover → download → bid → award → contract management). Strengths: full lifecycle in one place, internationally open under the WTO GPA, and an active modernization drive — Tender Lite (2024) reduced contract conditions for tenders under S$1M to improve SME access, and a Supplier File Repository lets suppliers upload company documents once and reuse them. Weaknesses: registration friction (paid subscription, CorpPass, multi-day wait); independent UX complaints are thin in public sources. The takeaway: even well-run public systems are actively working to **reduce repeated data entry and bid complexity** — validating Qellal's simplicity-first thesis.

**2merkato (Ethiopia) — the incumbent.** Ethiopia's largest business portal (owner: eBiz Online Solutions PLC), aggregating tender notices from newspapers, organization sites, and direct postings, sorted by category, company, newspaper, and region. Strengths: dominant local coverage; genuine multilingual support (Amharic, English, Oromo) — a major localization advantage; low signup barrier (phone or email); web plus iOS/Android apps with offline access; 50,000+ Android downloads at ~4.4 stars; and a ~10-year track record. **It does have notifications** — category/region email alerts plus mobile push — so the brief's premise that it "lacks notifications" is inaccurate as of 2024–25. Documented weaknesses (from Play Store reviews): historically no search, later added but buggy; broken/inactive external links inside tender pages; no copy-text and no PDF export; a UI that "needs work"; weaker coverage of tenders sold via liaison offices outside Addis; and opaque pricing (the subscription page is a client-side JS app that returns no readable content, so exact prices could not be verified — treat any specific figure as unverified until confirmed directly with eBiz).

### 5.3 What this means for Qellal

Qellal's differentiation is not "we have alerts" — the incumbent already does. It is **executing the fundamentals better than a distracted incumbent**: relevant, low-noise notifications; fast, accurate search; scannable tender detail with working links and one-tap export/share; a clean mobile-first UI; and transparent pricing. Every one of 2merkato's documented weaknesses is a concrete, addressable feature gap.

---

## 6. Modern Interaction Patterns to Adopt

### 6.1 Search and filtering

Use **instant filtering on desktop** but a **batched "Show X results" apply button on mobile**, with the count updating live so users know what they are committing to before tapping. Allow **multi-select within a category** (checkboxes: OR within a facet, AND across facets) — Baymard found forcing single-selection causes abandonment. **Persist filter and sort state in the URL** so it survives back-navigation (a common frustration when users drill into a tender and return). Keep the filter trigger **sticky** during scroll, label it "Filter" or "Refine" rather than a cryptic icon, and size tap targets at ~44 px.

### 6.2 Mobile faceted search

Present facets as a **full-screen or bottom-sheet drawer overlaid on the results**, keeping some results visible behind it so users see the effect of each change (NN/g's "tray" pattern), rather than pogo-sticking to a separate filter screen. Collapse long or lower-priority filter groups into **accordions**, keeping key ones (region, deadline) expanded, and offer search-within-a-list for long option sets like agencies. This matters directly given Qellal's mandate to test at 375 px before desktop.

### 6.3 Notifications and digests — Qellal's core feature

Let users choose **alert frequency** (instant / daily / weekly digest). Batching improves email open rates and reduces unsubscribes; offering the choice is the primary lever against alert fatigue. Default to sending **only alerts that match the user's saved criteria**, and let them opt into anything broader. Design digest emails as a **single column**, each tender summarized in two or three lines (title, buyer, deadline) with one clear "View tender" call to action, on a predictable schedule. Use in-app notification banners sparingly. For **Telegram** specifically — Qellal's workhorse free channel — respect rate limits (roughly 30 messages/second in bulk, one per second per chat), queue with exponential backoff on HTTP 429 "retry_after," and provide an easy `/stop` opt-out. Telegram opt-out is free and instant, unlike SMS — a real advantage for a zero-budget product.

### 6.4 Personalization

Place personalized "recommended for you" content **high on the page** — NN/g found personalized sections positioned low become "basically worthless" because users don't scroll to them. State the data source for credibility ("Based on your saved searches"), split recommendations into clearly labeled categories, and let user feedback update recommendations immediately.

### 6.5 Mobile responsiveness and low-bandwidth performance

Set and enforce a **performance budget**: under ~170 KB of critical-path resources (compressed) and under 5 s Time to Interactive on real-world 3G and a low-end device, checked in CI (Lighthouse / bundlesize). Complement with a **data-light Progressive Web App** and service-worker caching (cache-first for static assets, network-first or stale-while-revalidate for tender data). Twitter Lite, a PWA, loaded in under 3 s on 2G with up to 70% data savings — the target class of result for Qellal.

---

## 7. Emerging-Market Context: Designing for Ethiopia

Every recommendation above must survive Ethiopian conditions. Internet penetration is roughly **21%** (about 28.6 million users, January 2025), smartphone ownership is near **15%** with a severe gender gap (18% of men vs. 6% of women), and while there are 85 million cellular connections, many are voice/SMS-only. **3G is the realistic baseline** — 98% population coverage versus 33% for 4G. Data has become relatively affordable (roughly US$0.68/GB in 2023, down ~70% since 2017), but **device cost is the dominant affordability barrier**, and roughly 70% of covered Ethiopians still don't use mobile internet — a demand-side "usage gap" driven by affordability, skills, and relevance. (Several figures here — the 15% smartphone rate especially — come from GSMA-derived secondary sources and should be treated as approximate.)

Three design consequences follow. First, **Telegram is the right notification channel**: Ethiopia is a global outlier where Telegram leads for channels and broadcast, and it is markedly more data-light than alternatives — though the Telegram-vs-WhatsApp "most popular" claim is genuinely contested in the sources, so Qellal should keep email as a parallel channel. Second, design for **first-time internet users and lower digital literacy** (Ethiopia's #2 adoption barrier): flat navigation, plain Amharic/English, icons alongside text, and guided first-use, following Microsoft Research's text-light UI findings. Third, build **offline-first** (Google's "Build for Billions" guidance): assume connectivity that drops WiFi → 3G → 2G → offline, cache aggressively, lazy-load, optimize images hard, and expose data-use controls.

On the supply side, Ethiopia now has a live national **e-Procurement portal** (egp.gov.et, run by the Public Procurement Authority) — piloted in 2021, expanded in 2023 to 74 federal agencies, with 19,000+ registered suppliers and 150+ active tenders at a time. This is Qellal's primary structured data source and the "submit" destination its journey should link to cleanly. (Commonly cited market-size figures such as "$9B annually" come from a commercial blog, not an official statistic, and should be flagged as indicative.)

---

## 8. Actionable Recommendations for Qellal

Organized by the discover → qualify → prepare → track journey and prioritized for an MVP.

**Notifications (highest-leverage differentiator).**
Beat 2merkato on relevance and reliability, not mere existence. Let users subscribe by category, keyword, and region; default alerts to their saved criteria only; offer instant / daily-digest / weekly-digest frequency. Ship Telegram broadcast plus an email digest, respecting Telegram rate limits with backoff and a `/stop` opt-out. Move beyond brittle exact-keyword matching where feasible (synonyms/related terms) so "IT support" also catches "digital service desk."

**Search and discovery.**
Provide a single, prominent search box and domain-specific facets: sector/category, deadline, region, buyer/agency, and contract value. Show result counts per facet, never dead-end at zero results, persist filter state in the URL, and use the mobile tray pattern with a batched "Show results" button. Avoid 2merkato's documented search bugs by testing that list titles always match their detail pages.

**Tender detail (the qualify + prepare stages).**
Surface deadline, buyer, sector, and value above the fold in plain language — do not force users into a PDF to learn the basics (the Canada study's biggest single win). Guarantee working outbound links to the source/submission portal, and provide one-tap **copy, share, and export/save** — directly fixing 2merkato's most-cited gaps.

**Accessibility and content.**
Target WCAG 2.2 AA: 4.5:1 text contrast, visible unobscured focus, ~44 px tap targets, no password-recall barriers (use magic-link/Telegram auth). Write in plain Amharic and English, explain any procurement term on first use, and ship a properly hinted Ethiopic font tested at 375 px.

**Performance and reach.**
Enforce a performance budget (<170 KB critical path, <5 s TTI on 3G) in CI. Build as an offline-capable PWA with service-worker caching, lazy loading, and hard image optimization. Design flat, icon-supported navigation and a guided first-use flow for first-time internet users.

**Trust and transparency.**
Label the source and publication date of every tender (USWDS "earn trust"). Make pricing transparent from day one — 2merkato's opacity is a reputational gap Qellal can own. Register-once for saved preferences (avoid redundant entry), following the UK Central Digital Platform model.

**Process (how to build it).**
Follow the government-validated approach: research real Ethiopian bidder needs before building filters; release a minimal service and iterate; reuse one consistent card/filter/notification pattern; and journey-map the five stages to find pain points before they ship. The Canada study proves that disciplined UX work on the *same underlying data* can lift task success four- to thirteen-fold — which is precisely the wedge Qellal has against the incumbent.

---

## 9. Sources

All URLs accessed 17 July 2026. Source strength is noted where relevant.

**Pain points and government usability research**
- Government of Canada — Electronic Procurement research summary (primary; quantified task-success study): https://design.canada.ca/research-summaries/electronic-procurement-research-summary.html
- European Parliament — SME access to public procurement briefing (2018): https://www.europarl.europa.eu/RegData/etudes/BRIE/2018/618990/IPOL_BRI(2018)618990_EN.pdf
- OECD — Digital Transformation of Public Procurement (2025): https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/06/digital-transformation-of-public-procurement_90ace30d/79651651-en.pdf
- U.S. GAO — award-eligibility data quality report (GAO-26-107466): https://www.gao.gov/products/gao-26-107466
- Crowell — SAM UEI transition registration delays: https://www.crowell.com/en/insights/client-alerts/sam-transition-to-uei-plagued-with-registration-processing-delays
- APEX NorCal — SAM.gov entity validation delays: https://www.apexnorcal.org/2022/05/31/sam-gov-entity-validation-processing-delays/
- GFOA — SLFRF recipients SAM.gov issues: https://www.gfoa.org/slfrf-recipients-still-experiencing-sam.gov-issues
- PilieroMazza — SAM.gov verification requirement: https://www.pilieromazza.com/new-verification-requirement-for-sam-gov-now-applies-to-existing-entities/
- Winvale — entity validation changes / help-desk load: https://info.winvale.com/blog/entity-validation-changes-in-sam.gov
- Commercial Consulting — over-reliance on keyword alerts: https://www.commercial-consulting.co.uk/post/over-reliance-on-manual-searches-and-email-notifications
- Commercial Consulting — filtering large volumes of tenders: https://www.commercial-consulting.co.uk/post/filtering-large-volumes-of-tender-information-efficiently
- UK Public Procurement Review Service progress reports (2021-22, 2023-24): https://www.gov.uk/government/publications/mystery-shopper-progress-reports/public-procurement-review-service-progress-report-2023-24-html

**Design best practices, accessibility, IA, journey mapping**
- GOV.UK Government Design Principles: https://www.gov.uk/guidance/government-design-principles
- GOV.UK — one thing per page: https://designnotes.blog.gov.uk/2015/07/03/one-thing-per-page/
- GOV.UK Design System — question pages: https://design-system.service.gov.uk/patterns/question-pages/
- GOV.UK Service Manual — form structure: https://www.gov.uk/service-manual/design/form-structure
- GOV.UK content design — writing for GOV.UK: https://www.gov.uk/guidance/content-design/writing-for-gov-uk
- GOV.UK Design System — notification banner: https://design-system.service.gov.uk/components/notification-banner/
- U.S. Web Design System — design principles: https://designsystem.digital.gov/design-principles/
- 18F — journey mapping method: https://guides.18f.gov/methods/decide/journey-mapping/
- W3C WAI — what's new in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- W3C — Understanding Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- W3C — Ethiopic Layout Requirements (elreq): https://www.w3.org/TR/elreq/
- Nielsen Norman Group — web form design: https://www.nngroup.com/articles/web-form-design/
- NN/g — form error guidelines: https://www.nngroup.com/articles/errors-forms-design-guidelines/
- NN/g — reduce cognitive load: https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/
- NN/g — progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- ICF — GSA SAM.gov modernization case study: https://www.icf.com/clients/technology/gsa-iae-sam-gov-modernization

**Platform comparison**
- TED (official): https://ted.europa.eu/en/ and "Welcome to the new TED": https://ted.europa.eu/en/news/welcome-to-the-new-ted
- European Commission — Tenders Electronic Daily overview: https://single-market-economy.ec.europa.eu/single-market/public-procurement/digital-procurement/tenders-electronic-daily_en
- TenderWolf — TED knowledge base (strengths/weaknesses): https://tenderwolf.com/en/knowledge-base/ted-european-publication/
- SAM.gov opportunities: https://sam.gov/opportunities
- FederalSchedules — beta.SAM → SAM.gov merge: https://gsa.federalschedules.com/resources/out-with-the-beta-in-with-the-new-sam-gov/
- FederalFiling — SAM.gov search usability: https://www.federalfiling.com/navigate-sam-search-gov/
- GOV.UK — Contracts Finder: https://www.gov.uk/contracts-finder and Find a Tender: https://www.find-tender.service.gov.uk/Search
- GOV.UK — Central Digital Platform / enhanced Find a Tender guide: https://www.gov.uk/government/publications/procurement-act-2023-short-guides/buyers-and-suppliers-how-to-use-the-central-digital-platform-the-enhanced-find-a-tender-service-html
- GeBIZ (official): https://www.gebiz.gov.sg/ and Tender Lite supplier guide: https://www.gebiz.gov.sg/docs/SUPPLIER_Guide_Tender_Lite_2025_1.pdf
- Centre for Public Impact — GeBIZ case: https://centreforpublicimpact.org/public-impact-fundamentals/gebiz-government-e-procurement-system-in-singapore/
- 2merkato — About: https://www.2merkato.com/59-about-2merkatocom and tender service: https://tender.2merkato.com/
- 2merkato Tenders — Google Play (reviews): https://play.google.com/store/apps/details?id=com.ebiz.tender&hl=en
- 2merkato Tenders — Apple App Store: https://apps.apple.com/us/app/2merkato-tenders/id6739552012

**Interaction patterns, personalization, performance**
- Baymard Institute — ecommerce filter UI: https://baymard.com/learn/ecommerce-filter-ui
- NN/g — filter categories and values: https://www.nngroup.com/articles/filter-categories-values/
- NN/g — filters vs. facets: https://www.nngroup.com/articles/filters-vs-facets/
- NN/g — applying filters: https://www.nngroup.com/articles/applying-filters/
- NN/g — mobile faceted search: https://www.nngroup.com/articles/mobile-faceted-search/
- NN/g — recommendation guidelines: https://www.nngroup.com/articles/recommendation-guidelines/
- NN/g — alert fatigue: https://www.nngroup.com/videos/alert-fatigue-user-interfaces/
- NN/g — smart-home notifications (relevance/timeliness): https://www.nngroup.com/articles/smart-home-notifications/
- Telegram Bot FAQ (rate limits): https://core.telegram.org/bots/faq
- web.dev — performance budgets 101: https://web.dev/articles/performance-budgets-101
- web.dev — Progressive Web Apps (Twitter Lite data savings): https://web.dev/explore/progressive-web-apps

**Ethiopia / emerging-market context**
- DataReportal — Digital 2025: Ethiopia: https://datareportal.com/reports/digital-2025-ethiopia
- GSMA — Mobile Economy Sub-Saharan Africa 2024: https://event-assets.gsma.com/pdf/GSMA_ME_SSA_2024_Web.pdf
- Birr Metrics — Ethiopia mobile gender gap / smartphone access: https://birrmetrics.com/ethiopia-narrows-mobile-gender-gap-to-24-but-smartphone-access-for-women-remains-just-6/
- Google — Build for Billions (Android): https://developer.android.com/docs/quality-guidelines/build-for-billions
- Microsoft Research — UIs for low-literate users: https://www.microsoft.com/en-us/research/project/uis-low-literate-users/
- Quartz Africa — Telegram in Ethiopia: https://qz.com/africa/1214381/
- Sagaci Research — Telegram in Ethiopia: https://sagaciresearch.com/preferred-social-media-and-communication-apps-across-africa-what-makes-telegram-a-success-in-ethiopia/
- U.S. Dept. of Commerce (trade.gov) — Ethiopia e-procurement platform: https://www.trade.gov/market-intelligence/ethiopia-e-procurement-platform-provides-easy-access-public-tenders
- Ethiopia e-GP portal: https://production.egp.gov.et/

---

*Verification notes: 2merkato's exact subscription pricing could not be confirmed (client-side pricing page returns no readable content) — treat any figure as unverified. The premise that 2merkato "lacks notifications" is inaccurate as of 2024–25; it offers email and push alerts. Ethiopian smartphone-penetration (~15%) and Telegram data-usage figures rely on secondary/GSMA-derived sources and are approximate. The "$9B" Ethiopian procurement market size is from a commercial source, not official. NN/g percentage claims circulating in third-party blogs were not independently verified; only the qualitative NN/g guidance is cited.*
