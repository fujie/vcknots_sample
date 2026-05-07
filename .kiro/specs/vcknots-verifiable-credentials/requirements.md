# 要件定義書

## はじめに

本ドキュメントは、@trustknots/vcknots ライブラリを使用した検証可能な資格情報（Verifiable Credentials）エコシステムの要件を定義する。本システムは、発行者ウェブサイト（Issuer Website）、検証者ウェブサイト（Verifier Website）、ブラウザウォレット（Browser Wallet）、および管理パネル（Admin Panel）の4つのコンポーネントで構成される。OID4VCI（OpenID for Verifiable Credential Issuance）Draft 13 および OID4VP（OpenID for Verifiable Presentations）Draft 24 プロトコルに準拠し、Pre-Authorized Code Flow と JWT-VC フォーマットを使用する。

## 用語集

- **Issuer_Website**: OID4VCI プロトコルを使用して、ブラウザウォレットに対して検証可能な資格情報を発行するウェブアプリケーション
- **Verifier_Website**: OID4VP プロトコルを使用して、ブラウザウォレットから検証可能なプレゼンテーションを検証するウェブアプリケーション
- **Browser_Wallet**: 発行者から資格情報を受け取り、検証者に提示するブラウザベースのウォレットアプリケーション
- **Admin_Panel**: 発行者が発行する検証可能な資格情報の属性・スキーマを定義するウェブ管理インターフェース
- **VCknots_Library**: @trustknots/vcknots npm パッケージ。発行者と検証者のコアロジックを提供する
- **Verifiable_Credential（VC）**: W3C 標準に基づく、暗号的に検証可能なデジタル資格情報
- **Verifiable_Presentation（VP）**: 1つ以上の VC を含む、検証者に提示するための暗号的に署名されたデータ構造
- **OID4VCI**: OpenID for Verifiable Credential Issuance Draft 13 プロトコル。Pre-Authorized Code Flow を使用した資格情報発行の標準規格
- **OID4VP**: OpenID for Verifiable Presentations Draft 24 プロトコル。JAR（Signed Request Objects）と Presentation Exchange を使用した資格情報検証の標準規格
- **Pre_Authorized_Code_Flow**: ユーザー認証を事前に完了した状態で資格情報を発行するフロー
- **JWT_VC**: JSON Web Token 形式の検証可能な資格情報フォーマット
- **DID**: Decentralized Identifier。分散型識別子。did:key メソッドを含む
- **Credential_Offer**: 発行者がウォレットに対して資格情報の取得を提案するデータ構造
- **Presentation_Exchange**: 検証者がウォレットに対して要求する資格情報の条件を定義する仕様
- **JAR**: JWT-Secured Authorization Request。署名付きリクエストオブジェクト
- **Credential_Schema**: 資格情報に含まれる属性の名前・型・制約を定義する構造

## 要件

### 要件 1: 発行者メタデータの公開

**ユーザーストーリー:** 発行者として、OID4VCI 準拠のメタデータエンドポイントを公開したい。ウォレットが発行者の機能と対応する資格情報タイプを発見できるようにするためである。

#### 受け入れ基準

1. WHEN Issuer_Website が起動した時、THE Issuer_Website SHALL VCknots_Library の `issuer.createIssuerMetadata()` を使用して OID4VCI Draft 13 準拠のメタデータを生成する
2. THE Issuer_Website SHALL `/.well-known/openid-credential-issuer` エンドポイントで発行者メタデータを JSON 形式で提供する
3. WHEN Browser_Wallet がメタデータエンドポイントにリクエストした時、THE Issuer_Website SHALL 対応する資格情報タイプ、フォーマット（JWT_VC）、および暗号アルゴリズムの情報を含むレスポンスを返す
4. IF メタデータの生成に失敗した場合、THEN THE Issuer_Website SHALL HTTP 500 ステータスコードとエラーメッセージを返す

### 要件 2: 資格情報オファーの作成

**ユーザーストーリー:** 発行者として、ウォレットに対して資格情報オファーを作成したい。ウォレットが Pre-Authorized Code Flow で資格情報を取得できるようにするためである。

#### 受け入れ基準

