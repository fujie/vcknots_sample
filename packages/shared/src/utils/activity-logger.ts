import type { ActivityLogEntry } from '../types/index.js';

/**
 * アクティビティログの記録・取得・クリアを行うクラス。
 * インメモリでログエントリを保持する。
 */
export class ActivityLogger {
  private logs: ActivityLogEntry[] = [];

  /**
   * ログエントリを記録する。
   */
  log(entry: ActivityLogEntry): void {
    this.logs.push(entry);
  }

  /**
   * ログ一覧を時系列降順（新しい順）で取得する。
   */
  getLogs(): ActivityLogEntry[] {
    return [...this.logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  /**
   * すべてのログをクリアする。
   */
  clear(): void {
    this.logs = [];
  }
}
