import { describe, it, expect } from 'vitest';
import {
  computeBiomechanicsMetrics,
  validateAnalysisResponse,
  ApiClientError,
} from '../apiClient.interface';
import {
  ACTION_METADATA,
  type ActionAnalysisResponse,
  type ActionType,
} from '../../types/martial-arts.types';
import exampleResponseJson from '../../../docs/api/analysis-response.example.json';

describe('apiClient.interface — strict Zod validator & biomechanics metrics', () => {
  it('calculates complianceRate and peakDeviationDeg accurately', () => {
    const sample: ActionAnalysisResponse = {
      analysisId: 'ana-1',
      videoId: 'vid-1',
      source: 'mock',
      actionType: 'straight_punch',
      confidence: 96.4,
      totalScore: 88,
      grade: 'A',
      duration: 2.0,
      feedbackSummary: 'Good form',
      defects: [],
      angleTimeSeries: {
        jointName: 'right_elbow',
        points: [
          {
            time: 0.0,
            actualAngle: 80,
            standardMin: 75,
            standardMax: 85,
            standardBand: [75, 85],
          },
          {
            time: 0.5,
            actualAngle: 150,
            standardMin: 160,
            standardMax: 175,
            standardBand: [160, 175],
          },
          {
            time: 1.0,
            actualAngle: 170,
            standardMin: 165,
            standardMax: 175,
            standardBand: [165, 175],
          },
          {
            time: 1.5,
            actualAngle: 82,
            standardMin: 75,
            standardMax: 85,
            standardBand: [75, 85],
          },
        ],
      },
      allJointSeries: [],
    };

    const metrics = computeBiomechanicsMetrics(sample);
    expect(metrics.complianceRate).toBe(75);
    expect(metrics.peakDeviationDeg).toBe(10);
    // 未提供 analysis.metrics 時，不得推算 stabilityScore 與 explosivenessScore
    expect(metrics.stabilityScore).toBeUndefined();
    expect(metrics.explosivenessScore).toBeUndefined();

    const withBackendMetrics = computeBiomechanicsMetrics({
      ...sample,
      metrics: { stability: 91, explosiveness: 87 },
    });
    expect(withBackendMetrics.stabilityScore).toBe(91);
    expect(withBackendMetrics.explosivenessScore).toBe(87);
  });

  it('handles empty time series points without NaN', () => {
    const emptySample: ActionAnalysisResponse = {
      analysisId: 'ana-empty',
      videoId: 'vid-empty',
      source: 'backend',
      actionType: 'side_kick',
      totalScore: 70,
      grade: 'C',
      defects: [],
      angleTimeSeries: {
        jointName: 'left_knee',
        points: [],
      },
      allJointSeries: [],
    };

    const metrics = computeBiomechanicsMetrics(emptySample);
    expect(metrics.complianceRate).toBe(0);
    expect(metrics.peakDeviationDeg).toBe(0);
    expect(metrics.stabilityScore).toBeUndefined();
    expect(metrics.explosivenessScore).toBeUndefined();
  });

  it('validates docs/api/analysis-response.example.json against the contract schema', () => {
    const validated = validateAnalysisResponse(exampleResponseJson);
    expect(validated.analysisId).toBe('ana-20261019-001');
    expect(validated.source).toBe('backend');
    expect(validated.actionType).toBe('roundhouse_kick');
    expect(validated.frames?.length).toBe(2);
    expect(validated.metrics?.stability).toBe(89);
    expect(validated.defects.length).toBe(1);
    expect(validated.angleTimeSeries.points[0].standardBand).toEqual([60, 78]);
  });

  it('preserves undefined for omitted optional fields instead of fabricating defaults', () => {
    const minimalPayload = {
      analysisId: 'ana-minimal-1',
      source: 'backend',
      actionType: 'straight_punch',
      totalScore: 85,
      defects: [],
      angleTimeSeries: {
        jointName: 'right_elbow',
        points: [{ time: 0.0, actualAngle: 90, standardMin: 80, standardMax: 100 }],
      },
    };

    const validated = validateAnalysisResponse(minimalPayload, 'vid-minimal');
    expect(validated.videoId).toBe('vid-minimal');
    expect(validated.confidence).toBeUndefined();
    expect(validated.strengths).toBeUndefined();
    expect(validated.keyframes).toBeUndefined();
    expect(validated.feedbackSummary).toBeUndefined();
    expect(validated.frames).toBeUndefined();
    expect(validated.metrics).toBeUndefined();
  });

  it('supports all 12 Karate and Taekwondo techniques in ACTION_METADATA with honest provenance', () => {
    const actionKeys = Object.keys(ACTION_METADATA) as ActionType[];
    expect(actionKeys.length).toBe(12);
    for (const act of actionKeys) {
      const meta = ACTION_METADATA[act];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.terminology.length).toBeGreaterThan(0);
      expect(meta.primaryJoints.length).toBeGreaterThan(0);
      expect(meta.cameraViewHint.length).toBeGreaterThan(0);
      expect(meta.provenance.status).toBe('heuristic-unverified');
      expect(meta.provenance.citation).toBeUndefined();

      const validated = validateAnalysisResponse({
        analysisId: `ana-${act}`,
        source: 'mock',
        actionType: act,
        totalScore: 86,
        defects: [],
        angleTimeSeries: {
          jointName: meta.primaryJoints[0],
          points: [{ time: 0.5, actualAngle: 165, standardMin: 160, standardMax: 175 }],
        },
      });
      expect(validated.actionType).toBe(act);
    }
  });

  it('throws INVALID_PAYLOAD with Zod path when required fields (source, actionType, defects) are missing or invalid', () => {
    expect(() =>
      validateAnalysisResponse({
        analysisId: 'ana-missing-source',
        actionType: 'straight_punch',
        totalScore: 88,
        defects: [],
        angleTimeSeries: {
          jointName: 'right_elbow',
          points: [],
        },
      })
    ).toThrowError(/source/);

    expect(() =>
      validateAnalysisResponse({
        analysisId: 'ana-bad-defect',
        source: 'backend',
        actionType: 'straight_punch',
        totalScore: 88,
        defects: [
          {
            id: 'd1',
            timestamp: 1.0,
            jointName: 'right_elbow',
            currentValue: 140,
            standardRange: [160], // invalid tuple length
            message: 'Bad range',
            severity: 'moderate',
          },
        ],
        angleTimeSeries: {
          jointName: 'right_elbow',
          points: [],
        },
      })
    ).toThrowError(/defects\.0\.standardRange/);

    expect(() =>
      validateAnalysisResponse({
        analysisId: 'ana-bad-keypoint',
        source: 'backend',
        actionType: 'straight_punch',
        totalScore: 88,
        defects: [],
        frames: [
          {
            t: 0.5,
            keypoints: [{ name: 'right_elbow', x: 1.5, y: 0.5 }], // x > 1 out of normalized range
          },
        ],
        angleTimeSeries: {
          jointName: 'right_elbow',
          points: [],
        },
      })
    ).toThrowError(/frames\.0\.keypoints\.0\.x/);
  });

  it('throws ApiClientError with INVALID_PAYLOAD on malformed backend JSON', () => {
    expect(() => validateAnalysisResponse({ invalid: true })).toThrowError(ApiClientError);
    try {
      validateAnalysisResponse(null);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect((err as ApiClientError).code).toBe('INVALID_PAYLOAD');
    }
  });
});
