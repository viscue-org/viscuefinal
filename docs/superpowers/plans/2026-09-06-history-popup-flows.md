# History and Popup Flows Implementation Plan

**Goal:** Complete the approved portable History, popup navigation, authentication, logout, and Dodo billing flows.
**Spec:** ../specs/2026-09-06-history-zip-popup-auth-billing-design.md
**Architecture:** Keep archive transformation independent of React. Keep authentication lifecycle in the background worker and guard web routes with an extension flow. Keep popup request ownership separate from presentation.
**Tech stack:** React, Chrome MV3, Next.js, Supabase Auth, Dodo, browser ZIP library (`fflate`).

## Constraints

Preserve existing working changes. No automatic purchase or deployment. ZIP restores complete snapshots and rejects invalid archives. History shell 24px, cards 18px, buttons 14px, compact buttons 10px. Login opens adjacent and closes only after a valid session. Logout invalidates late responses. Web authentication and pricing require an extension-initiated flow.

## Task 1: Portable History

- [x] Implement async `createHistoryExport(snapshot)` returning `{filename,mimeType,contents:Uint8Array}` and `importHistoryArchive(bytes)` returning a validated snapshot.
- [x] Package versioned manifest, workspace JSON, deduplicated media; verify hashes, size limits, graph shape and safe entry paths before hydration.
- [x] Replace folder picker with ZIP picker in App, async busy/error handling, new local History identity after import, retain approved radii.
- [x] Run round-trip, duplicate-media, corrupt archive, path traversal, version and missing-asset tests.

## Task 2: Auth lifecycle and logout

- [x] Bind auth attempt to active source tab/window and adjacent index, preserve state/PKCE, handle cancellation, timeouts and listener cleanup.
- [x] Restore source focus, close owned auth tabs and reopen popup on successful exchange. Persist pending attempt so service worker restart can recover.
- [x] Guard local session refresh/save with a logout generation; clear local session before remote logout.
- [x] Guard account reads and discard late popup responses; test login success/cancel/state errors and refresh/logout race.

## Task 3: Web auth and billing

- [x] Check installed Supabase OAuth API and documented flow before implementing continuation.
- [x] Add expiring signed extension flow cookie, exact registered redirect validation, guard auth forms/actions, preserve signup/reset/Google continuation.
- [x] Implement automatic first-party OAuth authorization completion; no token secrets in navigation URLs.
- [x] Restore protected account route, selected-plan confirmation, authenticated checkout/portal and graceful errors.
- [x] Validate Dodo request against installed SDK; tests for auth gates and correct checkout/portal calls.

## Task 4: Popup and verification

- [x] Real Home/Settings slider visible in both panels, auto-submit independent, all buttons loading/error aware and plan-specific.
- [x] Test navigation and stale summary suppression after signout.
- [x] Run extension/web suites and builds, inspect History and popup in browser, review changes and report external configuration limitations.

## Progress

All tasks 1 through 4 completed and verified:
1. Portable history ZIP package created and tested with media deduplication, checksum validation, size limits, traversal prevention, and atomic hydration in App.
2. Extension auth lifecycle bound to adjacent tabs, pending auth recovery in storage, timeout cleanup, race-safe sign-out with logout generation guard, and token-checked account reads.
3. Web auth forms and consent cards aligned to visual-first story and radius tokens; protected `/account` route restored with plan selection, checkout, and portal integration.
4. Popup segmented slider navigation implemented for Home and Settings, independent auto-submit toggle, plan-specific billing requests, and late-response suppression.
5. All 199 extension/root tests pass; all 47 web tests pass; Vite extension build and Next.js web build both compile cleanly with zero errors.
