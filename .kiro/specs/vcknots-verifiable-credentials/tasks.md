# 実装計画: VCknots 検証可能な資格情報エコシステム

## 概要

本実装計画は、@trustknots/vcknots ライブラリを基盤とした検証可能な資格情報エコシステムの開発タスクを定義する。モノレポ構成で5つのパッケージ（shared、issuer、verifier、wallet、admin）を段階的に構築し、各ステップで前のステップの成果物を活用する。TypeScript を実装言語として使用し、Vitest + fast-check でプロパティベーステストを実施する。

## タスク

- [x] 1. プロジェクト構造のセットアップと基盤構築
  - [x] 1.1 モノレポのルート設定を作成する
    - ルート `package.json` を作成し、npm workspaces で `packages/*` を設定する
    - `tsconfig.base.json` を作成し、共通の TypeScript コンパイラオプションを定義する
    - `vitest.config.ts` を作成し、テストフレームワークの設定を行う
    - 共有依存関係（typescript, vitest, fast-check, @trustknots/vcknots）をルートにインストールする
    - _要件: 14.1, 14.2_

  - [x] 1.2 shared パッケージの初期構造を作成する
    - `packages/shared/package.json` と `packages/shared/tsconfig.json` を作成する
    - `packages/shared/src/types/` ディレクトリに `credential-schema.ts`、`activity-log.ts`、`index.ts` を作成する
    - `CredentialSchema`、`SchemaAttribute`、`ActivityLogEntry`、`ActivityAction`、`ValidationResult`、`ValidationError` の型定義を実装する
    - `packages/shared/src/index.ts` でエクスポートを設定する
    - _要件: 12.2, 19.1-19.9_

  - [x] 1.3 shared パッケージのユーティリティを実装する
    - `packages/shared/src/utils/activity-logger.ts` に `ActivityLogger` クラスを実装する（`log`、`getLogs`、`clear` メソッド）
    - `packages/shared/src/utils/schema-validator.ts` に `SchemaValidator` クラスを実装する（`validate`、`validateClaims` メソッド）
    - スキーマバリデーションで属性名の空文字列チェックと重複チェックを実装する
    - `packages/shared/src/utils/index.ts` でエクスポートを設定する
    - _要件: 12.6, 13.2, 19.1-19.9_

  - [x] 1.4 shared パッケージのプロパティベーステストを作成する
    - **Property 14: スキーマバリデーションによる不正属性の拒否**
    - **検証対象: 要件 12.6**
    - `packages/shared/src/__tests__/schema-validator.prop.test.ts` を作成する
    - fast-check で空文字列属性名や重複属性名を持つスキーマを生成し、バリデーション失敗を検証する

  - [x] 1.5 shared パッケージのスキーマストレージのプロパティベーステストを作成する
    - **Property 13: スキーマストレージのラウンドトリップ**
    - **検証対象: 要件 12.3**
    - `packages/shared/src/__tests__/schema-validator.prop.test.ts` にラウンドトリップテストを追加する
    - fast-check で任意の有効な CredentialSchema を生成し、保存→読み込みの等価性を検証する

  - [x] 1.6 shared パッケージのアクティビティログのプロパティベーステストを作成する
    - **Property 16: 発行者アクティビティログの完全性**
    - **Property 17: ウォレットアクティビティログの完全性**
    - **Property 18: 検証者アクティビティログの完全性**
    - **検証対象: 要件 19.1-19.9**
    - `packages/shared/src/__tests__/activity-logger.prop.test.ts` を作成する
    - fast-check で任意のアクティビティログエントリを生成し、記録後にタイムスタンプ・操作種別・操作結果が含まれることを検証する

