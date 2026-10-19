import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpRestAnalysisClient } from '../httpAnalysis.client';
import type { ApiConnectionConfig } from '../apiClient.interface';
import { parseHashRoute, buildHashUrl } from '../../shared/hooks/useHashRoute';
import type { LocalVideoRecord } from '../../types/martial-arts.types';
import examplePayload from '../../../docs/api/analysis-response.example.json';

interface MockXhrBehavior {
  status: number;
  statusText?: string;
  response?: unknown;
  triggerError?: boolean;
  triggerTimeout?: boolean;
  delayMs?: number;
}

let currentXhrBehavior: MockXhrBehavior = {
  status: 200,
  statusText: 'OK',
  response: examplePayload,
};

let lastCreatedXhr: MockXMLHttpRequest | null = null;
function trackXhr(instance: MockXMLHttpRequest): void {
  lastCreatedXhr = instance;
}

class MockXMLHttpRequest {
  public method = '';
  public url = '';
  public timeout = 0;
  public responseType = '';
  public status = 0;
  public statusText = '';
  public response: unknown = null;
  public responseText = '';
  public headers: Record<string, string> = {};
  public sentBody: FormData | null = null;

  public upload: {
    onprogress: ((event: ProgressEvent) => void) | null;
    onload: (() => void) | null;
  } = {
    onprogress: null,
    onload: null,
  };

  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public ontimeout: (() => void) | null = null;
  public onabort: (() => void) | null = null;

  private timerId: ReturnType<typeof setTimeout> | null = null;
  private isAborted = false;

  constructor() {
    trackXhr(this);
  }

  public open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  public setRequestHeader(key: string, value: string): void {
    this.headers[key] = value;
  }

  public send(body: FormData): void {
    this.sentBody = body;
    const behavior = { ...currentXhrBehavior };
    const delay = behavior.delayMs ?? 5;

    this.timerId = setTimeout(() => {
      if (this.isAborted) return;

      if (behavior.triggerError) {
        this.onerror?.();
        return;
      }

      if (behavior.triggerTimeout) {
        this.ontimeout?.();
        return;
      }

      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 50,
        total: 100,
      } as ProgressEvent);
      this.upload.onload?.();

      this.status = behavior.status;
      this.statusText = behavior.statusText ?? 'OK';
      this.response = behavior.response;
      this.responseText =
        typeof behavior.response === 'string'
          ? behavior.response
          : JSON.stringify(behavior.response);
      this.onload?.();
    }, delay);
  }

  public abort(): void {
    this.isAborted = true;
    if (this.timerId) {
      clearTimeout(this.timerId);
    }
    this.onabort?.();
  }
}

const sampleVideoRecord: LocalVideoRecord = {
  id: 'vid-http-test-001',
  fileName: 'test-kick.webm',
  blob: new Blob(['fake-video'], { type: 'video/webm' }),
  mimeType: 'video/webm',
  duration: 3.2,
  requestedActionType: 'roundhouse_kick',
  sourceType: 'camera',
  status: 'local_saved',
  uploadProgress: 0,
  createdAt: Date.now(),
};

const baseConfig: ApiConnectionConfig = {
  mode: 'http',
  baseUrl: 'https://api.example.com',
  timeoutMs: 5000,
  apiKey: 'secret-token-123',
};

