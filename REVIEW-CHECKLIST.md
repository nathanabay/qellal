# REVIEW-CHECKLIST.md — Run Before Marking Any Feature Done

## Every feature
- [ ] `npm run lint` and `npm run build` pass
- [ ] Works on mobile viewport (375px) — tested BEFORE desktop
- [ ] Loading, empty, and error states exist (no blank screens, no swallowed errors)
- [ ] No `any` types introduced; no secrets in code
- [ ] Verified with a concrete manual check; result logged in `MEMORY.md` Done Log
- [ ] Committed with a clear message

## Data & security (when touching DB/auth)
- [ ] RLS policy exists and was tested with a non-admin account
- [ ] Pending-review tenders are invisible to the public
- [ ] Users can only read/write their own profile & subscriptions

## Notifications (when touching alerts)
- [ ] Dedup check against `notifications_sent` works (no double alerts)
- [ ] Unsubscribe/pause path works in one click (email link + bot /stop)
- [ ] Digest mode respected; instant mode only when user chose it

## Accessibility (target: WCAG 2.1 AA)
- [ ] Text contrast ≥ 4.5:1 (normal) / 3:1 (large & UI) — run the token contrast check
- [ ] Every image has alt text; decorative elements are `aria-hidden`
- [ ] Every input/select/button has an accessible name (label or `aria-label`)
- [ ] Keyboard-navigable: visible focus, skip-to-content link works

## Performance (Ethiopia reality)
- [ ] Page usable in <3s on Chrome DevTools "Slow 3G" throttling
- [ ] No heavy new dependencies; images compressed

## Before deploy/launch
- [ ] End-to-end journey: browse → sign up → subscribe → alert arrives → open tender
- [ ] SPF/DKIM configured for email domain
- [ ] Analytics events firing (signup, subscription created, notification click)
- [ ] Security pass: env vars only, RLS reviewed, admin routes role-gated