- [x] 2. チェックポイント - 共有パッケージの検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 3. 管理パネル（Admin Panel）の実装
  - [x] 3.1 admin パッケージの初期構造と設定を作成する
    - `packages/admin/package.json` を作成し、React、Vite、TypeScript の依存関係を設定する
    - `packages/admin/tsconfig.json` を作成する
    - `packages/admin/index.html` と Vite 設定ファイルを作成する（ポート: 5174）
    - `packages/admin/src/App.tsx` にルーティング（SchemaListPage、SchemaEditorPage）を設定する
    - _要件: 12.1, 12.4, 12.5_

  - [x] 3.2 スキーマストレージサービスを実装する
    - `packages/admin/src/services/schema-storage.ts` に `SchemaStorage` クラスを実装する
    - `data/schemas.json` ファイルへの CRUD 操作（`save`、`getAll`、`getById`、`update`、`delete`）を実装する
    - 初期状態で `data/schemas.json` が存在しない場合は空配列で初期化する
    - _要件: 12.3, 13.1_

  - [x] 3.3 スキーマ一覧ページとスキーマエディタページを実装する
    - `packages/admin/src/pages/SchemaListPage.tsx` に定義済みスキーマの一覧表示を実装する
    - `packages/admin/src/pages/SchemaEditorPage.tsx` にスキーマの新規作成・編集フォームを実装する
    - `packages/admin/src/components/SchemaForm.tsx` にスキーマ名・バージョン入力フォームを実装する
    - `packages/admin/src/components/AttributeEditor.tsx` に属性（名前、型、必須フラグ、説明）の追加・編集・削除 UI を実装する
    - `packages/admin/src/components/SchemaPreview.tsx` にスキーマのプレビュー表示を実装する
    - shared パッケージの `SchemaValidator` を使用してバリデーションエラーを表示する
    - _要件: 12.1, 12.2, 12.4, 12.5, 12.6_

  - [x] 3.4 admin パッケージのユニットテストを作成する
    - スキーマストレージの CRUD 操作のユニットテストを作成する
    - バリデーションエラー表示のテストを作成する
    - _要件: 12.3, 12.6_

