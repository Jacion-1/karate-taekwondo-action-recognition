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
  FocusFeatureCode,
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
  FocusFeatureCode,
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

export interface FocusFeatureMeta {
  code: FocusFeatureCode;
  label: string;
  formula: string;
  scenario: string;
  unit: '°' | 'rel';
  kind: 'angle' | 'position';
}

/**
 * 完整對應《分段與關鍵特徵標註表 (MVP)》CSV 之 21 項下拉特徵選項
 * 註：左右為「選手自己」的左和右，不是螢幕的左右；x_rel 為水平相對位置，y_rel 為垂直相對位置（向下增加）。
 */
export const FOCUS_FEATURE_METADATA: Record<FocusFeatureCode, FocusFeatureMeta> = {
  left_elbow_deg: {
    code: 'left_elbow_deg',
    label: '左手肘角度',
    formula: '肩－肘－腕夾角（度）',
    scenario: '左手防禦或攻擊、手肘伸屈',
    unit: '°',
    kind: 'angle',
  },
  right_elbow_deg: {
    code: 'right_elbow_deg',
    label: '右手肘角度',
    formula: '肩－肘－腕夾角（度）',
    scenario: '右手防禦或攻擊、手肘伸屈',
    unit: '°',
    kind: 'angle',
  },
  left_shoulder_deg: {
    code: 'left_shoulder_deg',
    label: '左肩角度',
    formula: '肘－肩－髖夾角（度）',
    scenario: '左上臂抬高／下降',
    unit: '°',
    kind: 'angle',
  },
  right_shoulder_deg: {
    code: 'right_shoulder_deg',
    label: '右肩角度',
    formula: '肘－肩－髖夾角（度）',
    scenario: '右上臂抬高／下降',
    unit: '°',
    kind: 'angle',
  },
  left_hip_deg: {
    code: 'left_hip_deg',
    label: '左髖角度',
    formula: '肩－髖－膝夾角（度）',
    scenario: '左腿抬腿、屈髖姿態',
    unit: '°',
    kind: 'angle',
  },
  right_hip_deg: {
    code: 'right_hip_deg',
    label: '右髖角度',
    formula: '肩－髖－膝夾角（度）',
    scenario: '右腿抬腿、屈髖姿態',
    unit: '°',
    kind: 'angle',
  },
  left_knee_deg: {
    code: 'left_knee_deg',
    label: '左膝角度',
    formula: '髖－膝－踝夾角（度）',
    scenario: '左腿蹲、踢、站姿',
    unit: '°',
    kind: 'angle',
  },
  right_knee_deg: {
    code: 'right_knee_deg',
    label: '右膝角度',
    formula: '髖－膝－踝夾角（度）',
    scenario: '右腿蹲、踢、站姿',
    unit: '°',
    kind: 'angle',
  },
  left_wrist_x_rel: {
    code: 'left_wrist_x_rel',
    label: '左手腕橫向位置',
    formula: '相對髖中心的畫面水平位置／軀幹尺度',
    scenario: '左手橫向防禦／推移',
    unit: 'rel',
    kind: 'position',
  },
  left_wrist_y_rel: {
    code: 'left_wrist_y_rel',
    label: '左手腕高度位置',
    formula: '相對髖中心的畫面垂直位置／軀幹尺度',
    scenario: '左手上、中、下段動作',
    unit: 'rel',
    kind: 'position',
  },
  right_wrist_x_rel: {
    code: 'right_wrist_x_rel',
    label: '右手腕橫向位置',
    formula: '相對髖中心的畫面水平位置／軀幹尺度',
    scenario: '右手橫向防禦／推移',
    unit: 'rel',
    kind: 'position',
  },
  right_wrist_y_rel: {
    code: 'right_wrist_y_rel',
    label: '右手腕高度位置',
    formula: '相對髖中心的畫面垂直位置／軀幹尺度',
    scenario: '右手上、中、下段動作',
    unit: 'rel',
    kind: 'position',
  },
  left_knee_x_rel: {
    code: 'left_knee_x_rel',
    label: '左膝橫向位置',
    formula: '相對髖中心的畫面水平位置／軀幹尺度',
    scenario: '左膝外展、步法',
    unit: 'rel',
    kind: 'position',
  },
  left_knee_y_rel: {
    code: 'left_knee_y_rel',
    label: '左膝高度位置',
    formula: '相對髖中心的畫面垂直位置／軀幹尺度',
    scenario: '左膝抬起',
    unit: 'rel',
    kind: 'position',
  },
  right_knee_x_rel: {
    code: 'right_knee_x_rel',
    label: '右膝橫向位置',
    formula: '相對髖中心的畫面水平位置／軀幹尺度',
    scenario: '右膝外展、步法',
    unit: 'rel',
    kind: 'position',
  },
  right_knee_y_rel: {
    code: 'right_knee_y_rel',
    label: '右膝高度位置',
    formula: '相對髖中心的畫面垂直位置／軀幹尺度',
    scenario: '右膝抬起',
    unit: 'rel',
    kind: 'position',
  },
  left_ankle_x_rel: {
    code: 'left_ankle_x_rel',
    label: '左腳踝橫向位置',
    formula: '相對髖中心的畫面水平位置／軀幹尺度',
    scenario: '左腳步距／移動',
    unit: 'rel',
    kind: 'position',
  },
  left_ankle_y_rel: {
    code: 'left_ankle_y_rel',
    label: '左腳踝高度位置',
    formula: '相對髖中心的畫面垂直位置／軀幹尺度',
    scenario: '左腳抬腳／踢擊',
    unit: 'rel',
    kind: 'position',
  },
  right_ankle_x_rel: {
    code: 'right_ankle_x_rel',
    label: '右腳踝橫向位置',
    formula: '相對髖中心的畫面水平位置／軀幹尺度',
    scenario: '右腳步距／移動',
    unit: 'rel',
    kind: 'position',
  },
  right_ankle_y_rel: {
    code: 'right_ankle_y_rel',
    label: '右腳踝高度位置',
    formula: '相對髖中心的畫面垂直位置／軀幹尺度',
    scenario: '右腳抬腳／踢擊',
    unit: 'rel',
    kind: 'position',
  },
  stance_width_rel: {
    code: 'stance_width_rel',
    label: '雙腳間距',
    formula: '雙腳踝畫面距離／軀幹尺度',
    scenario: '站姿寬度、步法',
    unit: 'rel',
    kind: 'position',
  },
};

