import {
  ActionAnalysisPayloadSchema,
  type ActionAnalysisResponse,
  type GradeLevel,
} from '../contract/analysis.schema';
import type {
  BiomechanicsSubMetrics,
  LocalVideoRecord,
} from '../types/martial-arts.types';

export type ApiMode = 'mock' | 'http';

export interface ApiConnectionConfig {
  mode: ApiMode;
  baseUrl: string;
  timeoutMs: number;
  apiKey?: string;
}

export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'INVALID_PAYLOAD'
  | 'ABORTED';

export class ApiClientError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status?: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: ApiErrorCode,
    status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface UploadAnalyzeOptions {
  onProgress?: (percent: number, phase: 'uploading' | 'processing') => void;
  signal?: AbortSignal;
}

/**
 * 統一的前後端分析服務介面 (Adapter Pattern)
 */
export interface IAnalysisApiClient {
  readonly mode: ApiMode;
  uploadAndAnalyzeVideo(
    video: LocalVideoRecord,
    options?: UploadAnalyzeOptions
  ): Promise<ActionAnalysisResponse>;
  checkHealth(): Promise<{ ok: boolean; latencyMs: number; message: string }>;
}

function deriveGradeFromScore(score: number): GradeLevel {
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

/**
 * 嚴格驗證後端或模擬引擎回傳的 JSON 資料（基於單一 Zod Schema）
 * 缺漏必要欄位 (analysisId, source, actionType, totalScore, defects, angleTimeSeries) 或型別錯誤時拋出 INVALID_PAYLOAD，不填補偽造預設值
 */
export function validateAnalysisResponse(
  raw: unknown,
  fallbackVideoId = 'unknown-video'
): ActionAnalysisResponse {
  if (!raw || typeof raw !== 'object') {
    throw new ApiClientError('後端回傳資料為空或非 JSON 物件', 'INVALID_PAYLOAD');
  }

  const parsed = ActionAnalysisPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .map((iss) => {
        const pathStr = iss.path.length > 0 ? iss.path.join('.') : '<root>';
        return `${pathStr}: ${iss.message}`;
      })
      .join('; ');

    throw new ApiClientError(
      `後端回傳 JSON 未通過契約驗證 (${issueSummary})`,
      'INVALID_PAYLOAD',
      undefined,
      parsed.error.issues
    );
  }

  const data = parsed.data;
  const totalScore = Math.round(data.totalScore);
  const grade: GradeLevel = data.grade ?? deriveGradeFromScore(totalScore);
  const allJointSeries =
    data.allJointSeries && data.allJointSeries.length > 0
      ? data.allJointSeries
      : [data.angleTimeSeries];

  return {
    ...data,
    videoId: data.videoId ?? fallbackVideoId,
    totalScore,
    grade,
    allJointSeries,
  };
}

/**
 * 根據時序點實際計算標準角度達成率 (complianceRate) 與最大角度偏差 (peakDeviationDeg)。
 * 穩定度與爆發力僅在後端回傳 analysis.metrics 時原樣透傳，前端絕不以 totalScore 加減常數推算。
 */
export function computeBiomechanicsMetrics(
  analysis: ActionAnalysisResponse
): BiomechanicsSubMetrics {
  const points = analysis.angleTimeSeries?.points ?? [];
  const stabilityScore = analysis.metrics?.stability;
  const explosivenessScore = analysis.metrics?.explosiveness;

  if (points.length === 0) {
    return {
      complianceRate: 0,
      peakDeviationDeg: 0,
      stabilityScore,
      explosivenessScore,
    };
  }

  let compliantCount = 0;
  let maxDeviation = 0;

  for (const pt of points) {
    if (pt.actualAngle >= pt.standardMin && pt.actualAngle <= pt.standardMax) {
      compliantCount++;
    } else {
      const dev =
        pt.actualAngle < pt.standardMin
          ? pt.standardMin - pt.actualAngle
          : pt.actualAngle - pt.standardMax;
      if (dev > maxDeviation) {
        maxDeviation = dev;
      }
    }
  }

  const complianceRate = Math.round((compliantCount / points.length) * 100);

  return {
    complianceRate,
    peakDeviationDeg: Math.round(maxDeviation * 10) / 10,
    stabilityScore,
    explosivenessScore,
  };
}