- [x] 4. 発行者サーバー（Issuer Server）の実装
  - [x] 4.1 issuer パッケージの初期構造と vcknots セットアップを作成する
    - `packages/issuer/package.json` を作成し、Express、@trustknots/vcknots、TypeScript の依存関係を設定する
    - `packages/issuer/tsconfig.json` を作成する
    - `packages/issuer/server/vcknots-setup.ts` に vcknots() を使用した issuer インスタンスの初期化を実装する
    - デフォルトのインメモリプロバイダーと did:key メソッドを使用する
    - `packages/issuer/server/index.ts` に Express サーバーのエントリポイントを作成する（ポート: 3001）
    - _要件: 14.1, 14.3, 14.5_

  - [x] 4.2 発行者のサービス層を実装する
    - `packages/issuer/server/services/schema-service.ts` に `SchemaService` を実装する（`data/schemas.json` からスキーマを参照）
    - `packages/issuer/server/services/issuer-service.ts` に `IssuerService` を実装する
    - `getMetadata()`: `issuer.createIssuerMetadata()` をラップ
    - `createOffer()`: スキーマ存在チェック後に `issuer.offerCredential()` を呼び出し
    - `exchangeToken()`: Pre-Authorized Code を検証しアクセストークンを返す
    - `issueCredential()`: `issuer.issueCredential()` をラップ
    - アクティビティログ記録を各操作に組み込む
    - _要件: 1.1, 2.1, 2.2, 2.4, 2.5, 3.1, 3.2, 3.3, 13.2, 13.4, 19.1, 19.2, 19.3_

  - [x] 4.3 発行者の REST API ルートを実装する
    - `packages/issuer/server/routes/well-known.ts` に `GET /.well-known/openid-credential-issuer` を実装する
    - `packages/issuer/server/routes/token.ts` に `POST /token` を実装する（無効コードで HTTP 400 + `invalid_grant`）
    - `packages/issuer/server/routes/credential.ts` に `POST /credential` を実装する（無効トークンで HTTP 401 + `invalid_token`）
    - `packages/issuer/server/routes/offers.ts` に `POST /api/offers`、`GET /api/offers/:id`、`GET /api/history`、`GET /api/activity-logs` を実装する
    - Express エラーハンドリングミドルウェアを実装し、OID4VCI 標準エラーレスポンス形式に対応する
    - CORS 設定を追加する
    - _要件: 1.2, 1.3, 1.4, 2.3, 3.1, 3.4, 3.5, 15.3, 19.10_

  - [x] 4.4 発行者サーバーのプロパティベーステストを作成する（Pre-Authorized Code）
    - **Property 1: Pre-Authorized Code の一意性**
    - **検証対象: 要件 2.4**
    - `packages/issuer/server/__tests__/issuer-service.prop.test.ts` を作成する
    - fast-check で複数のオファーを生成し、すべての Pre-Authorized Code が一意であることを検証する

  - [x] 4.5 発行者サーバーのプロパティベーステストを作成する（未定義タイプの拒否）
    - **Property 2: 未定義の資格情報タイプの拒否**
    - **検証対象: 要件 2.5**
    - `packages/issuer/server/__tests__/issuer-service.prop.test.ts` にテストを追加する
    - fast-check で定義済みスキーマ名に一致しない任意の文字列を生成し、オファー生成がエラーで拒否されることを検証する

  - [x] 4.6 発行者サーバーのプロパティベーステストを作成する（トークン取得・エラー）
    - **Property 3: 有効な Pre-Authorized Code によるトークン取得**
    - **Property 5: 無効な Pre-Authorized Code のエラーレスポンス**
    - **検証対象: 要件 3.1, 3.4**
    - `packages/issuer/server/__tests__/issuer-service.prop.test.ts` にテストを追加する
    - 有効なコードでトークンレスポンスに `access_token` と `token_type: "Bearer"` が含まれることを検証する
    - 無効なコードで HTTP 400 と `invalid_grant` が返ることを検証する

  - [x] 4.7 発行者サーバーのプロパティベーステストを作成する（資格情報発行）
    - **Property 4: 発行済み資格情報の DID ベース発行者識別子**
    - **Property 6: 無効なアクセストークンのエラーレスポンス**
    - **検証対象: 要件 3.3, 3.5**
    - `packages/issuer/server/__tests__/issuer-service.prop.test.ts` にテストを追加する
    - 発行された JWT-VC の issuer フィールドが `did:` プレフィックスで始まることを検証する
    - 無効なトークンで HTTP 401 と `invalid_token` が返ることを検証する

- [x] 5. チェックポイント - 発行者サーバーの検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 6. 発行者クライアント（Issuer Client）の実装
  - [x] 6.1 issuer クライアントの初期構造と設定を作成する
    - `packages/issuer/client/` ディレクトリに Vite + React の設定を作成する（ポート: 5173）
    - `packages/issuer/client/index.html` を作成する
    - `packages/issuer/client/src/App.tsx` にルーティング（IssuePage、HistoryPage、ActivityLogPage）を設定する
    - _要件: 15.1_

  - [x] 6.2 資格情報発行ページのコンポーネントを実装する
    - `packages/issuer/client/src/components/CredentialForm.tsx` に資格情報タイプ選択と属性値入力フォームを実装する
    - Admin Panel で定義されたスキーマに基づいて動的にフォームフィールドを生成する
    - `packages/issuer/client/src/components/QRCodeDisplay.tsx` に qrcode.react を使用した QR コード表示を実装する
    - `packages/issuer/client/src/components/IssueStatusTracker.tsx` に発行処理状態（オファー作成済み、トークン発行済み、資格情報発行完了）の表示を実装する
    - `packages/issuer/client/src/pages/IssuePage.tsx` にフォーム送信→オファー生成→QR コード表示→状態追跡のフローを実装する
    - _要件: 15.1, 15.2, 15.4_

  - [x] 6.3 発行履歴ページとアクティビティログページを実装する
    - `packages/issuer/client/src/pages/HistoryPage.tsx` に発行済み資格情報の履歴一覧表示を実装する
    - `packages/issuer/client/src/pages/ActivityLogPage.tsx` にアクティビティログの時系列表示を実装する
    - _要件: 15.3, 19.10_

  - [x] 6.4 発行者クライアントのユニットテストを作成する
    - CredentialForm のレンダリングとバリデーションのテストを作成する
    - IssueStatusTracker の状態遷移テストを作成する
    - _要件: 15.1, 15.4_