export function isRelativeFeature(jointName: JointName): boolean {
  return jointName.endsWith('_rel');
}

export function formatFeatureValue(jointName: JointName, value: number): string {
  if (isRelativeFeature(jointName)) {
    return `${Number(value.toFixed(2))}rel`;
  }
  return `${Math.round(value)}°`;
}

// 空手道與跆拳道動作設定字典（完整對應第三節：空手道核心 12 項 + 跆拳道核心 12 項，共 15 項不重複技術）
export const ACTION_METADATA: Record<
  ActionType,
  {
    label: string;
    shortLabel: string;
    terminology: string;
    karateLabel?: string;
    karateTerminology?: string;
    taekwondoLabel?: string;
    taekwondoTerminology?: string;
    martialArt: string;
    discipline: 'karate' | 'taekwondo' | 'both';
    category: string;
    description: string;
    primaryJoints: JointName[];
    focusFeatures: FocusFeatureCode[];
    targetAngleHint: string;
    cameraViewHint: string;
    provenance: ThresholdProvenance;
  }
> = {
  lunge_punch: {
    label: '正拳突（追擊）',
    shortLabel: '正拳突',
    terminology: 'Oi-zuki (追い突き)',
    karateLabel: '正拳突（追擊）',
    karateTerminology: 'Oi-zuki (追い突き)',
    martialArt: '空手道',
    discipline: 'karate',
    category: '手部攻擊',
    description: '腰轉帶動、拳面水平出擊、另一手確實收拳於腰側（避免只用手臂力量、手腕彎曲或肩膀上提）',
    primaryJoints: ['right_elbow', 'left_knee', 'torso'],
    focusFeatures: ['right_elbow_deg', 'right_wrist_y_rel', 'left_knee_deg', 'stance_width_rel'],
    targetAngleHint: '標準出拳肘角 165°–178°',
    cameraViewHint: '建議側面（90°）拍攝並保持全身入鏡，同時觀測上步弓步、腰轉與同側出拳延伸。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  straight_punch: {
    label: '逆突／正拳',
    shortLabel: '逆突／正拳',
    terminology: 'Gyaku-zuki / Jireugi (지르기)',
    karateLabel: '逆突',
    karateTerminology: 'Gyaku-zuki (逆突き)',
    taekwondoLabel: '正拳',
    taekwondoTerminology: 'Jireugi (지르기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '手部攻擊',
    description: '後腳蹬地配合腰轉帶動、拳與前腳對側直線擊打並快速回收（避免腰沒轉、拳路偏斜或手腕彎曲）',
    primaryJoints: ['right_elbow', 'torso', 'hip'],
    focusFeatures: ['right_elbow_deg', 'right_shoulder_deg', 'right_wrist_y_rel', 'stance_width_rel'],
    targetAngleHint: '標準肘伸展 165°–178°',
    cameraViewHint: '建議側面（與出拳方向垂直 90°）拍攝並保持全身入鏡，以利觀測手肘伸展與軀幹傾角。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  uraken_uchi: {
    label: '裏拳打',
    shortLabel: '裏拳打',
    terminology: 'Uraken-uchi (裏拳打ち)',
    karateLabel: '裏拳打',
    karateTerminology: 'Uraken-uchi (裏拳打ち)',
    martialArt: '空手道',
    discipline: 'karate',
    category: '手部攻擊',
    description: '以肘關節為支點展現鞭打感、用拳背關節擊打並快速彈回（避免只用手臂硬甩或缺乏腰力帶動）',
    primaryJoints: ['right_elbow', 'torso', 'hip'],
    focusFeatures: ['right_elbow_deg', 'right_shoulder_deg', 'right_wrist_x_rel', 'right_wrist_y_rel'],
    targetAngleHint: '標準鞭打肘伸展 155°–172°',
    cameraViewHint: '建議擊打側側面或斜前方 45° 拍攝並保持全身入鏡，以捕捉手肘摺疊與拳背鞭打回彈速度。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  shuto_uchi: {
    label: '手刀打',
    shortLabel: '手刀打',
    terminology: 'Shuto-uchi (手刀打ち)',
    karateLabel: '手刀打',
    karateTerminology: 'Shuto-uchi (手刀打ち)',
    martialArt: '空手道',
    discipline: 'karate',
    category: '手部攻擊',
    description: '耳側蓄力配合腰轉揮擊、以手刀小指側邊緣擊打且前臂延伸鎖定（避免用手掌拍打或手腕無力）',
    primaryJoints: ['right_elbow', 'hip', 'torso'],
    focusFeatures: ['right_elbow_deg', 'right_wrist_x_rel', 'right_wrist_y_rel', 'left_knee_deg'],
    targetAngleHint: '標準擊打肘角 150°–168°',
    cameraViewHint: '建議斜前方 45° 或側面拍攝並保持全身入鏡，清楚呈現耳側起勢至鎖骨高度之揮擊軌跡。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  age_uke: {
    label: '上段受／上段擋',
    shortLabel: '上段受／擋',
    terminology: 'Age-uke / Eolgul-makgi (얼굴막기)',
    karateLabel: '上段受',
    karateTerminology: 'Age-uke (上段揚げ受け)',
    taekwondoLabel: '上段擋',
    taekwondoTerminology: 'Eolgul-makgi (얼굴막기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '防禦格擋',
    description: '前臂斜上格擋保護頭部、拳高於額頭一拳距離、另一手回收腰側（避免手臂過直、擋得太低或太高）',
    primaryJoints: ['right_elbow', 'left_elbow', 'torso'],
    focusFeatures: ['right_elbow_deg', 'right_shoulder_deg', 'right_wrist_y_rel', 'left_wrist_y_rel'],
    targetAngleHint: '標準格擋肘角 92°–112°',
    cameraViewHint: '建議正面偏側 45° 或側面拍攝並保持全身入鏡，避免前臂重疊遮擋手肘關鍵點。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  soto_uke: {
    label: '中段外受／中段擋',
    shortLabel: '中段受／擋',
    terminology: 'Soto-uke / Momtong-makgi (몸통막기)',
    karateLabel: '中段外受',
    karateTerminology: 'Soto-uke (中段外受け)',
    taekwondoLabel: '中段擋',
    taekwondoTerminology: 'Momtong-makgi (몸통막기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '防禦格擋',
    description: '前臂保護軀幹中線、定型時前臂垂直且手肘約呈 90°（避免手臂伸太直、擋的位置偏前或身體晃動）',
    primaryJoints: ['right_elbow', 'torso', 'hip'],
    focusFeatures: ['left_elbow_deg', 'left_wrist_x_rel', 'left_wrist_y_rel', 'stance_width_rel'],
    targetAngleHint: '標準格擋肘角 85°–105°',
    cameraViewHint: '建議正面偏側 45° 拍攝並保持全身入鏡，清楚呈現前臂格擋軌跡與 90° 肘關節定型角。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  gedan_barai: {
    label: '下段掃／下段擋',
    shortLabel: '下段掃／擋',
    terminology: 'Gedan-barai / Arae-makgi (아래막기)',
    karateLabel: '下段掃',
    karateTerminology: 'Gedan-barai (下段払い)',
    taekwondoLabel: '下段擋',
    taekwondoTerminology: 'Arae-makgi (아래막기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '防禦格擋',
    description: '由耳側上往下斜掃保護下盤、終點停於前腿上方一拳處（避免下掃幅度不夠或手臂過度僵硬彎曲）',
    primaryJoints: ['left_elbow', 'hip', 'torso'],
    focusFeatures: ['left_elbow_deg', 'left_shoulder_deg', 'left_wrist_y_rel', 'stance_width_rel'],
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
    terminology: 'Mae-geri / Ap-chagi (앞차기)',
    karateLabel: '前踢',
    karateTerminology: 'Mae-geri (前蹴り)',
    taekwondoLabel: '前踢',
    taekwondoTerminology: 'Ap-chagi (앞차기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '直線腿法',
    description: '提膝收緊小腿、爆發彈踢以腳掌或腳背擊打並快速回收（避免踢時身體後仰、小腿沒夾緊或踢完不回收）',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    focusFeatures: ['right_knee_deg', 'right_hip_deg', 'right_ankle_y_rel', 'right_knee_y_rel'],
    targetAngleHint: '標準膝伸展 165°–178°',
    cameraViewHint: '踢擊類建議由踢擊腿側面（90°）拍攝且全身完整入鏡，以利量測矢狀面提膝與膝伸展角。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  roundhouse_kick: {
    label: '迴旋踢／橫踢',
    shortLabel: '迴旋踢／橫踢',
    terminology: 'Mawashi-geri / Dollyo-chagi (돌려차기)',
    karateLabel: '迴旋踢',
    karateTerminology: 'Mawashi-geri (回し蹴り)',
    taekwondoLabel: '橫踢（迴旋踢）',
    taekwondoTerminology: 'Dollyo-chagi (돌려차기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '迴旋腿法',
    description: '支撐腳旋轉、髖關節打開、以腳背或腳脛展現鞭打感擊打（避免支撐腳沒轉、上身過度傾斜或落地不穩）',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    focusFeatures: ['right_knee_deg', 'right_hip_deg', 'right_ankle_y_rel', 'right_knee_x_rel'],
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
    terminology: 'Yoko-geri / Yeop-chagi (옆차기)',
    karateLabel: '側踢',
    karateTerminology: 'Yoko-geri (横蹴り)',
    taekwondoLabel: '側踢',
    taekwondoTerminology: 'Yeop-chagi (옆차기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '直線腿法',
    description: '側身提膝、髖關節推送、以腳刀或腳跟直線蹬出（避免身體正面朝前、踢的高度與力量不足）',
    primaryJoints: ['left_knee', 'hip', 'torso'],
    focusFeatures: ['left_knee_deg', 'left_hip_deg', 'left_ankle_x_rel', 'left_ankle_y_rel'],
    targetAngleHint: '標準膝伸展 162°–177°',
    cameraViewHint: '踢擊類建議與側踢推進方向垂直之側面拍攝且全身入鏡，避免朝向鏡頭直踢造成透視縮短。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  back_kick: {
    label: '後踢',
    shortLabel: '後踢',
    terminology: 'Ushiro-geri / Dwit-chagi (뒷차기)',
    karateLabel: '後踢',
    karateTerminology: 'Ushiro-geri (後ろ蹴り)',
    taekwondoLabel: '後踢',
    taekwondoTerminology: 'Dwit-chagi (뒷차기)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '旋轉腿法',
    description: '轉身回頭看目標、夾膝以腳跟直線向後踢擊（避免轉身不夠或踢擊路線偏斜外擺）',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    focusFeatures: ['right_knee_deg', 'right_hip_deg', 'right_ankle_x_rel', 'right_ankle_y_rel'],
    targetAngleHint: '標準後踹膝角 160°–175°',
    cameraViewHint: '踢擊類建議側面拍攝並確保全身與後踹延伸空間皆入鏡，以觀察轉身中軸與後踹膝伸展。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  axe_kick: {
    label: '下劈',
    shortLabel: '下劈',
    terminology: 'Naeryeo-chagi (내려차기)',
    taekwondoLabel: '下劈',
    taekwondoTerminology: 'Naeryeo-chagi (내려차기)',
    martialArt: '跆拳道',
    discipline: 'taekwondo',
    category: '高空劈腿',
    description: '高抬腿越過頭頂後由上往下快速下劈、以腳跟或腳掌下壓（避免抬腿高度不夠、下劈無力或失去平衡）',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    focusFeatures: ['right_knee_deg', 'right_hip_deg', 'right_ankle_y_rel', 'left_knee_deg'],
    targetAngleHint: '標準劈落膝角 165°–179°',
    cameraViewHint: '踢擊類建議側面拍攝、全身入鏡並保留頭頂上方空間，以免高抬腿頂點超出取景框。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  hook_kick: {
    label: '勾踢',
    shortLabel: '勾踢',
    terminology: 'Huryeo-chagi (후려차기) / Golcha-chagi',
    taekwondoLabel: '勾踢',
    taekwondoTerminology: 'Huryeo-chagi / Golcha-chagi',
    martialArt: '跆拳道',
    discipline: 'taekwondo',
    category: '擺勾腿法',
    description: '先側向伸直展髖再快速屈膝勾回、以腳跟或腳掌勾打（避免伸直與勾回動作不連貫、力量不足）',
    primaryJoints: ['right_knee', 'hip', 'torso'],
    focusFeatures: ['right_knee_deg', 'right_hip_deg', 'right_ankle_x_rel', 'right_ankle_y_rel'],
    targetAngleHint: '標準勾擊膝角 95°–125°',
    cameraViewHint: '踢擊類建議側面拍攝且全身入鏡，完整捕捉膝關節由伸展（約 165°）瞬間勾回（約 105°）的雙階段軌跡。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  zenkutsu_dachi: {
    label: '前屈立',
    shortLabel: '前屈立',
    terminology: 'Zenkutsu-dachi / Ap-kubi (앞굽이)',
    karateLabel: '前屈立',
    karateTerminology: 'Zenkutsu-dachi (前屈立ち)',
    taekwondoLabel: '前屈立',
    taekwondoTerminology: 'Ap-kubi (앞굽이)',
    martialArt: '空手道・跆拳道',
    discipline: 'both',
    category: '標準站姿',
    description: '前腳膝蓋屈曲且與腳尖方向一致、後腳伸直且腳跟不離地、重心約 60:40（避免前膝內扣、後腳跟抬起或重心過後）',
    primaryJoints: ['left_knee', 'hip', 'torso'],
    focusFeatures: ['left_knee_deg', 'right_knee_deg', 'stance_width_rel', 'left_hip_deg'],
    targetAngleHint: '標準前膝屈曲 105°–125°',
    cameraViewHint: '建議側面（90°）或斜前方 45° 拍攝並保持全身與雙腳腳掌完整入鏡，以利量測前後腿膝角與重心分佈。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
  fighting_stance: {
    label: '實戰姿勢',
    shortLabel: '實戰姿勢',
    terminology: 'Gyeorugi-junbi (겨루기 준비)',
    taekwondoLabel: '實戰姿勢',
    taekwondoTerminology: 'Gyeorugi-junbi (겨루기 준비)',
    martialArt: '跆拳道',
    discipline: 'taekwondo',
    category: '標準站姿',
    description: '身體側向減少受擊面、雙膝微彎保持重心彈性移動、雙手護住胸頷（避免正面朝敵、雙腿僵硬打直或護手下垂）',
    primaryJoints: ['right_knee', 'left_elbow', 'torso'],
    focusFeatures: ['right_knee_deg', 'left_knee_deg', 'stance_width_rel', 'left_wrist_y_rel'],
    targetAngleHint: '標準機動膝角 135°–155°',
    cameraViewHint: '建議側面或斜前方 45° 拍攝並保持全身入鏡，以利檢視雙膝彈性微屈角與雙手護架高度。',
    provenance: {
      status: 'heuristic-unverified',
      // TODO(使用者): 填入實際文獻或教練驗證來源
    },
  },
};

export const JOINT_LABELS: Record<JointName, string> = {
  // 舊版 6 個代碼
  left_elbow: '左手肘角度',
  right_elbow: '右手肘角度',
  left_knee: '左膝角度',
  right_knee: '右膝角度',
  hip: '髖關節角度',
  torso: '軀幹軸線角度',
  // CSV 標準 21 個關鍵特徵代碼
  left_elbow_deg: '左手肘角度',
  right_elbow_deg: '右手肘角度',
  left_shoulder_deg: '左肩角度',
  right_shoulder_deg: '右肩角度',
  left_hip_deg: '左髖角度',
  right_hip_deg: '右髖角度',
  left_knee_deg: '左膝角度',
  right_knee_deg: '右膝角度',
  left_wrist_x_rel: '左手腕橫向位置',
  left_wrist_y_rel: '左手腕高度位置',
  right_wrist_x_rel: '右手腕橫向位置',
  right_wrist_y_rel: '右手腕高度位置',
  left_knee_x_rel: '左膝橫向位置',
  left_knee_y_rel: '左膝高度位置',
  right_knee_x_rel: '右膝橫向位置',
  right_knee_y_rel: '右膝高度位置',
  left_ankle_x_rel: '左腳踝橫向位置',
  left_ankle_y_rel: '左腳踝高度位置',
  right_ankle_x_rel: '右腳踝橫向位置',
  right_ankle_y_rel: '右腳踝高度位置',
  stance_width_rel: '雙腳間距',
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
