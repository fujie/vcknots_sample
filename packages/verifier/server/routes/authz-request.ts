import { Router } from 'express';
import type { VerifierService } from '../services/verifier-service.js';

/**
 * 認可リクエスト関連ルート:
 * - POST /api/authz-requests — 認可リクエスト生成
 * - GET /api/authz-requests/:id — 認可リクエスト取得
 */
export function createAuthzRequestRouter(verifierService: VerifierService): Router {
  const router = Router();

  /**
   * POST /api/authz-requests
   * 認可リクエストを生成する
   */
  router.post('/api/authz-requests', async (req, res, next) => {
    try {
      const { credentialType } = req.body;

      if (!credentialType) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'The credentialType parameter is required.',
        });
        return;
      }

      const authzRequest = await verifierService.createAuthzRequest(credentialType);

      res.status(201).json(authzRequest);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/authz-requests/:id
   * 認可リクエスト詳細を取得する
   */
  router.get('/api/authz-requests/:id', (req, res) => {
    const authzRequest = verifierService.getAuthzRequest(req.params.id);
    if (!authzRequest) {
      res.status(404).json({
        error: 'not_found',
        error_description: 'Authorization request not found.',
      });
      return;
    }
    res.json(authzRequest);
  });

  return router;
}