- [x] 7. 検証者サーバー（Verifier Server）の実装
  - [x] 7.1 verifier パッケージの初期構造と vcknots セットアップを作成する
    - `packages/verifier/package.json` を作成し、Express、@trustknots/vcknots、TypeScript の依存関係を設定する
    - `packages/verifier/tsconfig.json` を作成する
    - `packages/verifier/server/vcknots-setup.ts` に vcknots() を使用した verifier インスタンスの初期化を実装する
    - デフォルトのインメモリプロバイダーと did:key メソッドを使用する
    - `packages/verifier/server/index.ts` に Express サーバーのエントリポイントを作成する（ポート: 3002）
    - _要件: 14.2, 14.4, 14.6_

  - [x] 7.2 検証者のサービス層と REST API ルートを実装する
    - `packages/verifier/server/services/verifier-service.ts` に `VerifierService` を実装する
    - `getMetadata()`: `verifier.createVerifierMetadata()` をラップ
    - `createAuthzRequest()`: `verifier.createAuthzRequest()` をラップし、JAR 形式と Presentation Exchange を使用
    - `verifyPresentation()`: `verifier.verifyPresentations()` をラップし、署名・発行者・条件一致を検証
    - `packages/verifier/server/routes/well-known.ts` に `GET /.well-known/openid-verifier` を実装する
    - `packages/verifier/server/routes/authz-request.ts` に `POST /api/authz-requests` と `GET /api/authz-requests/:id` を実装する
    - `packages/verifier/server/routes/authz-response.ts` に `POST /authz-response` と `GET /api/activity-logs` を実装する
    - アクティビティログ記録を各操作に組み込む
    - Express エラーハンドリングミドルウェアを実装し、CORS 設定を追加する
    - _要件: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 19.7, 19.8, 19.9, 19.12_

  - [x] 7.3 検証者サーバーのユニットテストを作成する
    - メタデータエンドポイントのレスポンス形式テストを作成する
    - 認可リクエスト生成のテストを作成する
    - プレゼンテーション検証の成功・失敗ケースのテストを作成する
    - _要件: 4.1, 5.1, 6.1-6.6_

- [x] 8. 検証者クライアント（Verifier Client）の実装
  - [x] 8.1 verifier クライアントの初期構造と設定を作成する
    - `packages/verifier/client/` ディレクトリに Vite + React の設定を作成する（ポート: 5175）
    - `packages/verifier/client/index.html` を作成する
    - `packages/verifier/client/src/App.tsx` にルーティング（VerifyPage、ResultPage、ActivityLogPage）を設定する
    - _要件: 16.1_

  - [x] 8.2 検証ページのコンポーネントを実装する
    - `packages/verifier/client/src/components/VerificationForm.tsx` に検証する資格情報タイプの選択フォームを実装する
    - `packages/verifier/client/src/components/QRCodeDisplay.tsx` に認可リクエストの QR コード表示を実装する
    - `packages/verifier/client/src/components/VerifyStatusTracker.tsx` に検証処理状態（リクエスト作成済み、プレゼンテーション受信済み、検証完了）の表示を実装する
    - `packages/verifier/client/src/pages/VerifyPage.tsx` にフォーム送信→認可リクエスト生成→QR コード表示→状態追跡のフローを実装する
    - `packages/verifier/client/src/pages/ResultPage.tsx` に検証結果（成功/失敗）と資格情報内容の表示を実装する
    - `packages/verifier/client/src/pages/ActivityLogPage.tsx` にアクティビティログの時系列表示を実装する
    - _要件: 16.1, 16.2, 16.3, 16.4, 19.12_

  - [x] 8.3 検証者クライアントのユニットテストを作成する
    - VerificationForm のレンダリングテストを作成する
    - VerifyStatusTracker の状態遷移テストを作成する
    - ResultPage の検証結果表示テストを作成する
    - _要件: 16.1, 16.3, 16.4_

