FOREXPILOT AI — LIVE DATA STARTER (not yet deployed)

WHAT THIS IS
A mobile-first PWA frontend plus a small Node.js backend proxy. The backend keeps the Twelve Data API key server-side and requests OHLC candles. The app calculates EMA 9/21, RSI(14), ATR-based illustrative SL/TP and supports a local paper-trade journal.

DATA SYMBOLS
- EUR/USD, GBP/USD, USD/JPY: Twelve Data forex coverage
- XAU/USD: precious-metal/FX feed availability must be confirmed for the user's account/plan
- QQQ and SPY: US ETF proxies, NOT the Nasdaq-100 and S&P 500 index values
- DAX is not included in this free starter because exact index coverage/rights require checking a suitable provider/plan

COST / LIMITS
Twelve Data currently lists a Basic free plan with 8 API credits/minute and 800/day; real-time forex and real-time US equities/ETFs are included. Its plan page does not grant unrestricted live index coverage. Do not assume all requested symbols are available on the free plan. Verify your account's symbol entitlements and terms.
The server caches each symbol/interval for 60 seconds. This app refreshes manually; avoid frequent polling to preserve the daily quota.

SETUP
1. Create a Twelve Data account and obtain an API key: https://twelvedata.com/
2. Install Node.js 20 or newer on a hosting server.
3. Copy .env.example to .env and replace PASTE_YOUR_KEY_HERE with your key.
4. Run: npm start
5. Host behind HTTPS (e.g. a Node-capable host with TLS). Do not expose .env or the API key.
6. Open the HTTPS URL on Android Chrome > menu > Install app / Add to Home screen.
7. Open Settings in the app; check backend health, then select an instrument and refresh.
8. Test all symbols. If provider rejects a symbol, do not assume a quote exists; choose an entitled symbol/feed.

NOT YET INCLUDED
- This package is not deployed to a public URL.
- User login, push notifications, TradingView webhook receiver, server-side trade journal, backtesting, and broker integration are not included.
- TradingView webhook alerts need a separate HTTPS endpoint. TradingView webhook docs require 2FA; use secure endpoints and never send passwords/API secrets in webhook bodies.
- No real orders are sent.

SAFETY
Paper mode only. This is a rule-based educational scanner, not a predictive AI or investment advice. No lot sizing is provided. Do not use it for live trading. Verify market-data freshness, source, symbol, spreads and contract specifications.