1. WHEN 発行者が資格情報の発行を開始した時、THE Issuer_Website SHALL VCknots_Library の `issuer.offerCredential()` を使用して Credential_Offer を生成する
2. THE Issuer_Website SHALL Pre_Authorized_Code_Flow に基づく Credential_Offer を生成する
3. THE Issuer_Website SHALL 生成した Credential_Offer を QR コードまたは URI として Browser_Wallet に提供する
4. WHEN Credential_Offer が生成された時、THE Issuer_Website SHALL オファーに一意の Pre-Authorized Code を含める
5. IF 資格情報タイプが Admin_Panel で定義されていない場合、THEN THE Issuer_Website SHALL エラーメッセージを表示し、オファーの生成を中止する

### 要件 3: 資格情報の発行

**ユーザーストーリー:** 発行者として、ウォレットからのトークンリクエストに応じて資格情報を発行したい。ウォレットが暗号的に検証可能な資格情報を受け取れるようにするためである。

#### 受け入れ基準

1. WHEN Browser_Wallet がトークンエンドポイントに有効な Pre-Authorized Code を送信した時、THE Issuer_Website SHALL アクセストークンを発行する
2. WHEN Browser_Wallet が有効なアクセストークンを使用して資格情報エンドポイントにリクエストした時、THE Issuer_Website SHALL VCknots_Library の `issuer.issueCredential()` を使用して JWT_VC 形式の Verifiable_Credential を発行する
3. THE Issuer_Website SHALL 発行する Verifiable_Credential に DID ベースの発行者識別子で署名する
4. IF 無効な Pre-Authorized Code が送信された場合、THEN THE Issuer_Website SHALL HTTP 400 ステータスコードと `invalid_grant` エラーコードを返す
5. IF 無効または期限切れのアクセストークンが送信された場合、THEN THE Issuer_Website SHALL HTTP 401 ステータスコードと `invalid_token` エラーコードを返す

### 要件 4: 検証者メタデータの公開

**ユーザーストーリー:** 検証者として、OID4VP 準拠のメタデータエンドポイントを公開したい。ウォレットが検証者の機能と要求する資格情報タイプを発見できるようにするためである。

#### 受け入れ基準

1. WHEN Verifier_Website が起動した時、THE Verifier_Website SHALL VCknots_Library の `verifier.createVerifierMetadata()` を使用して OID4VP Draft 24 準拠のメタデータを生成する
2. THE Verifier_Website SHALL 適切な well-known エンドポイントで検証者メタデータを JSON 形式で提供する
3. IF メタデータの生成に失敗した場合、THEN THE Verifier_Website SHALL HTTP 500 ステータスコードとエラーメッセージを返す

### 要件 5: 認可リクエストの作成

**ユーザーストーリー:** 検証者として、ウォレットに対して認可リクエストを作成したい。ウォレットが要求された資格情報を提示できるようにするためである。

#### 受け入れ基準

1. WHEN 検証者が資格情報の検証を開始した時、THE Verifier_Website SHALL VCknots_Library の `verifier.createAuthzRequest()` を使用して認可リクエストを生成する
2. THE Verifier_Website SHALL JAR（Signed Request Objects）形式で認可リクエストを生成する
3. THE Verifier_Website SHALL Presentation_Exchange を使用して要求する資格情報の条件を定義する
4. THE Verifier_Website SHALL 生成した認可リクエストを QR コードまたは URI として Browser_Wallet に提供する
5. IF 認可リクエストの生成に失敗した場合、THEN THE Verifier_Website SHALL エラーメッセージをユーザーに表示する

### 要件 6: プレゼンテーションの検証

**ユーザーストーリー:** 検証者として、ウォレットから受け取ったプレゼンテーションを検証したい。提示された資格情報の真正性と有効性を確認するためである。

#### 受け入れ基準

1. WHEN Browser_Wallet が Verifiable_Presentation を送信した時、THE Verifier_Website SHALL VCknots_Library の `verifier.verifyPresentations()` を使用してプレゼンテーションを検証する
2. THE Verifier_Website SHALL Verifiable_Presentation 内の署名の暗号的な有効性を検証する
3. THE Verifier_Website SHALL Verifiable_Presentation 内の Verifiable_Credential の発行者署名を検証する
4. THE Verifier_Website SHALL Presentation_Exchange の条件に対して提示された資格情報が一致するかを検証する
5. WHEN 検証が成功した時、THE Verifier_Website SHALL 検証結果と資格情報の内容をユーザーに表示する
6. IF 検証が失敗した場合、THEN THE Verifier_Website SHALL 失敗の理由（署名無効、期限切れ、条件不一致など）を含むエラーメッセージを表示する

### 要件 7: 資格情報オファーの受信

**ユーザーストーリー:** ウォレットユーザーとして、発行者からの資格情報オファーを受信したい。資格情報の取得プロセスを開始するためである。

