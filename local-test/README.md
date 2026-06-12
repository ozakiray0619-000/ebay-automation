# local-test — eBayキー無しで「通知が来るか」を検証する仕組み

## これは何 / なぜ必要か

本番API審査待ち・Sandbox障害で **eBayから実データを取れない** 間も、
通知パイプライン（取得 → 重複除去 → 翻訳 → Discord通知）が
ちゃんと動くかを **ターミナルだけで** 検証するためのツールです。

仕組みはシンプルで、ローカルに「**偽eBayサーバー**」を立てて、
本物のeBayと同じ形のレスポンス（注文=REST JSON / オファー=Trading XML）を返させ、
それを Node 製のポーラーが GAS本体（`F01_Orders.gs` / `F03_Offers.gs`）と
**同じロジック・同じDiscordメッセージでDiscordへ通知**します。

```
[偽eBayサーバー] --JSON/XML--> [poller.js] --整形--> [Discord(本物)]
   eBayキー不要                GAS同等ロジック        実際に通知が飛ぶ
```

eBayの部分だけがダミーで、**ユーザーが実際に目にする「Discord通知」は本物**です。
だから「通知が来るか」をキー無しでE2E検証できます。

## 必要なもの

- Node.js（clasp用に既に入っているはず。`node -v` で確認）
- （任意）Discord Webhook URL ＝ 6/7に作った `ebay-test` のものでOK

## 使い方

### 1. Discord本送信する場合（推奨）

```powershell
cd local-test
Copy-Item config.sample.json config.json
notepad config.json   # DISCORD_WEBHOOK_URL に Webhook を貼る
.\run.ps1
```

→ Discordに「🛒 新規注文」「🎯 新規 Best Offer」が実際に届きます。

### 2. とりあえず動きだけ見る（ドライラン）

```powershell
cd local-test
.\run.ps1
```

→ Webhook未設定なら送信せず、届くはずのメッセージをコンソールに表示します。

### 3. 繰り返し（5分ポーリングの再現）

```powershell
.\run.ps1 -Loop 30      # 30秒ごと。Ctrl+Cで停止
```

### 4. 履歴をリセットして再通知

2回目以降は重複防止が効いて「新規なし」になります（＝重複防止が正しく動作）。
もう一度通知させたいときは履歴を消します：

```powershell
.\run.ps1 -Reset
```

## テストデータを変える

`scenario.json` を編集すると、任意の注文/オファーで通知テストできます。
`orderId` / `offerId` を新しい値にすれば「新規」として通知が飛びます。

## 手動で動かす（run.ps1を使わない場合）

```powershell
# 別ターミナルでサーバー起動
node mock-ebay-server.js
# もう一方でポーラー実行
node poller.js
```

## 実機(GAS)との違い

| 項目 | このローカル版 | 実機(GAS) |
|---|---|---|
| eBayデータ | 偽サーバーのダミー | 実eBay API |
| 翻訳 | 簡易辞書(デモ用) | LanguageApp(本物) |
| 重複防止 | `.state.json` | Sheetsの既存ID |
| Discord通知 | **本物** | **本物** |

→ 検証できるのは「**取得後〜通知まで**」の全工程。
残るは「eBayが実際にデータを返すか」だけで、それは審査/Sandbox復活後に
`REALTEST_RUNBOOK_sandbox.md` の手順で確認します。

## ファイル

- `mock-ebay-server.js` … 偽eBayサーバー（注文JSON / オファーXML / OAuth）
- `poller.js` … 通知パイプライン（GAS同等ロジック）
- `scenario.json` … 偽サーバーが返すダミーデータ
- `config.json` … Discord Webhook（`config.sample.json`からコピー / gitignore対象）
- `run.ps1` … ワンコマンド実行
