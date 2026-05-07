import { Router } from 'express';
import type { IssuerService } from '../services/issuer-service.js';

/**
 * GET /.well-known/openid-credential-issuer
 * OID4VCI メタデータエンドポイント
 */
export function createWellKnownRouter(issuerService: IssuerService): Router {
  const router = Router();

  router.get('/.well-known/openid-credential-issuer', async (_req, res, next) => {
    try {
      const metadata = await issuerService.getMetadata();
      res.json(metadata);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