#### 受け入れ基準

1. WHEN Browser_Wallet が Credential_Offer の URI を受信した時、THE Browser_Wallet SHALL Credential_Offer を解析し、発行者情報と資格情報タイプを表示する
2. WHEN Browser_Wallet が Credential_Offer を受信した時、THE Browser_Wallet SHALL 発行者のメタデータエンドポイントから発行者情報を取得する
3. THE Browser_Wallet SHALL ユーザーに資格情報オファーの受け入れまたは拒否の選択肢を提供する
4. IF Credential_Offer の URI が不正な形式の場合、THEN THE Browser_Wallet SHALL エラーメッセージを表示する

### 要件 8: 資格情報の取得と保存

**ユーザーストーリー:** ウォレットユーザーとして、オファーを受け入れた後に資格情報を取得して保存したい。後で検証者に提示できるようにするためである。

#### 受け入れ基準

1. WHEN ユーザーが Credential_Offer を受け入れた時、THE Browser_Wallet SHALL Pre_Authorized_Code_Flow に従ってトークンエンドポイントからアクセストークンを取得する
2. WHEN アクセストークンを取得した時、THE Browser_Wallet SHALL 資格情報エンドポイントから JWT_VC 形式の Verifiable_Credential を取得する
3. THE Browser_Wallet SHALL 取得した Verifiable_Credential をブラウザのローカルストレージに保存する
4. WHEN 資格情報の取得が完了した時、THE Browser_Wallet SHALL 取得した資格情報の内容（発行者、タイプ、属性）をユーザーに表示する
5. IF 資格情報の取得に失敗した場合、THEN THE Browser_Wallet SHALL エラーの理由を含むメッセージを表示する

### 要件 9: 資格情報の提示

**ユーザーストーリー:** ウォレットユーザーとして、検証者の要求に応じて資格情報を提示したい。検証者に自分の資格情報を証明するためである。

#### 受け入れ基準

1. WHEN Browser_Wallet が検証者からの認可リクエスト URI を受信した時、THE Browser_Wallet SHALL 認可リクエストを解析し、要求される資格情報の条件を表示する
2. THE Browser_Wallet SHALL Presentation_Exchange の条件に一致する保存済み資格情報を自動的に選択する
3. THE Browser_Wallet SHALL ユーザーに提示する資格情報の確認画面を表示する
4. WHEN ユーザーが資格情報の提示を承認した時、THE Browser_Wallet SHALL DID ベースの署名付き Verifiable_Presentation を生成し、Verifier_Website に送信する
5. IF 保存済み資格情報の中に条件に一致するものがない場合、THEN THE Browser_Wallet SHALL 一致する資格情報がない旨のメッセージを表示する

### 要件 10: ウォレットの資格情報管理

**ユーザーストーリー:** ウォレットユーザーとして、保存された資格情報を一覧表示・閲覧・削除したい。自分の資格情報を管理するためである。

#### 受け入れ基準

1. THE Browser_Wallet SHALL 保存されたすべての Verifiable_Credential の一覧を表示する
2. WHEN ユーザーが資格情報を選択した時、THE Browser_Wallet SHALL 資格情報の詳細（発行者、タイプ、属性、発行日）を表示する
3. WHEN ユーザーが資格情報の削除を要求した時、THE Browser_Wallet SHALL 確認ダイアログを表示した後、ローカルストレージから資格情報を削除する
4. WHILE Browser_Wallet に資格情報が保存されていない状態では、THE Browser_Wallet SHALL 資格情報がない旨のメッセージと取得方法の案内を表示する

### 要件 11: ウォレットの DID 管理

**ユーザーストーリー:** ウォレットユーザーとして、ウォレットの DID を自動的に生成・管理したい。資格情報の受信と提示に使用するためである。

#### 受け入れ基準

1. WHEN Browser_Wallet が初回起動した時、THE Browser_Wallet SHALL did:key メソッドを使用して DID と鍵ペアを自動生成する
2. THE Browser_Wallet SHALL 生成した DID と鍵ペアをブラウザのローカルストレージに安全に保存する
3. THE Browser_Wallet SHALL 生成した DID をユーザーに表示する
4. WHILE DID が既に生成されている状態では、THE Browser_Wallet SHALL 既存の DID を再利用する

### 要件 12: 資格情報スキーマの定義

**ユーザーストーリー:** 管理者として、発行する資格情報のスキーマ（属性の名前・型）を定義したい。発行者が正しい構造の資格情報を発行できるようにするためである。

