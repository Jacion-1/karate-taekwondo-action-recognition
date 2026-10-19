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

/**
 * 真實後端 HTTP REST API 客戶端實作
 * 支援：
 * - multipart/form-data 二進位視訊串流上傳與真實進度追蹤 (XMLHttpRequest upload.onprogress)
 * - AbortSignal 中途取消與 Timeout 超時保護
 * - 自動更新本機 IndexedDB 影片狀態 (uploading -> processing -> completed / failed)
 * - 嚴格回應結構驗證 (validateAnalysisResponse)
 */
export class HttpRestAnalysisClient implements IAnalysisApiClient {
  public readonly mode = 'http' as const;
  private readonly getConfig: () => ApiConnectionConfig;

  constructor(getConfig: () => ApiConnectionConfig) {
    this.getConfig = getConfig;
  }

  public async checkHealth(): Promise<{
    ok: boolean;
    latencyMs: number;
    message: string;
  }> {
    const config = this.getConfig();
    const start = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 6000));

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

  public async uploadAndAnalyzeVideo(
    video: LocalVideoRecord,
    options?: UploadAnalyzeOptions
  ): Promise<ActionAnalysisResponse> {
    const config = this.getConfig();
    const endpoint = `${config.baseUrl}/api/v1/analyses`;

    await videoRepository.updateUploadStatus(video.id, 'uploading', {
      uploadProgress: 0,
      errorMessage: undefined,
    });

    return new Promise<ActionAnalysisResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.timeout = config.timeoutMs;
      xhr.responseType = 'json';

      if (config.apiKey) {
        xhr.setRequestHeader('Authorization', `Bearer ${config.apiKey}`);
      }

      if (options?.signal) {
        if (options.signal.aborted) {
          xhr.abort();
          reject(new ApiClientError('使用者已取消上傳', 'ABORTED'));
          return;
        }
        options.signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }

      xhr.upload.onprogress = async (event: ProgressEvent) => {
        if (event.lengthComputable) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          options?.onProgress?.(percent, 'uploading');
          await videoRepository.updateUploadStatus(video.id, 'uploading', {
            uploadProgress: percent,
          });
          if (percent >= 99) {
            options?.onProgress?.(100, 'processing');
            await videoRepository.updateUploadStatus(video.id, 'processing', {
              uploadProgress: 100,
            });
          }
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const payload =
              xhr.response ??
              (xhr.responseText ? JSON.parse(xhr.responseText) : null);
            const validated = validateAnalysisResponse(payload, video.id);
            await videoRepository.saveAnalysisResult(video.id, validated);
            resolve(validated);
          } catch (err) {
            const apiErr =
              err instanceof ApiClientError
                ? err
                : new ApiClientError(
                    err instanceof Error ? err.message : '後端回傳資料解析失敗',
                    'INVALID_PAYLOAD'
                  );
            await videoRepository.updateUploadStatus(video.id, 'failed', {
              errorMessage: apiErr.message,
            });
            reject(apiErr);
          }
        } else {
          const errMsg = `後端回應錯誤 HTTP ${xhr.status} (${xhr.statusText || 'Error'})`;
          const apiErr = new ApiClientError(errMsg, 'HTTP_ERROR', xhr.status);
          await videoRepository.updateUploadStatus(video.id, 'failed', {
            errorMessage: errMsg,
          });
          reject(apiErr);
        }
      };

      xhr.onerror = async () => {
        const errMsg = `無法連線至後端 API (${endpoint})，請確認後端服務已啟動或切換回 Mock 模擬模式`;
        const apiErr = new ApiClientError(errMsg, 'NETWORK_ERROR');
        await videoRepository.updateUploadStatus(video.id, 'failed', {
          errorMessage: errMsg,
        });
        reject(apiErr);
      };

      xhr.ontimeout = async () => {
        const errMsg = `後端推論逾時 (超過 ${Math.round(config.timeoutMs / 1000)} 秒)`;
        const apiErr = new ApiClientError(errMsg, 'TIMEOUT');
        await videoRepository.updateUploadStatus(video.id, 'failed', {
          errorMessage: errMsg,
        });
        reject(apiErr);
      };

      xhr.onabort = async () => {
        const errMsg = '上傳已取消';
        const apiErr = new ApiClientError(errMsg, 'ABORTED');
        await videoRepository.updateUploadStatus(video.id, 'local_saved', {
          uploadProgress: 0,
        });
        reject(apiErr);
      };

      const formData = new FormData();
      const ext = video.mimeType.includes('mp4') ? 'mp4' : 'webm';
      formData.append(
        'video',
        video.blob,
        video.fileName || `motion-${video.id}.${ext}`
      );
      if (video.actionType) {
        formData.append('actionType', video.actionType);
      }
      formData.append('duration', String(video.duration));
      formData.append('clientVideoId', video.id);

      xhr.send(formData);
    });
  }
}