describe('HttpRestAnalysisClient (Mock XHR & Fetch)', () => {
  beforeEach(() => {
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
    lastCreatedXhr = null;
    currentXhrBehavior = {
      status: 200,
      statusText: 'OK',
      response: examplePayload,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1. 200 OK 同步成功：正確送出 POST /api/v1/analyses 並回傳驗證後報告', async () => {
    const client = new HttpRestAnalysisClient(() => baseConfig);
    const progressEvents: Array<{ percent: number; phase: string }> = [];

    const result = await client.uploadAndAnalyzeVideo(sampleVideoRecord, {
      onProgress: (percent, phase) => progressEvents.push({ percent, phase }),
    });

    expect(lastCreatedXhr?.method).toBe('POST');
    expect(lastCreatedXhr?.url).toBe('https://api.example.com/api/v1/analyses');
    expect(lastCreatedXhr?.headers['Authorization']).toBe('Bearer secret-token-123');
    expect(lastCreatedXhr?.sentBody?.get('clientVideoId')).toBe('vid-http-test-001');
    expect(lastCreatedXhr?.sentBody?.get('requestedActionType')).toBe('roundhouse_kick');

    expect(result.analysisId).toBe(examplePayload.analysisId);
    expect(result.videoId).toBe(examplePayload.videoId);
    expect(result.source).toBe('backend');
    expect(progressEvents.some((e) => e.phase === 'uploading')).toBe(true);
    expect(progressEvents.some((e) => e.phase === 'processing')).toBe(true);
  });

  it('2. 4xx / 5xx 錯誤回應：應拋出 HTTP_ERROR 並包含 HTTP 狀態碼', async () => {
    currentXhrBehavior = {
      status: 502,
      statusText: 'Bad Gateway',
      response: { error: 'Upstream inference worker down' },
    };

    const client = new HttpRestAnalysisClient(() => baseConfig);

    await expect(
      client.uploadAndAnalyzeVideo(sampleVideoRecord)
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'HTTP_ERROR',
      status: 502,
    });
  });

  it('3. 請求逾時 (Timeout)：應拋出 TIMEOUT 錯誤', async () => {
    currentXhrBehavior = {
      status: 0,
      triggerTimeout: true,
    };

    const client = new HttpRestAnalysisClient(() => baseConfig);

    await expect(
      client.uploadAndAnalyzeVideo(sampleVideoRecord)
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'TIMEOUT',
    });
  });

  it('4. AbortController 取消：中途取消應拋出 ABORTED 錯誤', async () => {
    currentXhrBehavior = {
      status: 200,
      response: examplePayload,
      delayMs: 100,
    };

    const client = new HttpRestAnalysisClient(() => baseConfig);
    const controller = new AbortController();

    const promise = client.uploadAndAnalyzeVideo(sampleVideoRecord, {
      signal: controller.signal,
    });

    setTimeout(() => controller.abort(), 15);

    await expect(promise).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'ABORTED',
    });
  });

  it('5. 非法 Payload：後端回傳缺漏必填欄位時應拒絕並拋出 INVALID_PAYLOAD', async () => {
    currentXhrBehavior = {
      status: 200,
      statusText: 'OK',
      response: {
        analysisId: 'ana-broken',
        // 缺少 source, actionType, totalScore, defects, angleTimeSeries
      },
    };

    const client = new HttpRestAnalysisClient(() => baseConfig);

    await expect(
      client.uploadAndAnalyzeVideo(sampleVideoRecord)
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'INVALID_PAYLOAD',
    });
  });

  it('6. 202 Accepted 非同步輪詢：輪詢 GET /api/v1/analyses/{analysisId} 直到完成', async () => {
    currentXhrBehavior = {
      status: 202,
      statusText: 'Accepted',
      response: {
        analysisId: 'ana-async-999',
        status: 'processing',
      },
    };

    let pollCount = 0;
    const { videoId: _omittedVideoId, ...payloadWithoutVideoId } = examplePayload;
    const fetchMock = vi.fn(async (url: string) => {
      pollCount += 1;
      expect(url).toBe('https://api.example.com/api/v1/analyses/ana-async-999');

      if (pollCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            analysisId: 'ana-async-999',
            status: 'processing',
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          analysisId: 'ana-async-999',
          status: 'completed',
          result: {
            ...payloadWithoutVideoId,
            analysisId: 'ana-async-999',
          },
        }),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpRestAnalysisClient(() => baseConfig, {
      pollIntervalMs: 10,
    });

    const result = await client.uploadAndAnalyzeVideo(sampleVideoRecord);
    expect(pollCount).toBe(2);
    expect(result.analysisId).toBe('ana-async-999');
    expect(result.videoId).toBe('vid-http-test-001');
  });

  it('7. checkHealth()：正確呼叫 GET /api/v1/health 並回報健康狀態', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
      }))
    );

    const client = new HttpRestAnalysisClient(() => baseConfig);
    const health = await client.checkHealth();
    expect(health.ok).toBe(true);
    expect(health.message).toContain('HTTP 200');
  });
});

describe('useHashRoute URL 解析與建構工具', () => {
  it('正確解析 #/record、#/vault 與 #/report/:analysisId 路由', () => {
    expect(parseHashRoute('')).toEqual({
      page: 'record',
      focusAction: 'auto',
    });
    expect(parseHashRoute('#/record?focus=roundhouse_kick')).toEqual({
      page: 'record',
      focusAction: 'roundhouse_kick',
    });
    expect(parseHashRoute('#/vault')).toEqual({
      page: 'vault',
      focusAction: 'auto',
    });
    expect(
      parseHashRoute('#/report/ana-20261019-001?videoId=vid-123')
    ).toEqual({
      page: 'analysis',
      analysisId: 'ana-20261019-001',
      videoId: 'vid-123',
      focusAction: 'auto',
    });
  });

  it('正確建構對應之 Hash URL', () => {
    expect(buildHashUrl({ page: 'record' })).toBe('#/record');
    expect(
      buildHashUrl({ page: 'record', focusAction: 'front_kick' })
    ).toBe('#/record?focus=front_kick');
    expect(buildHashUrl({ page: 'vault' })).toBe('#/vault');
    expect(
      buildHashUrl({
        page: 'analysis',
        analysisId: 'ana-001',
        videoId: 'vid-001',
      })
    ).toBe('#/report/ana-001?videoId=vid-001');
  });
});
