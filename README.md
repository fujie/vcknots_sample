# VCknots Verifiable Credentials Ecosystem

@trustknots/vcknots ライブラリを基盤とした検証可能な資格情報（Verifiable Credentials）エコシステムのプロトタイプ実装です。OID4VCI Draft 13 および OID4VP Draft 24 プロトコルに準拠し、Pre-Authorized Code Flow と JWT-VC フォーマットを使用します。

## アーキテクチャ

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Issuer Server  │     │ Verifier Server │     │     Wallet      │
│   (port 4001)   │     │   (port 4002)   │     │   (port 4014)   │
│   Express API   │     │   Express API   │     │   React SPA     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  OID4VCI Flow         │  OID4VP Flow          │
         │◄──────────────────────┼───────────────────────┤
         │                       │◄──────────────────────┤
         │                       │                       │
┌────────┴────────┐     ┌────────┴────────┐
│   Issuer UI     │     │  Verifier UI    │
│   (port 4011)   │     │   (port 4013)   │
│   React SPA     │     │   React SPA     │
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│  Admin Panel    │     │  Shared Package │
│   (port 4012)   │     │   Types/Utils   │
│   React SPA     │     │                 │
└─────────────────┘     └─────────────────┘
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| ランタイム | Node.js (>=18) |
| サーバー | Express.js |
| フロントエンド | React 18 + TypeScript |
| ビルドツール | Vite |
| スタイリング | Tailwind CSS v4 |
| VC コアライブラリ | @trustknots/vcknots |
| QR コード | qrcode.react |
| テスト | Vitest + fast-check (PBT) |
| モノレポ | npm workspaces |

## セットアップ

```bash
# 依存関係のインストール
npm install

# 全テスト実行
npm test
```

## サービス起動

### 全サービス一括起動

```bash
npm run dev
```

### 個別起動

```bash
npm run dev:issuer       # Issuer Server (http://localhost:4001)
npm run dev:issuer-ui    # Issuer UI (http://localhost:4011)
npm run dev:verifier     # Verifier Server (http://localhost:4002)
npm run dev:verifier-ui  # Verifier UI (http://localhost:4013)
npm run dev:wallet       # Wallet (http://localhost:4014)
npm run dev:admin        # Admin Panel (http://localhost:4012)
```

## ポート一覧

| サービス | ポート | 説明 |
|---------|--------|------|
| Issuer Server | 4001 | 資格情報発行 API（OID4VCI） |
| Issuer UI | 4011 | 発行者操作画面 |
| Admin Panel | 4012 | スキーマ管理画面 |
| Verifier UI | 4013 | 検証者操作画面 |
| Wallet | 4014 | ブラウザウォレット |
| Verifier Server | 4002 | 資格情報検証 API（OID4VP） |

## パッケージ構成

```
packages/
├── shared/     # 共有型定義・ユーティリティ（CredentialSchema, ActivityLogger, SchemaValidator）
├── admin/      # 管理パネル — スキーマの CRUD 管理
├── issuer/     # 発行者 — サーバー (Express) + クライアント (React)
├── verifier/   # 検証者 — サーバー (Express) + クライアント (React)
└── wallet/     # ウォレット — 資格情報の受信・保存・提示 (React SPA)
```

## 使い方

### 1. スキーマ定義（Admin Panel）

1. http://localhost:4012 を開く
2. 「新規スキーマ作成」で資格情報の属性を定義
3. サンプルスキーマ（UniversityDegree, DriverLicense）は `data/schemas.json` にプリセット済み

### 2. 資格情報の発行（Issuer）

1. http://localhost:4011 を開く
2. Credential Type を選択し、属性値を入力
3. 「Generate Offer」をクリック → QR コード / URI が表示される
4. 表示された URI をウォレットに貼り付ける

### 3. 資格情報の受信（Wallet）

1. http://localhost:4014 を開く
2. 「Receive」タブを選択
3. Issuer から取得した Credential Offer URI を貼り付け
4. 「Parse Offer」→ オファー内容を確認 →「Accept」
5. 資格情報がウォレットに保存される

### 4. 資格情報の検証（Verifier → Wallet）

1. http://localhost:4013 で検証リクエストを作成
2. 表示された Authorization Request URI をウォレットの「Present」タブに貼り付け
3. 提示する資格情報を選択して「Approve」
4. 検証者に VP が送信され、検証結果が表示される

## API エンドポイント

### Issuer Server (port 4001)

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/.well-known/openid-credential-issuer` | OID4VCI メタデータ |
| POST | `/token` | トークンエンドポイント |
| POST | `/credential` | 資格情報発行エンドポイント |
| GET | `/api/schemas` | スキーマ一覧 |
| POST | `/api/offers` | オファー生成 |
| GET | `/api/offers/:id` | オファー詳細 |
| GET | `/api/history` | 発行履歴 |
| GET | `/api/activity-logs` | アクティビティログ |

### Verifier Server (port 4002)

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/.well-known/openid-verifier` | OID4VP メタデータ |
| POST | `/api/authz-requests` | 認可リクエスト生成 |
| GET | `/api/authz-requests/:id` | 認可リクエスト詳細 |
| POST | `/authz-response` | プレゼンテーション受信・検証 |
| GET | `/api/activity-logs` | アクティビティログ |

## テスト

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# 型チェック
npm run typecheck
```

### テスト構成

- **214 テスト** / 21 テストファイル
- **プロパティベーステスト (PBT)**: 18 プロパティ × 100+ イテレーション
  - Property 1-6: 発行者サーバーの正当性（Pre-Authorized Code 一意性、トークン検証等）
  - Property 7-8: Credential Offer URI 解析
  - Property 9: 資格情報ストレージのラウンドトリップ
  - Property 10: 認可リクエスト URI 解析
  - Property 11: Presentation Exchange マッチング
  - Property 12: DID の冪等性
  - Property 13-14: スキーマバリデーション
  - Property 15: 発行フローのクレーム値保存
  - Property 16-18: アクティビティログの完全性
- **ユニットテスト**: サービス層、コンポーネント、ルート
- **インテグレーションテスト**: E2E 発行フロー、E2E 検証フロー

## プロトコル

- **OID4VCI Draft 13** — Pre-Authorized Code Flow による資格情報発行
- **OID4VP Draft 24** — JAR + Presentation Exchange による資格情報検証
- **JWT-VC** — JSON Web Token 形式の Verifiable Credential
- **did:key** — DID メソッド（鍵生成・署名）

## 制限事項

- ストレージはインメモリ（サーバー）/ localStorage（クライアント）— サーバー再起動でデータがリセットされます
- **発行フロー（Issuer）**: ウォレットが ES256 署名付き proof JWT を送信し、vcknots ライブラリが `did:key` を解決して暗号的に署名検証を行います（正規の OID4VCI proof 検証）
- **検証フロー（Verifier）**: VP Token は JSON 形式で送信され、含まれる JWT-VC のペイロードを抽出して内容を表示します。VP 自体の暗号的な署名検証（JWT-VP 署名の検証）は行っていません
- 本番環境での使用は想定していません

## ライセンス

MIT