#### 受け入れ基準

1. THE Admin_Panel SHALL 新しい Credential_Schema を作成するためのフォームを提供する
2. THE Admin_Panel SHALL Credential_Schema に含める属性の名前と型（文字列、数値、日付、真偽値）を定義する機能を提供する
3. WHEN 管理者が Credential_Schema を保存した時、THE Admin_Panel SHALL スキーマをバリデーションし、Issuer_Website が参照できる形式で保存する
4. THE Admin_Panel SHALL 定義済みの Credential_Schema の一覧を表示する
5. WHEN 管理者が既存の Credential_Schema を選択した時、THE Admin_Panel SHALL スキーマの編集機能を提供する
6. IF Credential_Schema の属性名が空または重複している場合、THEN THE Admin_Panel SHALL バリデーションエラーを表示し、保存を中止する

### 要件 13: 資格情報スキーマと発行者の連携

**ユーザーストーリー:** 管理者として、定義したスキーマを発行者が使用できるようにしたい。発行者がスキーマに基づいた資格情報を発行できるようにするためである。

#### 受け入れ基準

1. THE Admin_Panel SHALL 定義した Credential_Schema を Issuer_Website が参照可能な共有ストレージに保存する
2. WHEN Issuer_Website が資格情報を発行する時、THE Issuer_Website SHALL Admin_Panel で定義された Credential_Schema に基づいて資格情報の属性を構成する
3. WHEN 管理者が Credential_Schema を更新した時、THE Issuer_Website SHALL 次回の資格情報発行時に更新されたスキーマを使用する
4. IF Issuer_Website が参照する Credential_Schema が存在しない場合、THEN THE Issuer_Website SHALL エラーメッセージをログに記録し、資格情報の発行を中止する

### 要件 14: VCknots ライブラリのプロバイダー設定

**ユーザーストーリー:** 開発者として、VCknots_Library のプロバイダー（ストレージ、鍵管理、DID 解決）を設定したい。プロトタイピング段階ではデフォルトのインメモリ実装を使用するためである。

#### 受け入れ基準

1. THE Issuer_Website SHALL VCknots_Library の `vcknots()` 関数を使用して issuer インスタンスを初期化する
2. THE Verifier_Website SHALL VCknots_Library の `vcknots()` 関数を使用して verifier インスタンスを初期化する
3. THE Issuer_Website SHALL VCknots_Library のデフォルトのインメモリプロバイダーをストレージ、鍵管理、DID 解決に使用する
4. THE Verifier_Website SHALL VCknots_Library のデフォルトのインメモリプロバイダーをストレージ、鍵管理、DID 解決に使用する
5. THE Issuer_Website SHALL did:key メソッドを DID 解決に使用する
6. THE Verifier_Website SHALL did:key メソッドを DID 解決に使用する

### 要件 15: 発行者ウェブサイトの UI

**ユーザーストーリー:** 発行者の操作者として、資格情報の発行操作を行うためのウェブ UI を使用したい。直感的に資格情報を発行できるようにするためである。

#### 受け入れ基準

1. THE Issuer_Website SHALL 資格情報タイプの選択、属性値の入力、およびオファー生成のためのフォームを提供する
2. WHEN 発行者がオファーを生成した時、THE Issuer_Website SHALL Credential_Offer の QR コードを画面に表示する
3. THE Issuer_Website SHALL 発行済み資格情報の履歴一覧を表示する
4. WHILE 資格情報の発行処理中、THE Issuer_Website SHALL 処理状態（オファー作成済み、トークン発行済み、資格情報発行完了）を表示する

### 要件 16: 検証者ウェブサイトの UI

**ユーザーストーリー:** 検証者の操作者として、資格情報の検証操作を行うためのウェブ UI を使用したい。直感的に資格情報を検証できるようにするためである。

#### 受け入れ基準

1. THE Verifier_Website SHALL 検証する資格情報タイプの選択と認可リクエスト生成のためのフォームを提供する
2. WHEN 検証者が認可リクエストを生成した時、THE Verifier_Website SHALL 認可リクエストの QR コードを画面に表示する
3. WHEN 検証が完了した時、THE Verifier_Website SHALL 検証結果（成功または失敗）と資格情報の内容を画面に表示する
4. WHILE 検証処理中、THE Verifier_Website SHALL 処理状態（リクエスト作成済み、プレゼンテーション受信済み、検証完了）を表示する

