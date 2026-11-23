# ForexPilot AI — Master Checkpoint (23 Nov 2026)

## Purpose
Build ForexPilot AI as a complete, mobile-first trading platform—not a static demo. The target experience combines TradingView-style charting/analysis with cTrader-style trading, order-management and mobile usability.

## Core product requirements
- Mobile-first Android experience, optimized for a phone before desktop.
- Market coverage: Forex, metals (including gold), indices, crypto (where supported by reliable data feeds).
- Interactive charts with responsive zoom/pan, timeframes, candle types, indicators and drawing tools; chart UX inspired by TradingView.
- Trading functions and order management inspired by cTrader: position/order list, entry, stop-loss, take-profit, break-even, close/edit, risk controls and trade statistics. These must be backed by a real broker/API integration before they are represented as live trading.
- Market scanner and signal analysis, watchlists, account/portfolio views, risk manager and paper trading.
- Live price/event updates and push notifications that still arrive when the app is closed. This requires server-side monitoring, durable alert rules, a push provider and Android notification permission/channel configuration; a web page polling while open is not enough.
- Alert types: price crossing a level; strategy/signal events; order filled; SL/TP; break-even; risk warnings; market/news events if reliable source is integrated.
- Notifications should be concise, glanceable, actionable, tap-to-open the relevant symbol/chart/position, include sound/vibration controls, grouping/deduplication, user-defined quiet hours and priority, and avoid repeated spam. Notifications must clearly identify symbol, event, timeframe/strategy context, price and timestamp, with details available on tap.
- Security/reliability: authentication, secure server secrets, rate-limit and deduplicate events, reconnect/backoff, health/status visibility, clear data-source attribution and timestamps, audit log, and error states.
- UI preferences: compact phone UI, dark theme first but configurable, palette choices, accessible contrast, minimal taps, chart occupying the primary screen, controls organized in mobile bottom sheets/scrollable toolbars, safe-area support.
- APK distributed directly (not necessarily Play Store), with release version, installation instructions and tested build.

## Strategy foundations — four books (pending exact titles)
The strategy is intended to be grounded in four books chosen by the user. Their titles/authors have not yet been provided in this checkpoint. Do not guess or substitute books. Once supplied:
1. Extract the principles, setups, filters, risk rules and invalidation conditions from each.
2. Map them to testable rules, preserving distinctions between the books.
3. Create strategy modules with explicit inputs, outputs, confidence/quality criteria and risk limits.
4. Backtest and paper-test; do not imply profitability or guarantee results.
5. Keep signals informational until the user explicitly authorizes a real-broker execution integration.

## Notification and mobile UX research (web checked 23 Nov 2026)
Research findings used as design reference:
- cTrader mobile documents account-level push/email notification settings and price alerts with symbol, condition, target price, optional pop-up and comment; alerts can be listed and managed, and triggered alerts are one-shot. This supports a dedicated Alerts inbox, rule-management screen and clearly shown condition/price.
- cTrader documents alerts for events such as SL/TP closing positions, break-even triggers, pending orders filling, price alerts, and deposit/withdrawal events. This is a reference set, not a promise that ForexPilot has these integrations.
- Google Play listing surfaced cTrader at 4.5 stars and 30.1K reviews (listing snapshot). This is a broad rating signal only, not a detailed review analysis.
- A recent TradingView App Store review complained that a quick alert action was removed and creating basic alerts required extra navigation. Design implication: make creating an alert from the chart a one-tap/short path and keep the action visible; avoid burying it in menus. This is one user review, not a general consensus.
- cTrader update notes describe actionable notifications that navigate to the relevant screen, order-filled sound, redesigned chart-control bottom sheets and improved crosshair measurement. Design implications: tap notification to open exact context; use bottom sheets for mobile controls; provide audible order-event feedback; make chart measurement easy.
- cTrader price-alert UI lets users select symbol, Bid/Ask side, above/below condition, target price, optional pop-up and comment, and manages alerts from a central list. Use these as UX benchmarks, not copy exact UI.

