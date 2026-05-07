import type { Response } from 'express';

/**
 * Server-Sent Events (SSE) マネージャー。
 * オファー ID ごとにクライアント接続を管理し、状態変更を通知する。
 */
class EventManager {
  private clients = new Map<string, Set<Response>>();

  /**
   * クライアントを登録する
   */
  subscribe(offerId: string, res: Response): void {
    if (!this.clients.has(offerId)) {
      this.clients.set(offerId, new Set());
    }
    this.clients.get(offerId)!.add(res);

    res.on('close', () => {
      this.clients.get(offerId)?.delete(res);
      if (this.clients.get(offerId)?.size === 0) {
        this.clients.delete(offerId);
      }
    });
  }

  /**
   * 状態変更を通知する
   */
  notify(offerId: string, status: string): void {
    const clients = this.clients.get(offerId);
    if (!clients) return;

    const data = JSON.stringify({ status });
    for (const res of clients) {
      res.write(`data: ${data}\n\n`);
    }
  }
}

export const issuerEvents = new EventManager();
