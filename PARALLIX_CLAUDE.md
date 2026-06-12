# CLAUDE.md — Parallix

このファイルはClaude Code（`claude`コマンド）がParallixプロジェクトを理解するための仕様書です。
→ このファイルを `C:\Users\ozaki\OneDrive\ドキュメント\Claude\Projects\Parallix\CLAUDE.md` にコピーしてください。

## プロジェクト概要

| 項目 | 内容 |
|---|---|
| プロジェクト名 | Parallix |
| 開発者 | れい |
| 開発スタック | GitHub + Google Cloud + Stripe |

## 技術スタック

- **GitHub** — ソースコード管理・CI/CD（GitHub Actions）
- **Google Cloud** — バックエンド・インフラ（Cloud Run / Cloud SQL など）
- **Stripe** — 決済（Checkout / Billing / Webhook）

## よく使うコマンド

```powershell
# Google Cloud にデプロイ
gcloud run deploy

# Stripe CLI でWebhookをローカルでテスト
stripe listen --forward-to localhost:3000/webhook

# Git の基本操作
git add .
git commit -m "feat: ..."
git push
```

## フォルダ構成

（プロジェクト開始後に更新）

## 作業ログ

`WORK_LOG.md` を参照。
