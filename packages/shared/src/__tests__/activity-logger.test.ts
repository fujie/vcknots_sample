import { describe, it, expect, beforeEach } from 'vitest';
import { ActivityLogger } from '../utils/activity-logger.js';
import type { ActivityLogEntry } from '../types/index.js';

function createEntry(overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: 'test-id',
    timestamp: new Date().toISOString(),
    component: 'issuer',
    action: 'offer_created',
    status: 'success',
    details: {},
    ...overrides,
  };
}

describe('ActivityLogger', () => {
  let logger: ActivityLogger;

  beforeEach(() => {
    logger = new ActivityLogger();
  });

  it('should start with an empty log', () => {
    expect(logger.getLogs()).toEqual([]);
  });

  it('should record a log entry', () => {
    const entry = createEntry();
    logger.log(entry);
    const logs = logger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(entry);
  });

  it('should return logs in reverse chronological order (newest first)', () => {
    const older = createEntry({
      id: 'older',
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    const newer = createEntry({
      id: 'newer',
      timestamp: '2024-06-01T00:00:00.000Z',
    });

    logger.log(older);
    logger.log(newer);

    const logs = logger.getLogs();
    expect(logs[0].id).toBe('newer');
    expect(logs[1].id).toBe('older');
  });

  it('should return a copy of logs (not a reference)', () => {
    const entry = createEntry();
    logger.log(entry);

    const logs1 = logger.getLogs();
    const logs2 = logger.getLogs();
    expect(logs1).not.toBe(logs2);
    expect(logs1).toEqual(logs2);
  });

  it('should clear all logs', () => {
    logger.log(createEntry({ id: '1' }));
    logger.log(createEntry({ id: '2' }));
    expect(logger.getLogs()).toHaveLength(2);

    logger.clear();
    expect(logger.getLogs()).toEqual([]);
  });

  it('should record entries with failure status and errorReason', () => {
    const entry = createEntry({
      status: 'failure',
      action: 'issuance_failed',
      errorReason: 'Schema not found',
    });
    logger.log(entry);

    const logs = logger.getLogs();
    expect(logs[0].status).toBe('failure');
    expect(logs[0].errorReason).toBe('Schema not found');
  });
});
