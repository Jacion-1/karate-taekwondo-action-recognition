// ============================================================================
// 空手道與跆拳道動作識別系統 — 前後端資料交換規格與核心型別合約
// 回應結構型別統一由 src/contract/analysis.schema.ts 之 Zod Schema 產生
// ============================================================================

import type {
  ActionAnalysisResponse,
  ActionKeyframes,
  ActionType,
  AnalysisSource,
  AngleTimeSeriesPoint,
  DefectItem,
  FrameKeypoints,
  GradeLevel,
  JointAngleSeries,
  JointName,
  KeypointItem,
  MeasuredMetrics,
  SeverityLevel,
} from '../contract/analysis.schema';

export type {
  ActionAnalysisResponse,
  ActionKeyframes,
  ActionType,
  AnalysisSource,
  AngleTimeSeriesPoint,
  DefectItem,
  FrameKeypoints,
  GradeLevel,
  JointAngleSeries,
  JointName,
  KeypointItem,
  MeasuredMetrics,
  SeverityLevel,
};

// 1. 任務與連線狀態及共用基礎型別
export type NetworkStatus = 'online' | 'offline';
export type UploadStatus = 'local_saved' | 'uploading' | 'processing' | 'completed' | 'failed';
export type VideoSourceType = 'camera' | 'file_import' | 'synthetic_demo';

// 空手道與跆拳道動作設定字典（涵蓋 WKF 空手道基本功／組手與 WT 跆拳道品勢／競技核心技術）
export const ACTION_METADATA: Record<
  ActionType,
  {
    label: string;
    shortLabel: string;
    terminology: string;
    martialArt: string;
    discipline: 'karate' | 'taekwondo' | 'both';
    category: string;
    description: string;
    primaryJoints: JointName[];
    targetAngleHint: string;
  }
> = {
  straight_punch: {
    label: '正拳攻擊',
    shortLabel: '正拳攻擊',
    terminology: 'Gyaku-Zuki / 逆突き',
    martialArt: '空手道',
    discipline: 'karate',
    category: '直線拳法',
    description: '檢視後腳蹬地傳導、出拳直線度、終點旋腕鎖定（Kime）與軀幹垂直中軸',
    primaryJoints: ['right_elbow', 'torso', 'hip'],
    targetAngleHint: '標準肘伸展 165°–178°',
  },
  age_uke: {
    label: '上段格擋',
    shortLabel: '上段格擋',
    terminology: 'Jodan Age-Uke / 上段揚げ受け',
    martialArt: '空手道',
    discipline: 'karate',
    category: '防禦格擋',
    description: '檢視前臂由下往上交叉揚受軌跡、額前防禦架勢肘角與引手（Hikite）協同',
    primaryJoints: ['right_elbow', 'left_elbow', 'torso'],
    targetAngleHint: '標準格擋肘角 92°–112°',
  },
  gedan_barai: {
    label: '下段格擋',
    shortLabel: '下段格擋',
    terminology: 'Gedan-Barai / 下段払い',
    martialArt: '空手道',
    discipline: 'karate',
    category: '防禦格擋',
    description: '檢視耳側蓄力下掃力線、前腿上方終點定型肘角與前屈立骨盆穩定度',
    primaryJoints: ['left_elbow', 'hip', 'torso'],
    targetAngleHint: '標準終點肘角 150°–168°',
  },
  front_kick: {
    label: '前踢',
    shortLabel: '前踢',
    terminology: 'Mae-Geri / Ap-Chagi (앞차기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '直線腿法',
    description: '檢視矢狀面提膝摺疊高度、股四頭肌爆發彈踢膝伸展與支撐腳平衡',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    targetAngleHint: '標準膝伸展 165°–178°',
  },
  roundhouse_kick: {
    label: '迴旋踢',
    shortLabel: '迴旋踢',
    terminology: 'Dollyo-Chagi (돌려차기) / Mawashi-Geri',
    martialArt: '跆拳道',
    discipline: 'taekwondo',
    category: '迴旋腿法',
    description: '檢視支撐腳軸轉、翻髖角度、擊打瞬間小腿鞭甩膝伸展與收腿回防',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    targetAngleHint: '標準膝伸展 160°–176°',
  },
  side_kick: {
    label: '側踢',
    shortLabel: '側踢',
    terminology: 'Yeop-Chagi (옆차기) / Yoko-Geri',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '直線腿法',
    description: '檢視橫向提膝蓄力、側向直線推進力線與骨盆抗側傾平衡角',
    primaryJoints: ['left_knee', 'hip', 'torso'],
    targetAngleHint: '標準膝伸展 162°–177°',
  },
  back_kick: {
    label: '轉身後踢',
    shortLabel: '轉身後踢',
    terminology: 'Dwit-Chagi (뒷차기) / Ushiro-Geri',
    martialArt: '跆拳道',
    discipline: 'taekwondo',
    category: '旋轉腿法',
    description: '檢視 180° 背轉中軸穩定度、擦身直線後踹膝角（避免外擺）與回頭視線定位',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    targetAngleHint: '標準後踹膝角 160°–175°',
  },
  axe_kick: {
    label: '下壓踢',
    shortLabel: '下壓踢',
    terminology: 'Naeryeo-Chagi (내려차기) / Kakato-Otoshi',
    martialArt: '跆拳道',
    discipline: 'taekwondo',
    category: '高空劈腿',
    description: '檢視最高點髖關節極限屈曲抬腿高度、由上往下劈落膝伸展與核心抗後仰控制',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    targetAngleHint: '標準劈落膝角 165°–179°',
  },
};

export const JOINT_LABELS: Record<JointName, string> = {
  left_elbow: '左手肘',
  right_elbow: '右手肘',
  left_knee: '左膝蓋',
  right_knee: '右膝蓋',
  hip: '髖關節',
  torso: '軀幹軸線',
};

// 2. 本地儲存影片結構 (IndexedDB: videos table)
export interface LocalVideoRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  duration: number;
  createdAt: number;
  status: UploadStatus;
  actionType?: ActionType;
  uploadProgress?: number;
  analysisId?: string;
  errorMessage?: string;
  thumbnailDataUrl?: string;
  sourceType?: VideoSourceType;
  fileName?: string;
}

// 3. 細項評估指標
export interface BiomechanicsSubMetrics {
  complianceRate: number;
  stabilityScore: number;
  explosivenessScore: number;
  peakDeviationDeg: number;
}
