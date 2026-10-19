import { z } from 'zod';

export const ActionTypeSchema = z.enum([
  'straight_punch',
  'lunge_punch',
  'elbow_strike',
  'age_uke',
  'soto_uke',
  'gedan_barai',
  'front_kick',
  'roundhouse_kick',
  'side_kick',
  'back_kick',
  'axe_kick',
  'hook_kick',
]);

export const JointNameSchema = z.enum([
  'left_elbow',
  'right_elbow',
  'left_knee',
  'right_knee',
  'hip',
  'torso',
]);

export const SeverityLevelSchema = z.enum(['minor', 'moderate', 'critical']);

export const GradeLevelSchema = z.enum(['A', 'B', 'C', 'D']);

export const AnalysisSourceSchema = z.enum(['backend', 'mock']);

export const DefectItemSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().nonnegative(),
  jointName: JointNameSchema,
  currentValue: z.number(),
  standardRange: z.tuple([z.number(), z.number()]),
  message: z.string().min(1),
  prescription: z.string().optional(),
  severity: SeverityLevelSchema,
});

export const AngleTimeSeriesPointSchema = z
  .object({
    time: z.number().nonnegative(),
    actualAngle: z.number(),
    standardMin: z.number(),
    standardMax: z.number(),
    standardBand: z.tuple([z.number(), z.number()]).optional(),
  })
  .transform((pt) => ({
    ...pt,
    standardBand: pt.standardBand ?? ([pt.standardMin, pt.standardMax] as [number, number]),
  }));

export const JointAngleSeriesSchema = z.object({
  jointName: JointNameSchema,
  points: z.array(AngleTimeSeriesPointSchema),
});

export const ActionKeyframesSchema = z.object({
  preparation: z.number().nonnegative(),
  impact: z.number().nonnegative(),
  recovery: z.number().nonnegative(),
});

export const KeypointItemSchema = z.object({
  name: z.string().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  visibility: z.number().min(0).max(1).optional(),
});

export const FrameKeypointsSchema = z.object({
  t: z.number().nonnegative(),
  keypoints: z.array(KeypointItemSchema),
});

export const MeasuredMetricsSchema = z.object({
  stability: z.number().min(0).max(100).optional(),
  explosiveness: z.number().min(0).max(100).optional(),
});

export const ActionAnalysisPayloadSchema = z.object({
  analysisId: z.string().min(1),
  videoId: z.string().min(1).optional(),
  source: AnalysisSourceSchema,
  actionType: ActionTypeSchema,
  confidence: z.number().min(0).max(100).optional(),
  totalScore: z.number().min(0).max(100),
  grade: GradeLevelSchema.optional(),
  duration: z.number().positive().optional(),
  feedbackSummary: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  keyframes: ActionKeyframesSchema.optional(),
  modelVersion: z.string().optional(),
  fps: z.number().positive().optional(),
  frames: z.array(FrameKeypointsSchema).optional(),
  metrics: MeasuredMetricsSchema.optional(),
  defects: z.array(DefectItemSchema),
  angleTimeSeries: JointAngleSeriesSchema,
  allJointSeries: z.array(JointAngleSeriesSchema).optional(),
});

export const AnalysisJobAcceptedSchema = z.object({
  analysisId: z.string().min(1),
  status: z.enum(['processing', 'completed', 'failed']),
  errorMessage: z.string().optional(),
});

export type ActionType = z.infer<typeof ActionTypeSchema>;
export type JointName = z.infer<typeof JointNameSchema>;
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;
export type GradeLevel = z.infer<typeof GradeLevelSchema>;
export type AnalysisSource = z.infer<typeof AnalysisSourceSchema>;
export type DefectItem = z.infer<typeof DefectItemSchema>;
export type AngleTimeSeriesPoint = z.infer<typeof AngleTimeSeriesPointSchema>;
export type JointAngleSeries = z.infer<typeof JointAngleSeriesSchema>;
export type ActionKeyframes = z.infer<typeof ActionKeyframesSchema>;
export type KeypointItem = z.infer<typeof KeypointItemSchema>;
export type FrameKeypoints = z.infer<typeof FrameKeypointsSchema>;
export type MeasuredMetrics = z.infer<typeof MeasuredMetricsSchema>;

export type ActionAnalysisResponse = Omit<
  z.infer<typeof ActionAnalysisPayloadSchema>,
  'videoId' | 'grade' | 'allJointSeries'
> & {
  videoId: string;
  grade: GradeLevel;
  allJointSeries: JointAngleSeries[];
};
