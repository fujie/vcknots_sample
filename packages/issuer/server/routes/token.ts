import { Router } from 'express';
import type { IssuerService } from '../services/issuer-service.js';
import { issuerEvents } from '../events.js';

/**
 * POST /token
 * トークンエンドポイント — Pre-Authorized Code を検証しアクセストークンを返す
 */
export function createTokenRouter(issuerService: IssuerService): Router {
  const router = Router();

  router.post('/token', async (req, res, next) => {
    try {
      const { grant_type, 'pre-authorized_code': preAuthorizedCode } = req.body;

      if (grant_type !== 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
        res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: 'Only pre-authorized_code grant type is supported.',
        });
        return;
      }

      if (!preAuthorizedCode) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'The pre-authorized_code parameter is required.',
        });
        return;
      }

      const tokenResponse = await issuerService.exchangeToken(preAuthorizedCode);

      // SSE でトークン交換完了を通知
      issuerEvents.notify(preAuthorizedCode, 'token_issued');

      res.json(tokenResponse);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
