import type {
  ActionAnalysisResponse,
  ActionType,
  BiomechanicsSubMetrics,
  DefectItem,
  GradeLevel,
  JointAngleSeries,
  JointName,
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

const VALID_ACTIONS: ActionType[] = [
  'straight_punch',
  'age_uke',
  'gedan_barai',
  'front_kick',
  'roundhouse_kick',
  'side_kick',
  'back_kick',
  'axe_kick',
];
const VALID_GRADES: GradeLevel[] = ['A', 'B', 'C', 'D'];
const VALID_JOINTS: JointName[] = [
  'left_elbow',
  'right_elbow',
  'left_knee',
  'right_knee',
  'hip',
  'torso',
];

function normalizeSeries(rawSeries: unknown): JointAngleSeries {
  if (!rawSeries || typeof rawSeries !== 'object') {
    throw new ApiClientError(
      '後端回應缺少有效的 angleTimeSeries 結構',
      'INVALID_PAYLOAD'
    );
  }
  const s = rawSeries as Record<string, unknown>;
  const jointName = VALID_JOINTS.includes(s.jointName as JointName)
    ? (s.jointName as JointName)
    : 'right_elbow';

  if (!Array.isArray(s.points)) {
    throw new ApiClientError(
      'angleTimeSeries.points 必須為時序陣列',
      'INVALID_PAYLOAD'
    );
  }

  const points = s.points.map((pt: unknown, idx: number) => {
    const p = (pt && typeof pt === 'object' ? pt : {}) as Record<string, unknown>;
    const time = typeof p.time === 'number' ? p.time : Number((idx * 0.1).toFixed(1));
    const actualAngle = typeof p.actualAngle === 'number' ? p.actualAngle : 0;
    const standardMin = typeof p.standardMin === 'number' ? p.standardMin : 0;
    const standardMax = typeof p.standardMax === 'number' ? p.standardMax : 180;
    return {
      time,
      actualAngle,
      standardMin,
      standardMax,
      standardBand: [standardMin, standardMax] as [number, number],
    };
  });

  return { jointName, points };
}

/**
 * 嚴格驗證並正規化後端 API 回傳的 JSON 資料，確保前端 Recharts 與報表不會因格式缺漏而崩潰
 */
export function validateAnalysisResponse(
  raw: unknown,
  fallbackVideoId = 'unknown-video'
): ActionAnalysisResponse {
  if (!raw || typeof raw !== 'object') {
    throw new ApiClientError('後端回傳資料為空或非 JSON 物件', 'INVALID_PAYLOAD');
  }

  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.analysisId !== 'string' ||
    typeof obj.totalScore !== 'number' ||
    !obj.angleTimeSeries
  ) {
    throw new ApiClientError(
      '後端回傳 JSON 缺少必要欄位 (analysisId, totalScore, angleTimeSeries)',
      'INVALID_PAYLOAD',
      undefined,
      raw
    );
  }

  const primarySeries = normalizeSeries(obj.angleTimeSeries);
  const allJointSeries: JointAngleSeries[] = Array.isArray(obj.allJointSeries)
    ? obj.allJointSeries.map(normalizeSeries)
    : [primarySeries];

  const actionType: ActionType = VALID_ACTIONS.includes(obj.actionType as ActionType)
    ? (obj.actionType as ActionType)
    : 'straight_punch';

  const grade: GradeLevel = VALID_GRADES.includes(obj.grade as GradeLevel)
    ? (obj.grade as GradeLevel)
    : obj.totalScore >= 85
      ? 'A'
      : obj.totalScore >= 75
        ? 'B'
        : obj.totalScore >= 60
          ? 'C'
          : 'D';

  const defects: DefectItem[] = Array.isArray(obj.defects)
    ? (obj.defects as DefectItem[])
    : [];

  const rawConfidence =
    typeof obj.confidence === 'number' && !Number.isNaN(obj.confidence)
      ? obj.confidence
      : 95.4;
  const confidence = Math.max(0, Math.min(100, Math.round(rawConfidence * 10) / 10));
  const duration =
    typeof obj.duration === 'number' && obj.duration > 0 ? obj.duration : 3.0;

  const rawKf =
    obj.keyframes && typeof obj.keyframes === 'object'
      ? (obj.keyframes as Record<string, unknown>)
      : null;
  const keyframes = {
    preparation:
      rawKf && typeof rawKf.preparation === 'number'
        ? rawKf.preparation
        : Number((duration * 0.25).toFixed(1)),
    impact:
      rawKf && typeof rawKf.impact === 'number'
        ? rawKf.impact
        : Number((duration * 0.5).toFixed(1)),
    recovery:
      rawKf && typeof rawKf.recovery === 'number'
        ? rawKf.recovery
        : Number((duration * 0.72).toFixed(1)),
  };

  const strengths: string[] =
    Array.isArray(obj.strengths) && obj.strengths.length > 0
      ? obj.strengths.map((s) => String(s))
      : ['起動蓄力節奏穩定，重心轉換流暢', '發力軌跡符合標準生物力學力線'];

  return {
    analysisId: obj.analysisId,
    videoId: typeof obj.videoId === 'string' ? obj.videoId : fallbackVideoId,
    actionType,
    confidence,
    totalScore: Math.max(0, Math.min(100, Math.round(obj.totalScore))),
    grade,
    duration,
    feedbackSummary:
      typeof obj.feedbackSummary === 'string'
        ? obj.feedbackSummary
        : '已完成動作標準度時序分析。',
    strengths,
    keyframes,
    defects,
    angleTimeSeries: primarySeries,
    allJointSeries,
  };
}

/**
 * 根據時序點與瑕疵列表，計算運動生物力學細項指標
 */
export function computeBiomechanicsMetrics(
  analysis: ActionAnalysisResponse
): BiomechanicsSubMetrics {
  const points = analysis.angleTimeSeries?.points ?? [];
  if (points.length === 0) {
    return {
      complianceRate: 0,
      stabilityScore: Math.max(50, analysis.totalScore - 5),
      explosivenessScore: analysis.totalScore,
      peakDeviationDeg: 0,
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
  const torsoDefects = analysis.defects.filter(
    (d) => d.jointName === 'torso' || d.jointName === 'hip'
  ).length;
  const stabilityScore = Math.max(
    55,
    Math.min(99, Math.round(analysis.totalScore + 4 - torsoDefects * 6))
  );
  const explosivenessScore = Math.max(
    50,
    Math.min(99, Math.round((analysis.totalScore + complianceRate) / 2))
  );

  return {
    complianceRate,
    stabilityScore,
    explosivenessScore,
    peakDeviationDeg: Math.round(maxDeviation * 10) / 10,
  };
}
