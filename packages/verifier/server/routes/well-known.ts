import { Router } from 'express';
import type { VerifierService } from '../services/verifier-service.js';

/**
 * GET /.well-known/openid-verifier
 * OID4VP メタデータエンドポイント
 */
export function createWellKnownRouter(verifierService: VerifierService): Router {
  const router = Router();

  router.get('/.well-known/openid-verifier', async (_req, res, next) => {
    try {
      const metadata = await verifierService.getMetadata();
      res.json(metadata);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