- [x] 9. チェックポイント - 発行者・検証者の検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 10. ウォレットサービス層の実装
  - [x] 10.1 wallet パッケージの初期構造と設定を作成する
    - `packages/wallet/package.json` を作成し、React、Vite、TypeScript の依存関係を設定する
    - `packages/wallet/tsconfig.json` を作成する
    - `packages/wallet/index.html` と Vite 設定ファイルを作成する（ポート: 5176）
    - `packages/wallet/src/types/wallet.ts` にウォレット固有の型定義（`StoredCredential`、`DecodedCredential`、`ParsedCredentialOffer`、`ParsedAuthzRequest`、`PresentationDefinition` 等）を作成する
    - _要件: 7.1, 8.3, 9.1, 11.1_

  - [x] 10.2 DIDService を実装する
    - `packages/wallet/src/services/did-service.ts` に `DIDService` を実装する
    - `generateDID()`: did:key メソッドで DID と鍵ペアを生成する
    - `getOrCreateDID()`: localStorage に DID が存在すれば再利用、なければ新規生成する
    - `hasDID()`: DID の存在確認を行う
    - _要件: 11.1, 11.2, 11.3, 11.4_

  - [x] 10.3 DIDService のプロパティベーステストを作成する
    - **Property 12: DID のストレージと再利用の冪等性**
    - **検証対象: 要件 11.2, 11.4**
    - `packages/wallet/src/__tests__/did-service.prop.test.ts` を作成する
    - fast-check で `getOrCreateDID()` を複数回呼び出し、常に同一の DID が返されることを検証する

  - [x] 10.4 CredentialStorage を実装する
    - `packages/wallet/src/services/credential-storage.ts` に `CredentialStorage` を実装する
    - `save()`: localStorage に資格情報を保存する
    - `getAll()`: 全資格情報を取得する
    - `getById()`: ID で資格情報を取得する
    - `delete()`: 確認後に資格情報を削除する
    - `findMatching()`: Presentation Exchange の input_descriptors の制約条件に基づいて一致する資格情報を検索する
    - _要件: 8.3, 9.2, 10.1, 10.3_

  - [x] 10.5 CredentialStorage のプロパティベーステストを作成する
    - **Property 9: 資格情報ストレージのラウンドトリップ**
    - **検証対象: 要件 8.3**
    - `packages/wallet/src/__tests__/credential-storage.prop.test.ts` を作成する
    - fast-check で任意の有効な StoredCredential を生成し、保存→読み込みの等価性を検証する

  - [x] 10.6 資格情報マッチングのプロパティベーステストを作成する
    - **Property 11: Presentation Exchange 条件に基づく資格情報マッチング**
    - **検証対象: 要件 9.2**
    - `packages/wallet/src/__tests__/credential-storage.prop.test.ts` にテストを追加する
    - fast-check で任意の保存済み資格情報セットと PresentationDefinition を生成し、`findMatching` の結果がすべて制約条件を満たすことを検証する

  - [x] 10.7 OID4Client を実装する
    - `packages/wallet/src/services/oid4-client.ts` に `OID4Client` を実装する
    - `parseCredentialOffer()`: Credential Offer URI を解析し、発行者 URL・資格情報タイプ・Pre-Authorized Code を抽出する
    - `fetchIssuerMetadata()`: 発行者の `/.well-known/openid-credential-issuer` からメタデータを取得する
    - `exchangePreAuthorizedCode()`: トークンエンドポイントに Pre-Authorized Code を送信しアクセストークンを取得する
    - `fetchCredential()`: 資格情報エンドポイントにアクセストークンと proof を送信し JWT-VC を取得する
    - `parseAuthorizationRequest()`: 認可リクエスト URI を解析し、検証者 URL・レスポンス URI・ノンス・PresentationDefinition を抽出する
    - `submitPresentation()`: VP を生成して検証者に送信する
    - _要件: 7.1, 7.2, 8.1, 8.2, 9.1, 9.4_

  - [x] 10.8 OID4Client のプロパティベーステストを作成する（Credential Offer URI）
    - **Property 7: Credential Offer URI の解析正当性**
    - **Property 8: 不正な Credential Offer URI のエラー処理**
    - **検証対象: 要件 7.1, 7.4**
    - `packages/wallet/src/__tests__/oid4-client.prop.test.ts` を作成する
    - fast-check で有効な URI を生成し、解析結果が正しいことを検証する
    - fast-check で不正な URI を生成し、エラーが返ることを検証する

  - [x] 10.9 OID4Client のプロパティベーステストを作成する（認可リクエスト URI）
    - **Property 10: 認可リクエスト URI の解析正当性**
    - **検証対象: 要件 9.1**
    - `packages/wallet/src/__tests__/oid4-client.prop.test.ts` にテストを追加する
    - fast-check で有効な認可リクエスト URI を生成し、解析結果が正しいことを検証する

  - [x] 10.10 WalletService を実装する
    - `packages/wallet/src/services/wallet-service.ts` に `WalletService` を実装する
    - `receiveOffer()`: OID4Client を使用してオファーを解析し、発行者メタデータを取得する
    - `acceptOffer()`: Pre-Authorized Code Flow に従ってトークン取得→資格情報取得→保存を実行する
    - `receiveAuthzRequest()`: 認可リクエストを解析し、一致する資格情報を検索する
    - `presentCredentials()`: VP を生成して検証者に送信する
    - アクティビティログ記録を各操作に組み込む
    - ネットワークエラー時のエラーハンドリングを実装する
    - _要件: 7.1, 7.2, 7.3, 8.1, 8.2, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 17.1, 17.3, 18.1, 18.3, 19.4, 19.5, 19.6_

