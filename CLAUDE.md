# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

eBay sales automation for Japanese sellers. A Google Apps Script (GAS) application that polls eBay orders/offers every 5 minutes and writes results to Google Sheets, with Japanese translation and Discord notifications.

**Current phase:** Phase 0 — awaiting eBay Production API approval. Mock data (`MockData.gs`) is used for all testing until real credentials arrive.

## Deployment Commands

This is a GAS project deployed via [clasp](https://github.com/google/clasp) — there is no build step, no npm dependencies, and no test runner.

```powershell
# Push code to Google Apps Script (run from gas-skeleton/)
clasp push

# Force push (overwrite remote)
clasp push -f

# Open the script editor in browser
clasp open
```

The `.clasp.json` in `gas-skeleton/` already contains the `scriptId`. Never commit it (it's gitignored).

## Running / Testing

All execution happens inside the GAS environment (Google Sheets menu or script editor). There is no local test runner.

| Function to run | Purpose |
|---|---|
| `setupSheets()` | One-time sheet initialization (creates orders/offers/logs sheets) |
| `mockPollOrders()` | Test order flow with dummy data (Phase 1) |
| `mockPollOffers()` | Test offer flow with dummy data (Phase 1) |
| `pollOrders()` | Live order fetch (Phase 2+, requires credentials) |
| `pollOffers()` | Live offer fetch (Phase 2+, requires credentials) |
| `installTriggers()` | Enable 5-minute polling |
| `removeTriggers()` | Disable all triggers |

Run these from the GAS editor or the custom spreadsheet menu (`onOpen()` installs it automatically).

## Architecture

```
Config.gs          — all constants, endpoint URLs, required property keys
OAuth.gs           — eBay OAuth 2.0 (doGet web app entrypoint + token refresh)
F01_Orders.gs      — eBay REST Fulfillment API → orders sheet
F02_Translate.gs   — LanguageApp EN→JA with ScriptCache (6h TTL)
F03_Offers.gs      — eBay Trading API (XML) → offers sheet + Discord
SheetService.gs    — Sheets CRUD, idempotent setup
LogService.gs      — Structured logs → logs sheet (auto-rotates at 1000 rows)
DiscordService.gs  — Discord webhook POST
Triggers.gs        — time-based trigger installer
Menu.gs            — onOpen() custom menu
MockData.gs        — Phase 1 dummy data; reuses real append/filter logic
```

**Two separate eBay API systems:**
- REST API (OAuth 2.0) — orders via `F01_Orders.gs`, token managed by `OAuth.gs`
- Trading API (Auth'n'Auth XML) — offers via `F03_Offers.gs`, token stored directly in Script Properties

**Deduplication:** `filterUnseenOrders()` and `filterUnseenOffers()` build a `Set` from existing sheet IDs before each poll. Never write a record that already exists.

## Required Script Properties

Set these in the GAS editor (Project Settings → Script Properties):

```
EBAY_APP_ID          Client ID from eBay developer console
EBAY_CERT_ID         Client Secret
EBAY_DEV_ID          Dev ID (Trading API only)
EBAY_RU_NAME         OAuth redirect URI (= this script's web app URL)
EBAY_REFRESH_TOKEN   Obtained after completing the OAuth flow via doGet()
EBAY_AUTH_TOKEN      Trading API Auth'n'Auth token
EBAY_ENV             "SANDBOX" or "PRODUCTION"
DISCORD_WEBHOOK_URL  Discord server webhook URL
SPREADSHEET_ID       Target spreadsheet ID
```

`getProp(key)` in `Config.gs` throws if any required property is missing — check logs sheet first when a function silently fails.

## Sheet Schema

| Sheet | Key columns |
|---|---|
| **orders** | orderId, buyerUsername, lineItemId, title (JP), title (orig), quantity, price, currency, fulfillmentStatus, paymentStatus, creationDate, importedAt |
| **offers** | offerId, itemId, title (JP), title (orig), buyerUsername, offerPrice, currency, offerStatus, notifiedAt |
| **logs** | timestamp, level (INFO/WARN/ERROR), message, meta (JSON string) |

## Key Constraints

- GAS has a **6-minute execution limit** per run. `pollOrders` and `pollOffers` are designed to complete well within this; do not add synchronous loops that fetch pages indefinitely.
- Translation calls are cached (ScriptCache, 6h TTL, MD5-keyed) to avoid hitting the daily `LanguageApp` quota. Do not bypass the cache.
- `EBAY_ENV` toggles sandbox vs. production endpoints in `getEndpoints()`. Always verify this is set correctly before a production push.
- The `notifiedAt` column in the offers sheet acts as an idempotency flag — `F03_Offers.gs` skips Discord posting if the cell is already populated.
