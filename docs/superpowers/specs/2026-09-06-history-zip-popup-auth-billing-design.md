# Viscue History ZIP, Popup Navigation, Authentication, and Billing Design

**Date:** 2026-09-06
**Status:** Approved for implementation planning

## Objective

Make saved workspaces portable and exactly restorable, turn the popup's decorative slider into real Home/Settings navigation, complete the extension-initiated authentication handoff, and repair plan upgrades so they reach a protected pricing page and Dodo checkout. Preserve the logo-derived radius system already applied to the History surface and other cards and controls.

## Scope

This change covers:

- ZIP export and ZIP import from the History panel.
- Exact restoration of nodes, edges, positions, media, document derivatives, and gesture operations.
- History panel radius consistency.
- Popup Home/Settings navigation and all visible settings actions.
- Adjacent-tab extension authentication, tab cleanup, and popup reopening.
- Extension-flow gating for authentication pages.
- Race-safe sign-out that cannot show a stale email.
- Protected plan selection, Dodo checkout initiation, and customer-portal access.

It does not redesign the workspace model, replace Supabase, change plan prices or allowances, or automatically confirm a financial transaction.

## 1. History ZIP Package

### Package layout

Exports use the filename `viscue-workspace-<ISO timestamp>.zip` and contain:

```text
viscue-workspace-<timestamp>.zip
├── manifest.json
├── workspace.json
└── assets/
    └── <sha256>.<extension>
```

`manifest.json` identifies the package as Viscue, declares `formatVersion: 1`, records the export timestamp, and includes an integrity digest for `workspace.json`. `workspace.json` holds the complete workspace snapshot. Data-URL media found anywhere in the snapshot is deduplicated by content hash, stored under `assets/`, and replaced in the JSON with an explicit Viscue asset reference. Remote URLs remain unchanged.

The archive implementation uses a maintained browser-compatible ZIP library. The library is loaded in the extension bundle; export and import do not require a server.

### Export behavior

The Export action on a History entry packages only that selected snapshot. It does not include other History entries or extension/account settings. Export shows a busy state, downloads one ZIP, and reports a clear error if packaging or download fails.

### Import behavior

History Import accepts `.zip` files. Import performs these checks before changing state:

1. The archive is readable and within configured compressed/uncompressed size limits.
2. Required files exist.
3. The manifest identifies Viscue and uses a supported format version.
4. The workspace digest matches.
5. Asset paths stay inside `assets/`; absolute and traversal paths are rejected.
6. Referenced assets exist and decode successfully.
7. The hydrated snapshot satisfies the workspace contract.

On success, the reconstructed snapshot is inserted at the top of History with a new local History ID and import timestamp while retaining its original workspace content and export metadata. The user then selects Restore. Restore uses the existing `hydrateWorkspace` boundary, producing the same nodes, edges, positions, media and gesture operations as the exported snapshot.

Import failures leave current workspace and History unchanged. Legacy loose JSON import is removed from the History import action; ZIP is the supported portable format.

## 2. Logo-Derived Radius System

The main logo has an approximately 22% rounded-square corner profile. UI components use a semantic scale instead of applying a literal percentage to rectangles:

- Large surfaces and dialog shells: 24px.
- Standard cards and nested panels: 18px.
- Standard action buttons: 14px.
- Compact and small icon buttons: 10px.
- True toggles, status pills, progress indicators, and intentionally circular controls remain pill-shaped or circular.

The History shell, retention card, entries, restore/export/delete actions, close action, popup settings cards, and web account/auth cards remain on this scale. Responsive History layouts must not override the shell with smaller arbitrary radii.

## 3. Popup Home and Settings Navigation

`StandardPopup` owns an explicit `activeView: 'home' | 'settings'` state. The white slider below the cue count becomes a two-position segmented control with visible Home and Settings labels. Its thumb position and `aria-pressed`/tab semantics represent the active view.

- Selecting Home renders usage, plan summary, and cue count.
- Selecting Settings renders the settings surface.
- The header gear and plan label select Settings.
- The Settings close action and Home segment return to Home.
- The large slider no longer reads or mutates auto-submit.

Auto-submit remains an independent switch within Settings and persists through `viscue-auto-submit`. Its label, checked state, storage value, and workspace behavior must agree.

All popup actions expose loading and error feedback and prevent duplicate requests while an operation is running.

## 4. Adjacent-Tab Authentication

### Launch

The background worker identifies the active source tab and creates the authentication tab in the same window at `sourceTab.index + 1`. The tab is active and uses the existing OAuth 2.1 PKCE/state request. The popup may close naturally when focus moves to the new tab.

### Route gating

`/connect` remains the only entry point for extension authentication. It validates the registered client, Chromium redirect URI, response type, PKCE challenge, state, and scope. A valid request establishes a short-lived, HttpOnly, same-site extension-flow cookie bound to the OAuth state.

`/login`, `/signup`, and verification continuation pages render authentication UI only when the extension-flow cookie and sanitized `/connect` continuation agree. Direct navigation or a typed domain without a live flow shows the Extension Required surface and cannot submit an auth action for that flow. The cookie expires quickly and is consumed when authorization completes.

This gate prevents normal direct access and cross-flow reuse. It is not presented as proof that arbitrary non-browser clients cannot imitate a public OAuth client.

### Completion

Password login, Google login, and signup all return to the validated `/connect` continuation. For the first-party Viscue client, authorization continues without an extra redundant consent click. The Chromium callback is observed by the background worker, the authorization code is exchanged with the original PKCE verifier, and the local extension session is saved.