### 要件 17: エンドツーエンドの発行フロー

**ユーザーストーリー:** システム利用者として、発行者からウォレットへの資格情報発行の一連のフローが正常に動作することを確認したい。システム全体の整合性を保証するためである。

#### 受け入れ基準

1. WHEN 発行者が Credential_Offer を生成し、Browser_Wallet がオファーを読み取った時、THE Browser_Wallet SHALL Pre_Authorized_Code_Flow に従って Issuer_Website から Verifiable_Credential を取得し、ローカルストレージに保存する
2. WHEN 発行フローが完了した時、THE Browser_Wallet SHALL 取得した Verifiable_Credential の内容が Issuer_Website で入力した属性値と一致することを確認できる形で表示する
3. IF 発行フローの途中でネットワークエラーが発生した場合、THEN THE Browser_Wallet SHALL エラーメッセージを表示し、ユーザーに再試行の選択肢を提供する

### 要件 18: エンドツーエンドの検証フロー

**ユーザーストーリー:** システム利用者として、ウォレットから検証者への資格情報提示と検証の一連のフローが正常に動作することを確認したい。システム全体の整合性を保証するためである。

#### 受け入れ基準

1. WHEN 検証者が認可リクエストを生成し、Browser_Wallet がリクエストを読み取った時、THE Browser_Wallet SHALL 保存済み資格情報から条件に一致するものを選択し、Verifiable_Presentation を生成して Verifier_Website に送信する
2. WHEN Verifier_Website が Verifiable_Presentation を受信した時、THE Verifier_Website SHALL プレゼンテーションと含まれる資格情報の署名を検証し、結果を表示する
3. IF 検証フローの途中でネットワークエラーが発生した場合、THEN THE Browser_Wallet SHALL エラーメッセージを表示し、ユーザーに再試行の選択肢を提供する


### 要件 19: アクティビティログの記録と表示

**ユーザーストーリー:** システム利用者として、各コンポーネントで実行された操作のアクティビティログを確認したい。すべての操作を監視し、問題発生時のトラブルシューティングを容易にするためである。

#### 受け入れ基準

1. WHEN Issuer_Website が Credential_Offer を生成した時、THE Issuer_Website SHALL 資格情報オファー作成のアクティビティログ（タイムスタンプ、資格情報タイプ、操作結果）を記録する
2. WHEN Issuer_Website が Verifiable_Credential を発行した時、THE Issuer_Website SHALL 資格情報発行完了のアクティビティログ（タイムスタンプ、資格情報タイプ、発行先 DID、操作結果）を記録する
3. IF Issuer_Website で資格情報の発行処理が失敗した場合、THEN THE Issuer_Website SHALL 失敗のアクティビティログ（タイムスタンプ、エラー理由、操作種別）を記録する
4. WHEN Browser_Wallet が Credential_Offer を受信した時、THE Browser_Wallet SHALL 資格情報オファー受信のアクティビティログ（タイムスタンプ、発行者情報、資格情報タイプ）を記録する
5. WHEN Browser_Wallet が Verifiable_Credential を取得して保存した時、THE Browser_Wallet SHALL 資格情報受け入れ完了のアクティビティログ（タイムスタンプ、発行者情報、資格情報タイプ、操作結果）を記録する
6. WHEN Browser_Wallet が Verifiable_Presentation を Verifier_Website に送信した時、THE Browser_Wallet SHALL プレゼンテーション提出のアクティビティログ（タイムスタンプ、検証者情報、提示した資格情報タイプ）を記録する
7. WHEN Verifier_Website が認可リクエストを生成した時、THE Verifier_Website SHALL プレゼンテーションリクエスト作成のアクティビティログ（タイムスタンプ、要求する資格情報タイプ）を記録する
8. WHEN Verifier_Website が Verifiable_Presentation を受信した時、THE Verifier_Website SHALL プレゼンテーション受信のアクティビティログ（タイムスタンプ、提示者 DID、資格情報タイプ）を記録する
9. WHEN Verifier_Website が検証処理を完了した時、THE Verifier_Website SHALL 検証結果のアクティビティログ（タイムスタンプ、検証結果（成功または失敗）、失敗理由（該当する場合））を記録する
10. THE Issuer_Website SHALL アクティビティログの一覧を時系列で表示する UI を提供する
11. THE Browser_Wallet SHALL アクティビティログの一覧を時系列で表示する UI を提供する
12. THE Verifier_Website SHALL アクティビティログの一覧を時系列で表示する UI を提供する
