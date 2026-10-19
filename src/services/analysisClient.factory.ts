import {
  type ApiConnectionConfig,
  type ApiMode,
  type IAnalysisApiClient,
} from './apiClient.interface';
import { HttpRestAnalysisClient } from './httpAnalysis.client';
import { mockAnalysisService } from './mockAnalysis.service';

const STORAGE_KEY = 'martial_arts_api_config_v1';

const DEFAULT_CONFIG: ApiConnectionConfig = {
  mode: 'mock',
  baseUrl: 'http://localhost:8000',
  timeoutMs: 30000,
  apiKey: '',
};

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_CONFIG.baseUrl;
  return trimmed.replace(/\/+$/, '');
}

class AnalysisClientFactory {
  private currentConfig: ApiConnectionConfig;
  private readonly httpClient: HttpRestAnalysisClient;
  private listeners = new Set<(config: ApiConnectionConfig) => void>();

  constructor() {
    this.currentConfig = this.loadFromStorage();
    this.httpClient = new HttpRestAnalysisClient(() => this.currentConfig);
  }

  private loadFromStorage(): ApiConnectionConfig {
    try {
      if (typeof localStorage === 'undefined') return { ...DEFAULT_CONFIG };
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw) as Partial<ApiConnectionConfig>;
      return {
        mode: parsed.mode === 'http' ? 'http' : 'mock',
        baseUrl: normalizeBaseUrl(parsed.baseUrl || DEFAULT_CONFIG.baseUrl),
        timeoutMs:
          typeof parsed.timeoutMs === 'number' && parsed.timeoutMs >= 3000
            ? parsed.timeoutMs
            : DEFAULT_CONFIG.timeoutMs,
        apiKey: parsed.apiKey || '',
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  public getConfig(): ApiConnectionConfig {
    return { ...this.currentConfig };
  }

  public saveConfig(partial: Partial<ApiConnectionConfig>): ApiConnectionConfig {
    const next: ApiConnectionConfig = {
      ...this.currentConfig,
      ...partial,
      baseUrl:
        partial.baseUrl !== undefined
          ? normalizeBaseUrl(partial.baseUrl)
          : this.currentConfig.baseUrl,
    };
    this.currentConfig = next;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      // Ignore storage quota errors
    }
    this.listeners.forEach((listener) => listener(this.getConfig()));
    return this.getConfig();
  }

  public resetConfig(): ApiConnectionConfig {
    return this.saveConfig({ ...DEFAULT_CONFIG });
  }

  public subscribe(listener: (config: ApiConnectionConfig) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getClient(): IAnalysisApiClient {
    return this.currentConfig.mode === 'http'
      ? this.httpClient
      : mockAnalysisService;
  }

  public async checkBackendHealth(): Promise<{
    ok: boolean;
    latencyMs: number;
    message: string;
    mode: ApiMode;
  }> {
    const client = this.getClient();
    const res = await client.checkHealth();
    return {
      ...res,
      mode: client.mode,
    };
  }
}

export const analysisClientFactory = new AnalysisClientFactory();
