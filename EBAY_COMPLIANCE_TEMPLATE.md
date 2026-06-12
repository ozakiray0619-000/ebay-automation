# eBay Production Keyset 申請 — Compliance Questionnaire 英文回答テンプレ

> **使い方**: <https://developer.ebay.com/> で Production Keyset を申請する際に
> 表示される Compliance Questionnaire の各項目に、下記英文をコピペで貼り付けてください。
> Reject の主要因は「データ取扱いの不明瞭」「商業利用範囲が広すぎる」の2点なので、
> **"単一販売者の社内ツール" "PII最小限" "第三者共有なし"** を明確に書いています。

---

## Application Overview

```
A back-office automation tool for a single eBay seller. It periodically retrieves
order information and Best Offer events using the seller's own authorized credentials
(OAuth 2.0 for REST APIs, Auth'n'Auth token for Trading API), translates English
product titles into Japanese, and posts notifications to a private Discord channel
operated by the seller. There is no resale of data, no multi-tenant use, no public
exposure of any retrieved information.
```

---

## Q1. What is the primary use case of your application?

```
Order management and buyer contact retrieval for a single seller (B2B internal tool).
The seller uses the data to fulfill orders, respond to buyer inquiries promptly,
and translate English product information into Japanese for internal reference.
```

---

## Q2. Which eBay APIs do you plan to use?

```
- Sell Fulfillment API (REST) — retrieving order details for the authenticated seller
- Trading API (GetBestOffers only) — retrieving incoming Best Offer events
```

---

## Q3. Which OAuth scopes will you request?

```
- https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly
  (read-only access to the authenticated seller's order data)

Trading API uses Auth'n'Auth token (not OAuth scopes).
```

---

## Q4. Where will the application be hosted?

```
Google Apps Script (Google Workspace) — server-side execution runs on Google's
managed infrastructure. The application has no public-facing UI other than a
single OAuth consent landing page accessible only via a private URL shared
with the seller.
```

---

## Q5. How will eBay data be stored?

```
Retrieved order and offer data are written to a private Google Sheets workbook
owned by the seller's Google Workspace account. Encryption at rest is provided
by Google Workspace (AES-256). Access is restricted to the seller's account only.
No data is stored outside Google Workspace.
```

---

## Q6. What is your data retention policy?

```
Order and offer records are retained for 90 days after business processing is
complete. Records older than 90 days are deleted by an automated retention job.
Logs are auto-rotated and capped at 1,000 rows (oldest entries deleted first).
```

---

## Q7. Will eBay data be shared with any third parties?

```
No. eBay data is accessed only by the seller. The Discord notification channel
is private and operated by the seller; only the seller and explicitly invited
internal staff have access to it. No data is sold, syndicated, or shared with
any external party.
```

---

## Q8. How do you handle Personally Identifiable Information (PII)?

```
PII collected is limited to the minimum necessary for order fulfillment:
buyer username, buyer's shipping address, and contact email/phone as provided
by eBay's order response. PII is never logged in plain text outside the
Google Sheet. PII is purged on the 90-day retention boundary together with
the parent order record.
```

---

## Q9. What security measures are in place?

```
- All API credentials (App ID, Cert ID, Dev ID, OAuth refresh token, Auth'n'Auth
  token) are stored in Google Apps Script PropertiesService (Script Properties),
  not in source code.
- OAuth 2.0 is used for REST API access; tokens are refreshed per-request and
  never exposed to the client.
- Source code is version-controlled in a private Git repository.
- The Google Sheet is accessible only via the seller's Google Workspace account.
- HTTPS is enforced for all eBay API calls and Discord webhook calls.
```

---

## Q10. How often will you call eBay APIs?

```
- Sell Fulfillment API: once every 5 minutes (288 calls/day, well within rate limits)
- Trading API GetBestOffers: once every 5 minutes (288 calls/day)
Initial fetch on first run retrieves the last 7 days of orders, after which only
new records (deduplicated by order ID and offer ID) are processed.
```

---

## Q11. Marketplace(s) of operation

```
ebay.com (US) [or ebay.co.jp depending on client answer to intake item 1]
Single marketplace, single seller account.
```

---

## Q12. Will the application be used by multiple end users?

```
No. The application serves a single seller. There is no user registration,
no multi-tenant configuration, no public sign-up flow.
```

---

## Reject 回避のチェックポイント（自分用）

| ありがちな Reject 理由 | 本テンプレでの対応 |
|---|---|
| 「複数販売者の代行ツール」と誤解される | "single seller" "B2B internal tool" を冒頭から明記 |
| 「データを第三者と共有」と疑われる | Q7 で明確に "No" + Discord は private と明記 |
| 「PII を保存し続ける」と疑われる | Q6 / Q8 で 90日保持 + 自動削除を明記 |
| 「scope が広すぎる」と判定される | `sell.fulfillment.readonly` のみ要求と明示 |
| 「セキュリティ設計が不明」と評価される | Q9 で credentials 保管・HTTPS・暗号化を具体記載 |

---

## 申請後のステータス追跡

1. 申請完了画面で表示される **Application ID** をスクショ保存
2. <https://developer.ebay.com/my/keys> の Production 列でステータス確認可
3. 通常 3〜5 営業日で `Approved` / `Needs more info` のメール到着
4. `Needs more info` の場合は質問項目に上記テンプレの該当箇所をベースに追記回答

---

## 言語ポリシー

回答は**必ず英語で**。日本語回答は審査官が翻訳ツールを通すため意図が伝わりにくくなる。
本テンプレはそのまま英文として通る粒度に揃えてあるので、コピペ→送信で完結します。
