import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ActivityLogger } from '@vcknots-sample/shared';
import { SchemaService } from './services/schema-service.js';
import { IssuerService } from './services/issuer-service.js';
import { createWellKnownRouter } from './routes/well-known.js';
import { createTokenRouter } from './routes/token.js';
import { createCredentialRouter } from './routes/credential.js';
import { createOffersRouter } from './routes/offers.js';

const app = express();
const PORT = 4001;

// CORS 設定
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 共有サービスインスタンスの生成
const activityLogger = new ActivityLogger();
const schemaService = new SchemaService();
const issuerService = new IssuerService(schemaService, activityLogger);

// サーバー起動時に発行者メタデータを初期化
issuerService.initialize().catch((err) => {
  console.error('Failed to initialize issuer metadata:', err);
});

// ルートのマウント
app.use(createWellKnownRouter(issuerService));
app.use(createTokenRouter(issuerService));
app.use(createCredentialRouter(issuerService));
app.use(createOffersRouter(issuerService, activityLogger));

// OID4VCI 標準エラーハンドリングミドルウェア
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = (err as any).statusCode ?? 500;
  const errorCode = (err as any).errorCode ?? 'server_error';
  const errorDescription = err.message ?? 'An unexpected error occurred.';

  console.error(`[ERROR] ${_req.method} ${_req.path}:`, err.message);
  if (statusCode === 500) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: errorCode,
    error_description: errorDescription,
  });
});

app.listen(PORT, () => {
  console.log(`Issuer server running on http://localhost:${PORT}`);
});

export { app, issuerService, activityLogger, schemaService };
