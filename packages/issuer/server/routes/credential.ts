import { Router } from 'express';
import type { IssuerService } from '../services/issuer-service.js';
import { issuerEvents } from '../events.js';

/**
 * POST /credential
 * 資格情報エンドポイント — アクセストークンを検証し JWT-VC を発行する
 */
export function createCredentialRouter(issuerService: IssuerService): Router {
  const router = Router();

  router.post('/credential', async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'invalid_token',
          error_description: 'A valid Bearer token is required.',
        });
        return;
      }

      const accessToken = authHeader.slice('Bearer '.length);
      const { proof, format, credential_definition } = req.body;

      if (!proof || !proof.jwt) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'The proof parameter with jwt field is required.',
        });
        return;
      }

      // preAuthorizedCode を取得（SSE 通知用）
      const preAuthCode = issuerService.getPreAuthCodeForToken(accessToken);

      const credential = await issuerService.issueCredential(accessToken, proof, {
        format,
        credential_definition,
      });

      // SSE で資格情報発行完了を通知
      if (preAuthCode) {
        issuerEvents.notify(preAuthCode, 'credential_issued');
      }

      res.json({ credential });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
