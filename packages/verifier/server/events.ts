import type { Response } from 'express';

/**
 * Server-Sent Events (SSE) マネージャー。
 * state ごとにクライアント接続を管理し、検証結果を通知する。
 */
class EventManager {
  private clients = new Map<string, Set<Response>>();

  subscribe(state: string, res: Response): void {
    if (!this.clients.has(state)) {
      this.clients.set(state, new Set());
    }
    this.clients.get(state)!.add(res);

    res.on('close', () => {
      this.clients.get(state)?.delete(res);
      if (this.clients.get(state)?.size === 0) {
        this.clients.delete(state);
      }
    });
  }

  notify(state: string, data: object): void {
    const clients = this.clients.get(state);
    if (!clients) return;

    const msg = JSON.stringify(data);
    for (const res of clients) {
      res.write(`data: ${msg}\n\n`);
    }
  }
}

export const verifierEvents = new EventManager();
