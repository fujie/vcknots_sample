import { Router } from 'express';
import type { VerifierService } from '../services/verifier-service.js';
import type { ActivityLogger } from '@vcknots-sample/shared';
import { verifierEvents } from '../events.js';

/**
 * 認可レスポンス関連ルート
 */
export function createAuthzResponseRouter(
  verifierService: VerifierService,
  activityLogger: ActivityLogger,
): Router {
  const router = Router();

  /**
   * POST /authz-response
   * VP トークンを受信して検証する
   */
  router.post('/authz-response', async (req, res, next) => {
    try {
      const { vp_token, presentation_submission, state } = req.body;

      if (!vp_token) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'The vp_token parameter is required.',
        });
        return;
      }

      // presentation_submission が文字列の場合は JSON パース
      let parsedSubmission = presentation_submission;
      if (typeof presentation_submission === 'string') {
        try {
          parsedSubmission = JSON.parse(presentation_submission);
        } catch {
          parsedSubmission = {};
        }
      }

      const result = await verifierService.verifyPresentation(
        vp_token,
        parsedSubmission ?? {},
        state,
      );

      // SSE で検証結果を通知
      if (state) {
        verifierEvents.notify(state, { status: 'verification_completed', result });
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/authz-requests/:state/events
   * SSE エンドポイント — 検証状態をリアルタイムで通知する
   */
  router.get('/api/authz-requests/:state/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    res.write(`data: ${JSON.stringify({ status: 'request_created' })}\n\n`);

    verifierEvents.subscribe(req.params.state, res);
  });

  /**
   * GET /api/verification-results/:state
   * 検証結果を取得する（フォールバック用）
   */
  router.get('/api/verification-results/:state', (req, res) => {
    const result = verifierService.getVerificationResult(req.params.state);
    if (!result) {
      res.status(404).json({ status: 'pending' });
      return;
    }
    res.json(result);
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
