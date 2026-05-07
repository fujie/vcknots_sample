import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ActivityLogger } from '@vcknots-sample/shared';
import { VerifierService } from './services/verifier-service.js';
import { createWellKnownRouter } from './routes/well-known.js';
import { createAuthzRequestRouter } from './routes/authz-request.js';
import { createAuthzResponseRouter } from './routes/authz-response.js';

const app = express();
const PORT = 4002;

// CORS 設定
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 共有サービスインスタンスの生成
const activityLogger = new ActivityLogger();
const verifierService = new VerifierService(activityLogger);

// サーバー起動時に検証者メタデータを初期化
verifierService.initialize().catch((err) => {
  console.error('Failed to initialize verifier metadata:', err);
});

// ルートのマウント
app.use(createWellKnownRouter(verifierService));
app.use(createAuthzRequestRouter(verifierService));
app.use(createAuthzResponseRouter(verifierService, activityLogger));

// OID4VP 標準エラーハンドリングミドルウェア
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = (err as any).statusCode ?? 500;
  const errorCode = (err as any).errorCode ?? 'server_error';
  const errorDescription = err.message ?? 'An unexpected error occurred.';

  res.status(statusCode).json({
    error: errorCode,
    error_description: errorDescription,
  });
});

app.listen(PORT, () => {
  console.log(`Verifier server running on http://localhost:${PORT}`);
});

export { app, verifierService, activityLogger };