After a session is established, the worker closes the auth/callback tab IDs, marks onboarding complete, and invokes `chrome.action.openPopup()`. If signup requires email verification, the adjacent tab remains on a verification-required state until verification produces a real session; it does not claim completion or close early.

Cancellation, tab closure, invalid state, token-exchange failure, and timeout clean up listeners and return an actionable error without opening a falsely authenticated popup.

## 5. Race-Safe Account and Sign-Out State

The popup account controller uses a monotonically increasing request generation. Each summary fetch captures the current generation and may update UI only if it is still current.

Sign-out performs these steps:

1. Enter `signing-out`, increment the generation, and clear the rendered summary.
2. Clear the local extension session before awaiting remote logout.
3. Mark `viscue_force_login` for the next sign-in.
4. Attempt Supabase server logout with the captured former token as best effort.
5. Resolve to a locked signed-out view.

`account-get` first requires a valid extension access token. Without one it returns an explicit signed-out result and never returns cached profile data. Consequently, an older in-flight account response cannot restore the previous email after logout. A new summary fetch begins only after a new session is saved.

## 6. Protected Pricing and Dodo Billing

The missing protected `/account` route is restored as the pricing and subscription-management page. Opening a plan from the popup sends the selected plan in the `billing-open` message. The background worker opens `/account?plan=plus#plans` or `/account?plan=pro#plans` in an adjacent tab.

The account page requires a current web session, displays the user's current allowance and subscription, highlights the selected plan, and requires an explicit Continue to checkout action. Continue performs the existing authenticated `POST /api/billing/checkout` call and navigates to the secure Dodo payment link returned by the server.

The Free/current-plan action does not create a checkout. Paid users receive Manage plan, which calls `POST /api/billing/portal` and navigates to the Dodo customer portal for cancellation, downgrade, invoices, or payment-method management. A signed-out billing launch first enters the extension authentication flow and then returns to the requested protected account URL.

The UI distinguishes unauthorized, configuration, network, and provider failures. It never silently opens a 404 page and never treats opening checkout as payment confirmation.

## 7. Components and Boundaries

- `workspaceHistoryModel.mjs`: versioned package model, archive naming, snapshot externalization/rehydration, and validation results.
- `App.jsx`: user-gesture orchestration, download/import file handling, atomic History update, and toasts.
- `WorkspaceChrome.mjs` / CSS: History interaction states and semantic radii.
- Popup view/controller modules: Home/Settings state, request generations, action loading/errors, and plan-specific messages.
- `session.mjs`: adjacent-tab OAuth lifecycle, listener cleanup, code exchange, and local session semantics.
- `background.js`: source-tab placement, popup reopening, authenticated account reads, and plan/portal routing.
- Web middleware/flow helpers: extension-flow cookie creation and validation.
- Auth pages/actions: guarded continuation and automatic return to `/connect`.
- `/account` and `AccountDashboard`: protected pricing confirmation, Dodo checkout, and portal entry.

Pure transformation and decision logic stays outside React components so it can be tested without browser mocks.

## 8. Error Handling and Security

- ZIP import is atomic and bounded against zip bombs, path traversal, unsupported versions, missing assets, and malformed workspace data.
- OAuth state, PKCE verifier, flow cookie, and requested continuation remain bound to one attempt.
- Redirects accept only sanitized local paths or registered Chromium callback URLs.
- Auth listeners are removed on success, cancellation, timeout, and error.
- Popup async responses are generation-checked to prevent stale UI writes.
- Checkout product IDs are selected server-side; the client sends only `plus` or `pro`.
- Payment confirmation continues to come from verified Dodo webhook events, not browser redirects.

## 9. Verification Strategy

Automated coverage includes:

- ZIP export/import round-trip equality with duplicated data URLs and mixed asset types.
- Corrupt archives, unsupported versions, traversal paths, missing assets, invalid hashes, and oversize packages.
- Imported History insertion and Restore hydration.
- Semantic History/popup/web radii.
- Home/Settings segmented-control behavior and auto-submit independence.
- Every settings action, loading state, and error state.
- Adjacent auth-tab index/window placement.
- Callback success, cancellation, timeout, listener cleanup, tab closure, and popup reopening.
- Direct auth-route rejection and valid flow continuation.
- Sign-out versus stale account-response race.
- Plan-specific billing routing, protected account access, checkout creation, and customer portal creation.

Final verification runs the focused tests, complete extension and web test suites, production builds, and browser checks for popup Home/Settings, History, guarded auth entry, protected pricing, and error overlays. Existing unrelated failures are reported separately and are not hidden.

## Acceptance Criteria

1. History cards and actions use the approved radius scale at every supported viewport.
2. Exporting one History item downloads a ZIP containing only that workspace and its required assets.
3. Importing that ZIP adds a valid History item whose Restore result equals the exported workspace.
4. The popup slider switches between Home and Settings and no longer controls auto-submit.
5. Every visible settings control has a verified effect and visible failure state.
6. Authentication opens in the adjacent tab, completes in that tab, closes it after a real session exists, and reopens the popup.
7. Directly typed auth URLs cannot show or submit the extension auth forms without a live extension flow.
8. Signing out cannot display the former email again from an in-flight or cached response.
9. Plus/Pro reaches the protected pricing confirmation and then a valid Dodo checkout; Manage plan reaches the Dodo portal.
10. No billing action resolves to a missing `/account` route or silent 404.
