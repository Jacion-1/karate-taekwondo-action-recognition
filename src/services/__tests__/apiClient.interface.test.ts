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

describe('apiClient.interface — validator & biomechanics metrics', () => {
  it('calculates complianceRate, peakDeviationDeg, stabilityScore, and explosivenessScore accurately', () => {
    const sample: ActionAnalysisResponse = {
      analysisId: 'ana-1',
      videoId: 'vid-1',
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
          { time: 0.0, actualAngle: 80, standardMin: 75, standardMax: 85 }, // compliant
          { time: 0.5, actualAngle: 150, standardMin: 160, standardMax: 175 }, // out by 10 deg
          { time: 1.0, actualAngle: 170, standardMin: 165, standardMax: 175 }, // compliant
          { time: 1.5, actualAngle: 82, standardMin: 75, standardMax: 85 }, // compliant
        ],
      },
    };

    const metrics = computeBiomechanicsMetrics(sample);
    expect(metrics.complianceRate).toBe(75); // 3 out of 4 points within range
    expect(metrics.peakDeviationDeg).toBe(10);
    expect(metrics.stabilityScore).toBeGreaterThan(0);
    expect(metrics.explosivenessScore).toBeGreaterThan(0);
  });

  it('handles empty time series points without NaN', () => {
    const emptySample: ActionAnalysisResponse = {
      analysisId: 'ana-empty',
      videoId: 'vid-empty',
      actionType: 'side_kick',
      confidence: 92.1,
      totalScore: 70,
      grade: 'C',
      duration: 1.0,
      feedbackSummary: 'Empty',
      defects: [],
      angleTimeSeries: {
        jointName: 'left_knee',
        points: [],
      },
    };

    const metrics = computeBiomechanicsMetrics(emptySample);
    expect(metrics.complianceRate).toBe(0);
    expect(metrics.peakDeviationDeg).toBe(0);
  });

  it('validates and normalizes a valid backend response payload including recognition confidence', () => {
    const rawPayload = {
      analysisId: 'ana-remote-99',
      actionType: 'roundhouse_kick',
      confidence: 96.8,
      totalScore: 91,
      grade: 'A',
      duration: 3.1,
      feedbackSummary: 'Excellent kick',
      defects: [],
      angleTimeSeries: {
        jointName: 'right_knee',
        points: [{ time: 0.1, actualAngle: 120, standardMin: 110, standardMax: 130 }],
      },
    };

    const validated = validateAnalysisResponse(rawPayload, 'vid-fallback-1');
    expect(validated.videoId).toBe('vid-fallback-1');
    expect(validated.analysisId).toBe('ana-remote-99');
    expect(validated.actionType).toBe('roundhouse_kick');
    expect(validated.confidence).toBe(96.8);
    expect(validated.allJointSeries?.length).toBe(1);
    expect(validated.angleTimeSeries.points[0].standardBand).toEqual([110, 130]);
  });

  it('supports all 8 Karate and Taekwondo techniques in ACTION_METADATA', () => {
    const actionKeys = Object.keys(ACTION_METADATA) as ActionType[];
    expect(actionKeys.length).toBe(8);
    for (const act of actionKeys) {
      const meta = ACTION_METADATA[act];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.terminology.length).toBeGreaterThan(0);
      expect(meta.primaryJoints.length).toBeGreaterThan(0);

      const validated = validateAnalysisResponse({
        analysisId: `ana-${act}`,
        actionType: act,
        totalScore: 86,
        angleTimeSeries: {
          jointName: meta.primaryJoints[0],
          points: [{ time: 0.5, actualAngle: 165, standardMin: 160, standardMax: 175 }],
        },
      });
      expect(validated.actionType).toBe(act);
    }
  });

  it('provides a default confidence when backend omits confidence field', () => {
    const rawPayloadWithoutConfidence = {
      analysisId: 'ana-remote-100',
      actionType: 'straight_punch',
      totalScore: 85,
      angleTimeSeries: {
        jointName: 'right_elbow',
        points: [{ time: 0.0, actualAngle: 90, standardMin: 80, standardMax: 100 }],
      },
    };

    const validated = validateAnalysisResponse(rawPayloadWithoutConfidence, 'vid-100');
    expect(validated.confidence).toBeGreaterThanOrEqual(80);
    expect(validated.confidence).toBeLessThanOrEqual(100);
    expect(validated.keyframes).toEqual({
      preparation: 0.8,
      impact: 1.5,
      recovery: 2.2,
    });
    expect(Array.isArray(validated.strengths)).toBe(true);
    expect(validated.strengths!.length).toBeGreaterThan(0);
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