- [x] 11. チェックポイント - ウォレットサービス層の検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 12. ウォレット UI の実装
  - [x] 12.1 ウォレットの React Hooks を実装する
    - `packages/wallet/src/hooks/useCredentials.ts` に資格情報の取得・削除を管理するフックを実装する
    - `packages/wallet/src/hooks/useDID.ts` に DID の取得・表示を管理するフックを実装する
    - `packages/wallet/src/hooks/useActivityLog.ts` にアクティビティログの取得を管理するフックを実装する
    - _要件: 10.1, 11.3, 19.11_

  - [x] 12.2 ウォレットのダッシュボードと資格情報管理 UI を実装する
    - `packages/wallet/src/App.tsx` にルーティング（DashboardPage、ReceiveOfferPage、PresentPage、CredentialDetailPage、ActivityLogPage）を設定する
    - `packages/wallet/src/pages/DashboardPage.tsx` に保存済み資格情報の一覧表示と DID 表示を実装する
    - `packages/wallet/src/components/CredentialList.tsx` に資格情報カードの一覧を実装する
    - `packages/wallet/src/components/CredentialCard.tsx` に資格情報の概要表示（タイプ、発行者、発行日）を実装する
    - `packages/wallet/src/components/DIDDisplay.tsx` に DID の表示コンポーネントを実装する
    - `packages/wallet/src/pages/CredentialDetailPage.tsx` に資格情報の詳細表示（発行者、タイプ、属性、発行日）と削除機能を実装する
    - 資格情報が空の場合のメッセージと取得方法の案内を表示する
    - _要件: 10.1, 10.2, 10.3, 10.4, 11.3_

  - [x] 12.3 資格情報オファー受信ページを実装する
    - `packages/wallet/src/pages/ReceiveOfferPage.tsx` に Credential Offer URI の入力フォームを実装する
    - `packages/wallet/src/components/OfferConfirmDialog.tsx` にオファー内容（発行者情報、資格情報タイプ）の確認ダイアログを実装する
    - オファーの受け入れ・拒否の選択肢を提供する
    - 受け入れ後の資格情報取得フロー（トークン取得→資格情報取得→保存→結果表示）を実装する
    - 不正な URI やネットワークエラー時のエラーメッセージと再試行オプションを実装する
    - _要件: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 17.1, 17.2, 17.3_

  - [x] 12.4 資格情報提示ページを実装する
    - `packages/wallet/src/pages/PresentPage.tsx` に認可リクエスト URI の入力フォームを実装する
    - `packages/wallet/src/components/PresentConfirmDialog.tsx` に提示する資格情報の確認ダイアログを実装する
    - Presentation Exchange 条件に一致する資格情報の自動選択と表示を実装する
    - ユーザー承認後の VP 生成・送信フローを実装する
    - 一致する資格情報がない場合のメッセージ表示を実装する
    - ネットワークエラー時のエラーメッセージと再試行オプションを実装する
    - _要件: 9.1, 9.2, 9.3, 9.4, 9.5, 18.1, 18.3_

  - [x] 12.5 ウォレットのアクティビティログページを実装する
    - `packages/wallet/src/pages/ActivityLogPage.tsx` にアクティビティログの時系列表示を実装する
    - _要件: 19.11_

  - [x] 12.6 ウォレット UI のユニットテストを作成する
    - CredentialList の空状態と資格情報表示のテストを作成する
    - OfferConfirmDialog の受け入れ・拒否テストを作成する
    - PresentConfirmDialog の資格情報選択テストを作成する
    - _要件: 10.1, 10.4, 7.3, 9.3_

