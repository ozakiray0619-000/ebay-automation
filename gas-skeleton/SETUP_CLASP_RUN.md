# PowerShell から GAS を動かす（clasp run 有効化）— 一度きりの設定

PowerShell でコードを送って Google スプレッドシートを自動で動かすための初期設定です。
**最初の1回だけ**やればOK。以降は `.\run.ps1` だけで「送信→実行→スプレッドシート自動生成」まで走ります。

> 前提: Node.js と clasp は導入済み（未導入なら `npm install -g @google/clasp`）。
> 作業はすべて `gas-skeleton` フォルダ内で行います。

---

## なぜ設定が要るのか（1行で）

`clasp push` は「コードを送る」だけ。**送ったコードを PowerShell から実行**するには
`clasp run` を使い、そのために Apps Script を「API実行可能」にしておく必要があります。

---

## 手順

### 1. clasp にログイン（ブラウザ認証が1回開きます）

```powershell
clasp login
```

ブラウザで Google アカウントを選び「許可」。これはれいさん自身が行う認証です。

### 2. Apps Script API を ON にする

ブラウザで次を開き、トグルを **オン** にします（アカウント全体の設定、1回だけ）。

```
https://script.google.com/home/usersettings
```

### 3. スクリプトを標準 GCP プロジェクトに紐付ける

`clasp run` は標準の Google Cloud プロジェクトが必要です。次で案内に従います。

```powershell
clasp open-credentials-setup   # clasp v3 系
# もし上が無ければ:  clasp open  でエディタを開き、
# 「プロジェクトの設定 → Google Cloud Platform (GCP) プロジェクト」から標準プロジェクトに変更
```

> ここだけ少し手間ですが、GCP プロジェクト番号を Apps Script の
> 「プロジェクト設定」に貼り付ければ完了です。番号の取り方が分からなければ
> 画面のスクショを Claude に貼ってください。一緒に進めます。

### 4. API実行可能としてデプロイ

```powershell
clasp push -f
clasp deploy --description "api-exec"
```

### 5. 動作テスト

```powershell
.\run.ps1
```

`bootstrap()` が走り、スプレッドシートが自動生成され、3シート（orders / offers / logs）が
作られます。実行結果（戻り値）にスプレッドシートの URL が表示されれば成功です。

---

## 以降の使い方

| やりたいこと | コマンド |
|---|---|
| コードを送って初期化（標準） | `.\run.ps1` |
| モック注文を生成 | `.\run.ps1 mockPollOrders` |
| モックオファーを生成 | `.\run.ps1 mockPollOffers` |
| 送信せず実行だけ | `.\run.ps1 -NoPush bootstrap` |
| スプレッドシートのURL確認 | `.\run.ps1 -NoPush getSpreadsheetUrl` |

---

## うまくいかない時

- `clasp: command not found` → `npm install -g @google/clasp`
- 実行時に「API executable」関連のエラー → 手順2（API ON）と手順4（deploy）を再確認
- 認証エラー → `clasp login` をやり直す
- それでも詰まったら、エラーメッセージを丸ごと Claude に貼ってください。
