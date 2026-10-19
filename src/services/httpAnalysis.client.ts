import { AnalysisJobAcceptedSchema } from '../contract/analysis.schema';
import type {
  ActionAnalysisResponse,
  LocalVideoRecord,
} from '../types/martial-arts.types';
import { videoRepository } from '../db/repositories/video.repo';
import {
  ApiClientError,
  validateAnalysisResponse,
  type ApiConnectionConfig,
  type IAnalysisApiClient,
  type UploadAnalyzeOptions,
} from './apiClient.interface';

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiClientError('使用者已取消分析', 'ABORTED'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ApiClientError('使用者已取消分析', 'ABORTED'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * 真實後端 HTTP REST API 客戶端實作
 * 支援：
 * - POST /api/v1/analyses (multipart/form-data: video, clientVideoId, duration, requestedActionType?)
 * - 同步模式 (200 OK 直接回傳完整分析結果) 與 非同步 Job 模式 (202 Accepted 輪詢 GET /api/v1/analyses/{analysisId})
 * - AbortSignal 中途取消與 Timeout 超時保護
 * - 嚴格回應結構驗證 (validateAnalysisResponse)
 */
export class HttpRestAnalysisClient implements IAnalysisApiClient {
  public readonly mode = 'http' as const;
  private readonly getConfig: () => ApiConnectionConfig;
  private readonly pollIntervalMs: number;

  constructor(
    getConfig: () => ApiConnectionConfig,
    options?: { pollIntervalMs?: number }
  ) {
    this.getConfig = getConfig;
    this.pollIntervalMs = options?.pollIntervalMs ?? 1500;
  }

  public async checkHealth(): Promise<{
    ok: boolean;
    latencyMs: number;
    message: string;
  }> {
    const config = this.getConfig();
    const start = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Math.min(config.timeoutMs, 6000)
    );

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(`${config.baseUrl}/api/v1/health`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      const latencyMs = Math.round(performance.now() - start);
      if (!response.ok) {
        return {
          ok: false,
          latencyMs,
          message: `HTTP ${response.status} ${response.statusText}`,
        };
      }

      return {
        ok: true,
        latencyMs,
        message: `後端服務連線正常 (HTTP ${response.status}, ${latencyMs}ms)`,
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? '連線逾時 (Timeout)'
          : err instanceof Error
            ? err.message
            : '無法連線至後端伺服器';
      return {
        ok: false,
        latencyMs,
        message: `無法連線至 ${config.baseUrl}/api/v1/health (${msg})`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async pollAnalysisJob(
    analysisId: string,
    videoId: string,
    config: ApiConnectionConfig,
    signal?: AbortSignal
  ): Promise<ActionAnalysisResponse> {
    const pollUrl = `${config.baseUrl}/api/v1/analyses/${encodeURIComponent(analysisId)}`;
    const startTime = Date.now();

    while (true) {
      if (signal?.aborted) {
        throw new ApiClientError('使用者已取消分析', 'ABORTED');
      }
      if (Date.now() - startTime >= config.timeoutMs) {
        throw new ApiClientError(
          `後端非同步推論逾時 (超過 ${Math.round(config.timeoutMs / 1000)} 秒)`,
          'TIMEOUT'
        );
      }

      await sleepWithAbort(this.pollIntervalMs, signal);

      if (Date.now() - startTime >= config.timeoutMs) {
        throw new ApiClientError(
          `後端非同步推論逾時 (超過 ${Math.round(config.timeoutMs / 1000)} 秒)`,
          'TIMEOUT'
        );
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      let response: Response;
      try {
        response = await fetch(pollUrl, {
          method: 'GET',
          headers,
          signal,
        });
      } catch (err) {
        if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
          throw new ApiClientError('使用者已取消分析', 'ABORTED');
        }
        throw new ApiClientError(
          `輪詢後端狀態失敗 (${pollUrl})`,
          'NETWORK_ERROR',
          undefined,
          err
        );
      }

      if (!response.ok) {
        throw new ApiClientError(
          `輪詢後端回應錯誤 HTTP ${response.status} (${response.statusText || 'Error'})`,
          'HTTP_ERROR',
          response.status
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new ApiClientError('輪詢回應非有效 JSON', 'INVALID_PAYLOAD');
      }

      if (!body || typeof body !== 'object') {
        throw new ApiClientError('輪詢回應格式無效', 'INVALID_PAYLOAD');
      }

      const record = body as Record<string, unknown>;
      if (record.status === 'processing') {
        continue;
      }
      if (record.status === 'failed') {
        const reason =
          typeof record.errorMessage === 'string' && record.errorMessage
            ? record.errorMessage
            : '後端非同步分析任務失敗';
        throw new ApiClientError(reason, 'HTTP_ERROR', 500, body);
      }

      const candidatePayload =
        record.result && typeof record.result === 'object' ? record.result : body;
      return validateAnalysisResponse(candidatePayload, videoId);
    }
  }

  public async uploadAndAnalyzeVideo(
    video: LocalVideoRecord,
    options?: UploadAnalyzeOptions
  ): Promise<ActionAnalysisResponse> {
    const config = this.getConfig();
    const endpoint = `${config.baseUrl}/api/v1/analyses`;

    try {
      await videoRepository.updateUploadStatus(video.id, 'uploading', {
        uploadProgress: 0,
        errorMessage: undefined,
      });
    } catch {
      // 忽略本地 DB 狀態更新失敗，不阻斷請求
    }

    return new Promise<ActionAnalysisResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.timeout = config.timeoutMs;
      xhr.responseType = 'json';

      if (config.apiKey) {
        xhr.setRequestHeader('Authorization', `Bearer ${config.apiKey}`);
      }

      const onAbortSignal = () => xhr.abort();
      if (options?.signal) {
        if (options.signal.aborted) {
          xhr.abort();
          reject(new ApiClientError('使用者已取消上傳', 'ABORTED'));
          return;
        }
        options.signal.addEventListener('abort', onAbortSignal, { once: true });
      }

      const cleanupAbortListener = () => {
        options?.signal?.removeEventListener('abort', onAbortSignal);
      };

      xhr.upload.onprogress = async (event: ProgressEvent) => {
        if (event.lengthComputable) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          options?.onProgress?.(percent, 'uploading');
          try {
            await videoRepository.updateUploadStatus(video.id, 'uploading', {
              uploadProgress: percent,
            });
          } catch {
            // ignore DB error
          }
        }
      };

      xhr.upload.onload = async () => {
        options?.onProgress?.(100, 'processing');
        try {
          await videoRepository.updateUploadStatus(video.id, 'processing', {
            uploadProgress: 100,
          });
        } catch {
          // ignore DB error
        }
      };

      xhr.onload = async () => {
        cleanupAbortListener();
        if (xhr.status === 202) {
          try {
            const payload =
              xhr.response ??
              (xhr.responseText ? JSON.parse(xhr.responseText) : null);
            const accepted = AnalysisJobAcceptedSchema.safeParse(payload);
            if (!accepted.success) {
              throw new ApiClientError(
                '後端 202 Accepted 回應缺少有效的 analysisId 或 status',
                'INVALID_PAYLOAD',
                202,
                accepted.error.issues
              );
            }

            if (accepted.data.status === 'failed') {
              throw new ApiClientError(
                accepted.data.errorMessage || '後端分析任務啟動失敗',
                'HTTP_ERROR',
                500
              );
            }

            options?.onProgress?.(100, 'processing');
            try {
              await videoRepository.updateUploadStatus(video.id, 'processing', {
                uploadProgress: 100,
                analysisId: accepted.data.analysisId,
              });
            } catch {
              // ignore DB error
            }

            const validated = await this.pollAnalysisJob(
              accepted.data.analysisId,
              video.id,
              config,
              options?.signal
            );
            try {
              await videoRepository.saveAnalysisResult(video.id, validated);
            } catch {
              // ignore DB error
            }
            resolve(validated);
          } catch (err) {
            const apiErr =
              err instanceof ApiClientError
                ? err
                : new ApiClientError(
                    err instanceof Error ? err.message : '非同步分析輪詢失敗',
                    'INVALID_PAYLOAD'
                  );
            reject(apiErr);
            try {
              await videoRepository.updateUploadStatus(
                video.id,
                apiErr.code === 'ABORTED' ? 'local_saved' : 'failed',
                {
                  errorMessage:
                    apiErr.code === 'ABORTED' ? undefined : apiErr.message,
                }
              );
            } catch {
              // ignore DB error
            }
          }
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const payload =
              xhr.response ??
              (xhr.responseText ? JSON.parse(xhr.responseText) : null);
            const validated = validateAnalysisResponse(payload, video.id);
            try {
              await videoRepository.saveAnalysisResult(video.id, validated);
            } catch {
              // ignore DB error
            }
            resolve(validated);
          } catch (err) {
            const apiErr =
              err instanceof ApiClientError
                ? err
                : new ApiClientError(
                    err instanceof Error ? err.message : '後端回傳資料解析失敗',
                    'INVALID_PAYLOAD'
                  );
            reject(apiErr);
            try {
              await videoRepository.updateUploadStatus(video.id, 'failed', {
                errorMessage: apiErr.message,
              });
            } catch {
              // ignore DB error
            }
          }
        } else {
          const errMsg = `後端回應錯誤 HTTP ${xhr.status} (${xhr.statusText || 'Error'})`;
          const apiErr = new ApiClientError(errMsg, 'HTTP_ERROR', xhr.status);
          reject(apiErr);
          try {
            await videoRepository.updateUploadStatus(video.id, 'failed', {
              errorMessage: errMsg,
            });
          } catch {
            // ignore DB error
          }
        }
      };

      xhr.onerror = async () => {
        cleanupAbortListener();
        const errMsg = `無法連線至後端 API (${endpoint})，請確認後端服務已啟動或切換回 Mock 模擬模式`;
        const apiErr = new ApiClientError(errMsg, 'NETWORK_ERROR');
        reject(apiErr);
        try {
          await videoRepository.updateUploadStatus(video.id, 'failed', {
            errorMessage: errMsg,
          });
        } catch {
          // ignore DB error
        }
      };

      xhr.ontimeout = async () => {
        cleanupAbortListener();
        const errMsg = `後端推論逾時 (超過 ${Math.round(config.timeoutMs / 1000)} 秒)`;
        const apiErr = new ApiClientError(errMsg, 'TIMEOUT');
        reject(apiErr);
        try {
          await videoRepository.updateUploadStatus(video.id, 'failed', {
            errorMessage: errMsg,
          });
        } catch {
          // ignore DB error
        }
      };

      xhr.onabort = async () => {
        cleanupAbortListener();
        const errMsg = '上傳已取消';
        const apiErr = new ApiClientError(errMsg, 'ABORTED');
        reject(apiErr);
        try {
          await videoRepository.updateUploadStatus(video.id, 'local_saved', {
            uploadProgress: 0,
          });
        } catch {
          // ignore DB error
        }
      };

      const formData = new FormData();
      const ext = video.mimeType.includes('mp4') ? 'mp4' : 'webm';
      formData.append(
        'video',
        video.blob,
        video.fileName || `motion-${video.id}.${ext}`
      );
      if (video.requestedActionType) {
        formData.append('requestedActionType', video.requestedActionType);
      }
      formData.append('duration', String(video.duration));
      formData.append('clientVideoId', video.id);

      xhr.send(formData);
    });
  }
}
