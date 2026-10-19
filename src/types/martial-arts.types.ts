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

export interface ThresholdProvenance {
  status: 'heuristic-unverified' | 'cited';
  citation?: string;
}

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
    cameraViewHint: string;
    provenance: ThresholdProvenance;
  }
> = {
  straight_punch: {
    label: '後手逆突正拳',
    shortLabel: '逆突正拳',
    terminology: 'Gyaku-Zuki (逆突き) / Baro-Jireugi (바로지르기)',
    martialArt: '空手道',
    discipline: 'karate',
    category: '直線拳法',
    description: '檢視後腳蹬地與腰轉帶動、對側出拳直線度、終點旋腕鎖定（Kime）與回收速度',
    primaryJoints: ['right_elbow', 'torso', 'hip'],
    targetAngleHint: '標準肘伸展 165°–178°',
    cameraViewHint: '建議側面（與出拳方向垂直 90°）拍攝並保持全身入鏡，以利觀測手肘伸展與軀幹傾角。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  lunge_punch: {
    label: '前屈立・追擊順拳',
    shortLabel: '追擊順拳',
    terminology: 'Oi-Zuki (追い突き) / Bandae-Jireugi (반대지르기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '步法與正拳',
    description: '結合前屈立（Zenkutsu-Dachi / Ap-Kubi）重心 60:40 推進與同側正拳水平出擊，檢視前膝方向、後腳跟貼地與引手回收',
    primaryJoints: ['right_elbow', 'left_knee', 'torso'],
    targetAngleHint: '標準出拳肘角 165°–178°',
    cameraViewHint: '建議側面（90°）拍攝並保持全身入鏡，同時觀測前屈立弓步膝角、後腳跟貼地與同側出拳延伸。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  elbow_strike: {
    label: '近身肘擊',
    shortLabel: '近身肘擊',
    terminology: 'Empi-Uchi (猿臂打ち / 肘打ち)',
    martialArt: '空手道',
    discipline: 'karate',
    category: '近身肘法',
    description: '檢視前臂極限摺疊以肘尖擊打、腰胯旋轉帶動發力與對側引手拉回之雙向力偶',
    primaryJoints: ['right_elbow', 'hip', 'torso'],
    targetAngleHint: '標準摺疊肘角 35°–55°',
    cameraViewHint: '建議擊打側之斜前方 45° 或側面拍攝並保持全身入鏡，以利量測肘尖頂點之極限摺疊角度與腰部旋轉。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  age_uke: {
    label: '上段格擋',
    shortLabel: '上段格擋',
    terminology: 'Jodan Age-Uke (上段揚げ受け) / Eolgul-Makgi (얼굴막기)',
    martialArt: '空手道',
    discipline: 'karate',
    category: '防禦格擋',
    description: '檢視前臂由下往上斜上揚受、拳高於額頭一拳距離、定型肘角與另一手回收腰側（Hikite）',
    primaryJoints: ['right_elbow', 'left_elbow', 'torso'],
    targetAngleHint: '標準格擋肘角 92°–112°',
    cameraViewHint: '建議正面偏側 45° 或側面拍攝並保持全身入鏡，避免前臂重疊遮擋手肘關鍵點。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  soto_uke: {
    label: '中段外受格擋',
    shortLabel: '中段格擋',
    terminology: 'Soto-Uke (外受け) / Momtong-Makgi (몸통막기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '防禦格擋',
    description: '檢視前臂由外向內揮擺保護軀幹中線、定型時前臂垂直且肘呈約 90° 結構角與身體抗晃動穩定',
    primaryJoints: ['right_elbow', 'torso', 'hip'],
    targetAngleHint: '標準格擋肘角 85°–105°',
    cameraViewHint: '建議正面偏側 45° 拍攝並保持全身入鏡，清楚呈現前臂由外向內格擋軌跡與 90° 肘關節定型角。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  gedan_barai: {
    label: '下段格擋',
    shortLabel: '下段格擋',
    terminology: 'Gedan-Barai (下段払い) / Arae-Makgi (아래막기)',
    martialArt: '空手道',
    discipline: 'karate',
    category: '防禦格擋',
    description: '檢視耳側由上往下斜掃幅度、前腿上方終點定型肘角與下盤前屈立穩定度',
    primaryJoints: ['left_elbow', 'hip', 'torso'],
    targetAngleHint: '標準終點肘角 150°–168°',
    cameraViewHint: '建議格擋手側之側面或斜前 45° 拍攝並保持全身入鏡，確保下掃終點手肘與前腿不被遮擋。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  front_kick: {
    label: '前踢',
    shortLabel: '前踢',
    terminology: 'Mae-Geri (前蹴り) / Ap-Chagi (앞차기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '直線腿法',
    description: '檢視提膝收緊小腿、股四頭肌爆發彈踢、上身抗後仰、支撐腳平衡與擊後快速回收',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    targetAngleHint: '標準膝伸展 165°–178°',
    cameraViewHint: '踢擊類建議由踢擊腿側面（90°）拍攝且全身完整入鏡，以利量測矢狀面提膝與膝伸展角。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  roundhouse_kick: {
    label: '橫踢／迴旋踢',
    shortLabel: '迴旋踢',
    terminology: 'Dollyo-Chagi (돌려차기) / Mawashi-Geri (回し蹴り)',
    martialArt: '跆拳道',
    discipline: 'taekwondo',
    category: '迴旋腿法',
    description: '檢視支撐腳軸轉、髖關節打開、擊打瞬間小腿鞭打感延伸與落地回防穩定度',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    targetAngleHint: '標準膝伸展 160°–176°',
    cameraViewHint: '踢擊類建議側面拍攝且全身入鏡（預留踢擊高度空間），使翻髖完成後的膝伸展平面平行於鏡頭。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  side_kick: {
    label: '側踢',
    shortLabel: '側踢',
    terminology: 'Yeop-Chagi (옆차기) / Yoko-Geri (横蹴り)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '直線腿法',
    description: '檢視側身提膝蓄力、髖關節推送與足刀（Sokuto）／腳跟直線蹬出高度及抗側傾平衡',
    primaryJoints: ['left_knee', 'hip', 'torso'],
    targetAngleHint: '標準膝伸展 162°–177°',
    cameraViewHint: '踢擊類建議與側踢推進方向垂直之側面拍攝且全身入鏡，避免朝向鏡頭直踢造成透視縮短。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  back_kick: {
    label: '轉身後踢',
    shortLabel: '轉身後踢',
    terminology: 'Dwit-Chagi (뒷차기) / Ushiro-Geri (後ろ蹴り)',
    martialArt: '跆拳道',
    discipline: 'taekwondo',
    category: '旋轉腿法',
    description: '檢視 180° 轉身回頭看目標、夾膝直線以腳跟後踢（避免偏斜外擺）與中軸穩定',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    targetAngleHint: '標準後踹膝角 160°–175°',
    cameraViewHint: '踢擊類建議側面拍攝並確保全身與後踹延伸空間皆入鏡，以觀察轉身中軸與後踹膝伸展。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  axe_kick: {
    label: '下劈／下壓踢',
    shortLabel: '下壓踢',
    terminology: 'Naeryeo-Chagi (내려차기) / Kakato-Otoshi (踵落とし)',
    martialArt: '跆拳道',
    discipline: 'taekwondo',
    category: '高空劈腿',
    description: '檢視最高點高抬腿幅度、由上往下腳跟／腳掌下劈膝伸展、核心抗後仰與落地平衡',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    targetAngleHint: '標準劈落膝角 165°–179°',
    cameraViewHint: '踢擊類建議側面拍攝、全身入鏡並保留頭頂上方空間，以免高抬腿頂點超出取景框。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  hook_kick: {
    label: '勾踢／後旋踢',
    shortLabel: '勾踢',
    terminology: 'Huryeo-Chagi (후려차기) / Ura-Mawashi-Geri (裏回し蹴り)',
    martialArt: '跆拳道',
    discipline: 'taekwondo',
    category: '擺勾腿法',
    description: '檢視先伸直展髖再快速屈膝勾回、以腳跟或腳掌橫向勾打之動作連貫度與支撐腳平衡',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    targetAngleHint: '標準勾擊膝角 95°–125°',
    cameraViewHint: '踢擊類建議側面拍攝且全身入鏡，完整捕捉膝關節由伸展（約 165°）瞬間勾回（約 105°）的雙階段軌跡。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
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
// requestedActionType: 使用者手動鎖定的專項動作（undefined 代表 AI 自動比對識別）
// recognizedActionType: 分析完成後由後端／模擬器辨識出的動作類別
export interface LocalVideoRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  duration: number;
  createdAt: number;
  status: UploadStatus;
  requestedActionType?: ActionType;
  recognizedActionType?: ActionType;
  uploadProgress?: number;
  analysisId?: string;
  errorMessage?: string;
  thumbnailDataUrl?: string;
  sourceType?: VideoSourceType;
  fileName?: string;
}

// 3. 細項評估指標（stabilityScore 與 explosivenessScore 僅在後端 metrics 提供時存在，絕不由前端推算）
export interface BiomechanicsSubMetrics {
  complianceRate: number;
  peakDeviationDeg: number;
  stabilityScore?: number;
  explosivenessScore?: number;
}
