import { describe, it, expect, beforeEach } from 'vitest';
import { analysisClientFactory } from '../analysisClient.factory';

describe('analysisClientFactory — configuration & adapter switching', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    analysisClientFactory.resetConfig();
  });

  it('defaults to mock mode with normalized localhost baseUrl', () => {
    const cfg = analysisClientFactory.getConfig();
    expect(cfg.mode).toBe('mock');
    expect(cfg.baseUrl).toBe('http://localhost:8000');
    expect(analysisClientFactory.getClient().mode).toBe('mock');
  });

  it('normalizes trailing slashes on baseUrl and switches between mock and http clients', () => {
    const updated = analysisClientFactory.saveConfig({
      mode: 'http',
      baseUrl: 'https://api.dojo-lab.edu.tw///',
      timeoutMs: 45000,
    });

    expect(updated.mode).toBe('http');
    expect(updated.baseUrl).toBe('https://api.dojo-lab.edu.tw');
    expect(updated.timeoutMs).toBe(45000);
    expect(analysisClientFactory.getClient().mode).toBe('http');
  });

  it('returns instant health check ok in mock mode', async () => {
    analysisClientFactory.saveConfig({ mode: 'mock' });
    const health = await analysisClientFactory.checkBackendHealth();
    expect(health.ok).toBe(true);
    expect(health.mode).toBe('mock');
  });
});