- [x] 13. エンドツーエンドフローの統合と結合テスト
  - [x] 13.1 発行フローのエンドツーエンド統合を実装する
    - 発行者 UI でオファー生成→ウォレットで URI 入力→オファー確認→資格情報取得→保存の一連のフローが動作することを確認する
    - 発行者サーバーとウォレット間の CORS 設定を調整する
    - 取得した資格情報の内容が発行者で入力した属性値と一致することを確認する
    - _要件: 17.1, 17.2_

  - [x] 13.2 検証フローのエンドツーエンド統合を実装する
    - 検証者 UI で認可リクエスト生成→ウォレットで URI 入力→資格情報選択→VP 送信→検証結果表示の一連のフローが動作することを確認する
    - 検証者サーバーとウォレット間の CORS 設定を調整する
    - _要件: 18.1, 18.2_

  - [x] 13.3 発行フローのプロパティベーステストを作成する
    - **Property 15: 発行フローにおけるクレーム値の保存**
    - **検証対象: 要件 17.2**
    - `packages/wallet/src/__tests__/wallet-service.prop.test.ts` を作成する
    - fast-check で任意のクレーム値セットを生成し、発行フロー完了後にウォレットに保存された資格情報の `credentialSubject` が元のクレーム値と一致することを検証する

  - [x] 13.4 発行者・検証者サーバーのインテグレーションテストを作成する
    - `packages/issuer/server/__tests__/` に supertest を使用した REST API エンドポイントのインテグレーションテストを作成する
    - `packages/verifier/server/__tests__/` に supertest を使用した REST API エンドポイントのインテグレーションテストを作成する
    - メタデータエンドポイント、トークンエンドポイント、資格情報エンドポイント、認可リクエスト・レスポンスエンドポイントをテストする
    - _要件: 1.1-1.4, 3.1-3.5, 4.1-4.3, 5.1-5.5, 6.1-6.6_

- [x] 14. 最終チェックポイント - 全テスト実行と最終確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` マーク付きのタスクはオプションであり、MVP の迅速な構築のためにスキップ可能
- 各タスクは特定の要件を参照しており、トレーサビリティを確保している
- チェックポイントで段階的な検証を行い、問題の早期発見を促進する
- プロパティベーステストは設計書の正当性プロパティ（Property 1〜18）を検証する
- ユニットテストは具体的な例やエッジケースを検証する