## Notification concept (initial specification)
Notification title examples:
- `ForexPilot · EUR/USD · Price Alert`
- `ForexPilot · XAU/USD · Signal`
Body format: `Condition/event · price · timeframe · timestamp`
Actions (when supported by Android and app architecture): `Open chart`, `View signal`, `Manage alert`; trade-related actions must be carefully permissioned and never auto-execute solely from a notification tap.
Notification categories/channels:
1. Critical trade/account events
2. Strategy signals
3. Price alerts
4. Market/news (optional, lower priority)
Controls: per-channel enable/disable, sound/vibration, quiet hours, priority, alert expiration, repeat/cooldown, deduplication, tap destination, unread count.
Acceptance criteria: notification is generated server-side even when app is closed; delivered on a real Android device; opens the correct symbol/alert; shows correct event/price/time; respects user settings; duplicate events are suppressed; delivery failures are visible in system health.

## Existing project / last known repository state
- GitHub repository: https://github.com/giannismamos37-hash/ForexPilotAI
- Live URL: https://forexpilotai.onrender.com
- Main UI file: `index.html`
- A focused mobile CSS pass was committed on 23 Nov 2026.
- Commit: `f2f75e37586287aa02c680a389703808c0884680`
- That commit was verified on GitHub. Render deployment and real-device appearance were NOT verified at the time this checkpoint was created.

## Verified vs unverified
### Verified
- Mobile CSS update exists in GitHub main under the commit above.
- Repository and live URL are known.

### Not yet verified
- Render is serving the commit above.
- Actual phone layout and behavior.
- Full charting/trading feature parity.
- Live feeds, server-side alert engine and push delivery when app is closed.
- Broker connection, real order execution, secure account handling.
- APK release build, installation, device testing and release readiness.
- Strategy modules based on the four books (book titles still missing).

## Work sequence (do not restart; continue in order)
1. Verify Render deployment against the GitHub commit; if mismatch, diagnose deployment rather than making another blind CSS change.
2. Open and test the live site on phone; capture specific failures and fix only confirmed issues.
3. Audit current repository against the requirements above; label each feature **working / partial / demo / missing / unverified**.
4. Identify and implement backend live-data and server-side alert architecture; verify push delivery with app closed.
5. Build chart/analysis features and order-management UI; integrate a supported broker API only after the integration requirements and permissions are defined.
6. Add and test strategy modules from the user's four books once titles/source materials are supplied.
7. Implement notification UX based on 2026 references, including chart-to-alert quick path and actionable tap destinations.
8. Create Android APK build pipeline; install/test on device; verify permissions, background delivery, reconnect behavior and release artifact.
9. Final acceptance audit with a checklist and evidence. Never call the app complete until each critical feature has been tested.

## Continuity rules
- Continue from this checkpoint; do not make the user re-explain the project.
- No claims of completion without evidence.
- Separate code commit, deployment, live behavior, device test and APK release statuses.
- Prefer concrete verified work and report exactly what changed, what is confirmed, what failed and the next step.
- When user says “continue ForexPilot checkpoint,” retrieve this file and continue from the next uncompleted step.

## References (web research checked 23 Nov 2026)
- cTrader Mobile settings/alerts: https://help.ctrader.com/ctrader-mobile/interface/settings/
- cTrader Mobile price alerts: https://help.ctrader.com/ctrader-mobile/trading/price-alerts/
- cTrader Google Play listing: https://play.google.com/store/apps/details?id=com.spotware.ct
- TradingView App Store reviews page (quick-alert complaint surfaced): https://apps.apple.com/us/app/tradingview-track-all-markets/id1205990992?platform=ipad&see-all=reviews
- cTrader App Store release notes (actionable notifications, bottom sheets, crosshair): https://apps.apple.com/ne/app/ctrader-cfd-trading-charts/id767428811

## Missing input from user
Provide the exact names/authors (or upload the books) of the four books that will form the strategy foundation. This is the only strategy-source item intentionally left unresolved; do not invent it.
