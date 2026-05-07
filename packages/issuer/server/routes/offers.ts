import { Router } from 'express';
import type { IssuerService } from '../services/issuer-service.js';
import type { ActivityLogger } from '@vcknots-sample/shared';
import { SchemaService } from '../services/schema-service.js';
import { issuerEvents } from '../events.js';

/**
 * 内部 API ルート
 */
export function createOffersRouter(
  issuerService: IssuerService,
  activityLogger: ActivityLogger,
): Router {
  const router = Router();
  const schemaService = new SchemaService();

  /**
   * GET /api/schemas
   */
  router.get('/api/schemas', async (_req, res, next) => {
    try {
      const schemas = await schemaService.listSchemas();
      res.json(schemas);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/offers
   */
  router.post('/api/offers', async (req, res, next) => {
    try {
      const { credentialType, claims } = req.body;

      if (!credentialType) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'The credentialType parameter is required.',
        });
        return;
      }

      const offer = await issuerService.createOffer(credentialType, claims ?? {});

      const preAuthCode =
        offer.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.[
          'pre-authorized_code'
        ];

      const offerId = preAuthCode ?? crypto.randomUUID();
      res.status(201).json({ id: offerId, offer });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/offers/:id/events
   * SSE エンドポイント — オファーの発行状態をリアルタイムで通知する
   */
  router.get('/api/offers/:id/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // 初期状態を送信
    res.write(`data: ${JSON.stringify({ status: 'offer_created' })}\n\n`);

    // SSE クライアントとして登録
    issuerEvents.subscribe(req.params.id, res);
  });

  /**
   * GET /api/history
   */
  router.get('/api/history', (_req, res) => {
    const logs = activityLogger.getLogs();
    const history = logs.filter((log) => log.action === 'credential_issued');
    res.json(history);
  });

  /**
   * GET /api/activity-logs
   */
  router.get('/api/activity-logs', (_req, res) => {
    const logs = activityLogger.getLogs();
    res.json(logs);
  });

  return router;
}
