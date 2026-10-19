import {
  ACTION_METADATA,
  isRelativeFeature,
  type ActionAnalysisResponse,
  type ActionType,
  type AngleTimeSeriesPoint,
  type DefectItem,
  type FrameKeypoints,
  type JointAngleSeries,
  type JointName,
  type LocalVideoRecord,
} from '../types/martial-arts.types';
import { videoRepository } from '../db/repositories/video.repo';
import {
  ApiClientError,
  validateAnalysisResponse,
  type IAnalysisApiClient,
  type UploadAnalyzeOptions,
} from './apiClient.interface';

/**
 * 根據武術動作類型與特徵代碼，生成物理上逼真的時序角度 (*_deg) 或相對位置 (*_rel) 數據（每 0.1 秒一筆採樣）
 */
function generateRealisticSeries(
  jointName: JointName,
  duration: number,
  actionType: ActionType
): JointAngleSeries {
  const sampleCount = Math.max(20, Math.floor(duration * 10));
  const points: AngleTimeSeriesPoint[] = [];

  // 相對位置／步幅特徵 (*_rel)：以相對髖中心／軀幹尺度比值表示（保留兩位小數）
  if (isRelativeFeature(jointName)) {
    for (let i = 0; i <= sampleCount; i++) {
      const time = Number((i * 0.1).toFixed(1));
      const progress = i / sampleCount;
      const wave = Math.sin(progress * Math.PI);

      let standardMin: number;
      let standardMax: number;
      let actualAngle: number;

      if (jointName === 'stance_width_rel') {
        const base = actionType === 'zenkutsu_dachi' || actionType === 'lunge_punch' ? 1.15 : 0.85;
        standardMin = Number((base - 0.1 + wave * 0.18).toFixed(2));
        standardMax = Number((base + 0.12 + wave * 0.18).toFixed(2));
        const dev = progress > 0.45 && progress < 0.62 ? -0.14 : Math.sin(i * 0.7) * 0.03;
        actualAngle = Number((((standardMin + standardMax) / 2) + dev).toFixed(2));
      } else if (jointName.endsWith('_wrist_y_rel')) {
        // y_rel 向下增加：上段約 -0.85，中段約 -0.35，下段約 +0.25
        const targetY =
          actionType === 'age_uke'
            ? -0.82
            : actionType === 'gedan_barai'
              ? 0.28
              : -0.38;
        standardMin = Number((-0.2 + wave * (targetY + 0.2) - 0.1).toFixed(2));
        standardMax = Number((-0.2 + wave * (targetY + 0.2) + 0.1).toFixed(2));
        const dev = progress > 0.44 && progress < 0.58 ? 0.13 : Math.cos(i * 0.8) * 0.03;
        actualAngle = Number((((standardMin + standardMax) / 2) + dev).toFixed(2));
      } else if (jointName.endsWith('_ankle_y_rel') || jointName.endsWith('_knee_y_rel')) {
        // 抬腿／踢擊時 y_rel 向上（數值變小／負值方向）
        const lift = actionType === 'axe_kick' ? -0.95 : -0.55;
        standardMin = Number((0.75 + wave * lift - 0.12).toFixed(2));
        standardMax = Number((0.75 + wave * lift + 0.12).toFixed(2));
        const dev = progress > 0.45 && progress < 0.6 ? 0.15 : Math.sin(i * 0.75) * 0.03;
        actualAngle = Number((((standardMin + standardMax) / 2) + dev).toFixed(2));
      } else {
        // *_x_rel 橫向位置（出拳、側踢或橫向防禦延伸）
        standardMin = Number((0.18 + wave * 0.62).toFixed(2));
        standardMax = Number((0.36 + wave * 0.62).toFixed(2));
        const dev = progress > 0.45 && progress < 0.6 ? -0.12 : Math.cos(i * 0.7) * 0.03;
        actualAngle = Number((((standardMin + standardMax) / 2) + dev).toFixed(2));
      }

      points.push({
        time,
        actualAngle,
        standardMin,
        standardMax,
        standardBand: [standardMin, standardMax],
      });
    }
    return { jointName, points };
  }

  // 關節角度特徵 (*_deg 與舊版關節代碼)
  const normalizedJoint = jointName.replace(/_deg$/, '');

  for (let i = 0; i <= sampleCount; i++) {
    const time = Number((i * 0.1).toFixed(1));
    const progress = i / sampleCount;

    let standardMin: number;
    let standardMax: number;
    let actualAngle: number;

    if (
      (actionType === 'straight_punch' || actionType === 'lunge_punch') &&
      normalizedJoint === 'right_elbow'
    ) {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(70 + wave * 95);
      standardMax = Math.round(85 + wave * 95);
      const deviation = progress > 0.42 && progress < 0.58 ? -14 : Math.sin(i * 0.9) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (actionType === 'uraken_uchi' && normalizedJoint === 'right_elbow') {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(65 + wave * 90);
      standardMax = Math.round(82 + wave * 90);
      const deviation = progress > 0.43 && progress < 0.59 ? -13 : Math.sin(i * 0.85) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (actionType === 'shuto_uchi' && normalizedJoint === 'right_elbow') {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(68 + wave * 82);
      standardMax = Math.round(84 + wave * 84);
      const deviation = progress > 0.44 && progress < 0.6 ? -14 : Math.cos(i * 0.8) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (
      (actionType === 'lunge_punch' || actionType === 'zenkutsu_dachi') &&
      normalizedJoint === 'left_knee'
    ) {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(150 - wave * 45);
      standardMax = Math.round(166 - wave * 41);
      const deviation = progress > 0.45 && progress < 0.65 ? 14 : Math.cos(i * 0.8) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (actionType === 'fighting_stance' && (normalizedJoint === 'right_knee' || normalizedJoint === 'left_knee')) {
      const wave = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
      standardMin = Math.round(135 + wave * 6);
      standardMax = Math.round(152 + wave * 6);
      const deviation = progress > 0.42 && progress < 0.6 ? 13 : Math.sin(i * 0.7) * 2;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (actionType === 'age_uke' && normalizedJoint === 'right_elbow') {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(52 + wave * 40);
      standardMax = Math.round(68 + wave * 44);
      const deviation = progress > 0.44 && progress < 0.58 ? 14 : Math.sin(i * 0.8) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (actionType === 'soto_uke' && (normalizedJoint === 'right_elbow' || normalizedJoint === 'left_elbow')) {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(125 - wave * 40);
      standardMax = Math.round(142 - wave * 37);
      const deviation = progress > 0.44 && progress < 0.6 ? 15 : Math.cos(i * 0.75) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (actionType === 'gedan_barai' && normalizedJoint === 'left_elbow') {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(62 + wave * 88);
      standardMax = Math.round(76 + wave * 92);
      const deviation = progress > 0.45 && progress < 0.6 ? -13 : Math.cos(i * 0.8) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (actionType === 'hook_kick' && normalizedJoint === 'right_knee') {
      const extendPhase = Math.exp(-Math.pow((progress - 0.34) / 0.14, 2));
      const hookPhase = Math.exp(-Math.pow((progress - 0.54) / 0.12, 2));
      standardMin = Math.round(115 + extendPhase * 45 - hookPhase * 20);
      standardMax = Math.round(135 + extendPhase * 40 - hookPhase * 10);
      const deviation = progress > 0.46 && progress < 0.62 ? 16 : Math.sin(i * 0.7) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (
      (actionType === 'roundhouse_kick' ||
        actionType === 'front_kick' ||
        actionType === 'back_kick' ||
        actionType === 'axe_kick') &&
      normalizedJoint === 'right_knee'
    ) {
      const wave = Math.pow(Math.sin(progress * Math.PI), 1.4);
      const peakAdd = actionType === 'axe_kick' ? 105 : 100;
      standardMin = Math.round(60 + wave * peakAdd);
      standardMax = Math.round(78 + wave * peakAdd);
      const deviation = progress > 0.45 && progress < 0.62 ? -15 : Math.cos(i * 0.7) * 4;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (actionType === 'side_kick' && normalizedJoint === 'left_knee') {
      const wave = Math.pow(Math.sin(progress * Math.PI), 1.3);
      standardMin = Math.round(62 + wave * 100);
      standardMax = Math.round(77 + wave * 100);
      const deviation = progress > 0.44 && progress < 0.6 ? -15 : Math.sin(i * 0.7) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (normalizedJoint === 'left_shoulder' || normalizedJoint === 'right_shoulder') {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(45 + wave * 55);
      standardMax = Math.round(62 + wave * 58);
      const deviation = progress > 0.46 && progress < 0.62 ? 11 : Math.cos(i * 0.8) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (normalizedJoint === 'hip' || normalizedJoint === 'left_hip' || normalizedJoint === 'right_hip') {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(90 + wave * 45);
      standardMax = Math.round(108 + wave * 45);
      const deviation = progress > 0.65 && progress < 0.8 ? 12 : Math.sin(i) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else {
      standardMin = 165;
      standardMax = 180;
      const deviation = progress > 0.5 && progress < 0.68 ? -13 : Math.sin(i * 0.6) * 2;
      actualAngle = Math.round(172 + deviation);
    }

    points.push({
      time,
      actualAngle,
      standardMin,
      standardMax,
      standardBand: [standardMin, standardMax],
    });
  }

  return { jointName, points };
}

const DEMO_ACTION_CYCLE: ActionType[] = [
  'roundhouse_kick',
  'straight_punch',
  'front_kick',
  'lunge_punch',
  'uraken_uchi',
  'shuto_uchi',
  'age_uke',
  'soto_uke',
  'gedan_barai',
  'side_kick',
  'back_kick',
  'axe_kick',
  'hook_kick',
  'zenkutsu_dachi',
  'fighting_stance',
];
let demoCycleIndex = 0;

const ACTION_CONFIDENCE_MAP: Record<ActionType, number> = {
  lunge_punch: 95.6,
  straight_punch: 96.4,
  uraken_uchi: 94.7,
  shuto_uchi: 94.5,
  age_uke: 95.2,
  soto_uke: 95.0,
  gedan_barai: 94.9,
  front_kick: 96.1,
  roundhouse_kick: 95.8,
  side_kick: 94.6,
  back_kick: 93.8,
  axe_kick: 94.3,
  hook_kick: 93.5,
  zenkutsu_dachi: 95.4,
  fighting_stance: 95.1,
};

/**
 * 模擬後端透過骨架特徵與資料庫標準動作進行時序比對 (DTW / ST-GCN)，自動識別使用者正在執行的動作
 */
function recognizeActionFromVideo(video: LocalVideoRecord): {
  actionType: ActionType;
  confidence: number;
} {
  if (video.requestedActionType) {
    return {
      actionType: video.requestedActionType,
      confidence: ACTION_CONFIDENCE_MAP[video.requestedActionType] ?? 95.5,
    };
  }

  const name = (video.fileName || '').toLowerCase();
  for (const act of DEMO_ACTION_CYCLE) {
    if (name.includes(act)) {
      return { actionType: act, confidence: ACTION_CONFIDENCE_MAP[act] };
    }
  }
  if (name.includes('lunge') || name.includes('oi') || name.includes('追擊') || name.includes('正拳突')) {
    return { actionType: 'lunge_punch', confidence: 95.6 };
  }
  if (name.includes('uraken') || name.includes('裏拳') || name.includes('背拳')) {
    return { actionType: 'uraken_uchi', confidence: 94.7 };
  }
  if (name.includes('shuto') || name.includes('sonnal') || name.includes('手刀')) {
    return { actionType: 'shuto_uchi', confidence: 94.5 };
  }
  if (name.includes('punch') || name.includes('正拳') || name.includes('逆突')) {
    return { actionType: 'straight_punch', confidence: 96.4 };
  }
  if (name.includes('age') || name.includes('上段')) {
    return { actionType: 'age_uke', confidence: 95.2 };
  }
  if (name.includes('soto') || name.includes('momtong') || name.includes('中段')) {
    return { actionType: 'soto_uke', confidence: 95.0 };
  }
  if (name.includes('gedan') || name.includes('下段')) {
    return { actionType: 'gedan_barai', confidence: 94.9 };
  }
  if (name.includes('front') || name.includes('前踢')) {
    return { actionType: 'front_kick', confidence: 96.1 };
  }
  if (name.includes('roundhouse') || name.includes('迴旋') || name.includes('橫踢')) {
    return { actionType: 'roundhouse_kick', confidence: 95.8 };
  }
  if (name.includes('side') || name.includes('側踢')) {
    return { actionType: 'side_kick', confidence: 94.6 };
  }
  if (name.includes('hook') || name.includes('huryeo') || name.includes('golcha') || name.includes('勾踢')) {
    return { actionType: 'hook_kick', confidence: 93.5 };
  }
  if (name.includes('back') || name.includes('後踢')) {
    return { actionType: 'back_kick', confidence: 93.8 };
  }
  if (name.includes('axe') || name.includes('下壓') || name.includes('下劈')) {
    return { actionType: 'axe_kick', confidence: 94.3 };
  }
  if (name.includes('zenkutsu') || name.includes('apkubi') || name.includes('前屈立')) {
    return { actionType: 'zenkutsu_dachi', confidence: 95.4 };
  }
  if (name.includes('fighting') || name.includes('gyeorugi') || name.includes('實戰姿勢')) {
    return { actionType: 'fighting_stance', confidence: 95.1 };
  }

  // 依據影片 ID 雜湊自動推論動作類別
  const hash = video.id
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const recognized = DEMO_ACTION_CYCLE[hash % DEMO_ACTION_CYCLE.length];
  return {
    actionType: recognized,
    confidence: ACTION_CONFIDENCE_MAP[recognized],
  };
}

/**
 * 模擬後端非同步上傳與 AI 骨架動作辨識評估流程 (實作 IAnalysisApiClient 合約)
 */
export const mockAnalysisService: IAnalysisApiClient & {
  createSyntheticDemoVideo: (preferredAction?: ActionType) => Promise<string>;
} = {
  mode: 'mock',

  async checkHealth() {
    return {
      ok: true,
      latencyMs: 8,
      message: '內建空手道 12 項／跆拳道 12 項標準動作識別與生物力學模擬引擎就緒 (v2.6)',
    };
  },

  async uploadAndAnalyzeVideo(
    video: LocalVideoRecord,
    options?: UploadAnalyzeOptions
  ): Promise<ActionAnalysisResponse> {
    const { id: videoId, duration } = video;
    const { actionType, confidence } = recognizeActionFromVideo(video);
    const effectiveDuration = Math.max(2.5, Math.min(duration || 3.2, 10));

    // Step 1: 模擬分塊上傳進度 (uploading: 15% -> 100%)
    await videoRepository.updateUploadStatus(videoId, 'uploading', {
      uploadProgress: 15,
      errorMessage: undefined,
    });
    options?.onProgress?.(15, 'uploading');

    for (const progress of [35, 65, 88, 100]) {
      await new Promise((r) => setTimeout(r, 220));
      options?.onProgress?.(progress, 'uploading');
      await videoRepository.updateUploadStatus(videoId, 'uploading', {
        uploadProgress: progress,
      });
    }

    // Step 2: 模擬後端骨骼提取、資料庫動作分類與時序比對 (processing)
    options?.onProgress?.(100, 'processing');
    await videoRepository.updateUploadStatus(videoId, 'processing', {
      uploadProgress: 100,
    });
    await new Promise((r) => setTimeout(r, 750));

    // Step 3: 根據資料庫比對識別出的動作類型，生成多關節時序資料與具體修正建議
    const prepTime = Number((effectiveDuration * 0.25).toFixed(1));
    const peakTime = Number((effectiveDuration * 0.5).toFixed(1));
    const recoveryTime = Number((effectiveDuration * 0.72).toFixed(1));

    let primaryJoint: JointName;
    let defects: DefectItem[];
    let strengths: string[];
    let feedbackSummary: string;
    let totalScore: number;
    let grade: 'A' | 'B' | 'C' | 'D';

    switch (actionType) {
      case 'straight_punch':
        primaryJoint = 'right_elbow';
        totalScore = 89;
        grade = 'A';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「空手道・正拳攻擊 (Gyaku-Zuki)」（信心度 ${confidence}%）。出擊初速與直線軌跡表現優異，惟在擊打頂點瞬間（約 ${peakTime} 秒處）右手肘伸展角度略低於標準區間下限，且收拳時軀幹微幅前傾，建議強化核心抗旋轉穩定度。`;
        strengths = [
          '後腳蹬地傳導至腰胯旋轉的發力時序緊湊（0.2s–0.8s 區間零延遲）',
          '前段出拳軌跡維持高直線度，未出現預兆性外擺（Telegraphing）',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_elbow',
            currentValue: 158,
            standardRange: [165, 178],
            message: '出拳頂點手肘未完全伸展鎖定，影響極決め（Kime）穿透力道。',
            prescription:
              '修正建議：擊中目標前最後 10 公分加速前臂旋內（拳眼朝下），帶動肘關節延伸至 168° 以上並瞬間等長收縮定型 0.1 秒。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'torso',
            currentValue: 159,
            standardRange: [165, 180],
            message: '擊打後重心微幅前傾，應維持脊柱垂直中軸以利防禦回撤。',
            prescription:
              '修正建議：出拳同時左側引手（Hikite）強力拉回腰際，收緊腹橫肌以抵銷前衝慣性。',
            severity: 'minor',
          },
        ];
        break;

      case 'age_uke':
        primaryJoint = 'right_elbow';
        totalScore = 88;
        grade = 'A';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「空手道・上段格擋 (Jodan Age-Uke)」（信心度 ${confidence}%）。雙手交叉起勢與引手（Hikite）拉回時機相當同步，惟在額前定型瞬間（約 ${peakTime} 秒）右手肘張開角度偏大（118°），略高於最佳結構支撐角（92°–112°）。`;
        strengths = [
          '防禦手臂由中心線向上交叉揚受軌跡完整，有效覆蓋頭部正面',
          '下盤前屈立（Zenkutsu-Dachi）重心穩固，格擋瞬間軀幹無後仰閃避',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_elbow',
            currentValue: 118,
            standardRange: [92, 112],
            message: '格擋頂點肘關節角度過大，承受下劈重擊時容易向內潰縮。',
            prescription:
              '修正建議：定型時手肘保持約 100° 屈曲、前臂維持 15° 傾斜角並距額頭前上方約一拳距離，讓衝擊力沿斜面滑開。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'torso',
            currentValue: 161,
            standardRange: [168, 180],
            message: '格擋完成後肩膀微幅聳起，影響下一拍反擊逆突（Gyaku-Zuki）連貫度。',
            prescription:
              '修正建議：揚受定型瞬間沉肩收闊背肌，將支撐力由三角肌轉移至背部肌群。',
            severity: 'minor',
          },
        ];
        break;

      case 'gedan_barai':
        primaryJoint = 'left_elbow';
        totalScore = 87;
        grade = 'A';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「空手道・下段格擋 (Gedan-Barai)」（信心度 ${confidence}%）。耳側蓄力高度標準，下掃速度充沛，但在前腿上方終點定型時左手肘彎曲角度略多（142°），建議延伸前臂以擴大下段防禦半徑。`;
        strengths = [
          '起勢時格擋手確實貼近對側耳際蓄力，旋轉力矩充足',
          '髖部隨下掃動作同步微幅半身旋轉（Hanmi），傳導效率良好',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'left_elbow',
            currentValue: 142,
            standardRange: [150, 168],
            message: '下掃終點手肘略為彎曲，拳頭停滯位置偏高。',
            prescription:
              '修正建議：前臂沿斜直線掃至前膝上方約一拳距離處煞車定型，使肘關節延伸至 155°–165° 區間。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'hip',
            currentValue: 144,
            standardRange: [115, 138],
            message: '定型階段骨盆微幅外飄，前膝有內扣趨勢。',
            prescription:
              '修正建議：前腳膝蓋維持朝向正前方並垂直於腳尖上方，強化臀中肌外展穩定。',
            severity: 'minor',
          },
        ];
        break;

      case 'front_kick':
        primaryJoint = 'right_knee';
        totalScore = 86;
        grade = 'A';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「前踢 (Mae-Geri / Ap-Chagi)」（信心度 ${confidence}%）。矢狀面提膝高度與直線性極佳，但在彈踢頂點（約 ${peakTime} 秒）膝關節伸展差約 8 度，且收腿時小腿略微下掉。`;
        strengths = [
          '提膝階段（Chamber）髖關節屈曲超過 90°，具備極佳起腿爆發力',
          '全程維持矢狀面直線軌跡，支撐腳腳跟穩定貼地未離地漂移',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_knee',
            currentValue: 157,
            standardRange: [165, 178],
            message: '前踢頂點膝關節未完全彈直，前腳掌（上足底 / Apchuk）推擊距離受限。',
            prescription:
              '修正建議：提膝至最高點後固定大腿高度，專注以股四頭肌高速彈出小腿，同時腳背回勾、腳趾上翹以虎趾部位擊打。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'hip',
            currentValue: 145,
            standardRange: [115, 138],
            message: '擊中後小腿摺疊回收（Re-chamber）速度偏慢，易遭對手抓腿反擊。',
            prescription:
              '修正建議：以「彈簧原路折返」概念練習擊靶後 0.2 秒內將腳跟收貼至臀部下方，再控制落步。',
            severity: 'minor',
          },
        ];
        break;

      case 'roundhouse_kick':
        primaryJoint = 'right_knee';
        totalScore = 83;
        grade = 'B';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「跆拳道・迴旋踢 (Dollyo-Chagi)」（信心度 ${confidence}%）。提膝高度充足，但在彈踢瞬間（約 ${peakTime} 秒）右膝伸展角度差約 9 度，且轉髖角度在收腿階段略顯滯後，建議加強支撐腳旋轉與送髖流暢度。`;
        strengths = [
          '起腿提膝（Chamber）高度與摺疊角度精準達標，具備良好隱蔽性',
          '上半身防禦架勢於起腿階段保持穩定，未出現大幅後仰失衡',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_knee',
            currentValue: 151,
            standardRange: [160, 176],
            message: '踢擊瞬間小腿鞭甩延伸不足，膝關節角度低於標準下限。',
            prescription:
              '修正建議：在支撐腳腳掌旋轉至 150° 後再啟動小腿鞭甩，利用股四頭肌爆發收縮將膝角延伸至 165° 以上。',
            severity: 'critical',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'hip',
            currentValue: 148,
            standardRange: [115, 138],
            message: '收腿階段骨盆回正延遲，容易造成二次連擊重心不穩。',
            prescription:
              '修正建議：擊中瞬間立即主動摺疊小腿（Re-chamber）並帶動髖部回旋，避免踢擊腿直接下掉落地。',
            severity: 'moderate',
          },
        ];
        break;

      case 'side_kick':
        primaryJoint = 'left_knee';
        totalScore = 85;
        grade = 'B';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「側踢 (Yeop-Chagi / Yoko-Geri)」（信心度 ${confidence}%）。蓄力收腿相當標準，推進力線明確；主要偏差發生在完全踹出瞬間軀幹側傾角度偏大，建議控制上半身反向平衡角。`;
        strengths = [
          '橫向提膝蓄力（Chamber）完整，骨盆側向展開順暢',
          '直線推進軌跡清晰，未演變成弧線迴旋踢力線',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'left_knee',
            currentValue: 154,
            standardRange: [162, 177],
            message: '側踹頂點膝蓋略帶彎曲，未能以腳刀／腳跟完全貫穿目標線。',
            prescription:
              '修正建議：踹出時腳尖微向內勾、腳跟與腳刀外緣向前頂出，配合臀中肌推展讓膝角延伸超過 165°。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'torso',
            currentValue: 156,
            standardRange: [165, 180],
            message: '側踢回收時上半身過度下壓，應保持核心張力。',
            prescription:
              '修正建議：可扶牆進行慢速側踢定點停留 3 秒訓練，強化腹斜肌抗側傾控制力。',
            severity: 'minor',
          },
        ];
        break;

      case 'back_kick':
        primaryJoint = 'right_knee';
        totalScore = 82;
        grade = 'B';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「跆拳道・轉身後踢 (Dwit-Chagi)」（信心度 ${confidence}%）。180° 背轉起勢果斷，但在後踹瞬間右膝微向外側擺動且伸展角（150°）略低於標準（160°–175°），建議夾緊雙大腿內側直線後刺。`;
        strengths = [
          '雙腳前腳掌旋轉軸心穩定，轉身過程重心高度起伏極小',
          '轉身回頭視線（Spotting）早於出腿，目標鎖定精準',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_knee',
            currentValue: 150,
            standardRange: [160, 175],
            message: '後踹軌跡帶有微幅外弧（偏成後旋踢），且頂點膝蓋未完全踹直。',
            prescription:
              '修正建議：轉身提膝時讓踢擊腿膝蓋擦過支撐腿內側直線向後刺出，腳尖朝下、以腳跟直線頂穿目標。',
            severity: 'critical',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'torso',
            currentValue: 153,
            standardRange: [162, 178],
            message: '後踹頂點上半身前趴幅度過大，影響擊中後的回防速度。',
            prescription:
              '修正建議：藉由豎脊肌與臀大肌協同收縮控制軀幹傾角，雙手維持胸前防禦抱架避免下垂。',
            severity: 'moderate',
          },
        ];
        break;

      case 'lunge_punch':
        primaryJoint = 'right_elbow';
        totalScore = 87;
        grade = 'A';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「前屈立・追擊順拳 (Oi-Zuki / Bandae-Jireugi)」（信心度 ${confidence}%）。上步推進與同側腰轉出拳時序協調，惟在前屈立（Zenkutsu-Dachi / Ap-Kubi）定型瞬間前膝屈曲不足且後腳跟微幅掀起，出拳頂點（約 ${peakTime} 秒）手肘延伸差約 7 度。`;
        strengths = [
          '前屈立重心維持 60:40 分配，前腳膝蓋與腳尖方向一致未內扣',
          '同側順拳水平出擊軌跡穩定，另一手引手（Hikite）確實收於腰側',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_elbow',
            currentValue: 158,
            standardRange: [165, 178],
            message: '追擊出拳頂點手肘未完全伸展，且肩膀微幅上提影響拳面水平穿透。',
            prescription:
              '修正建議：利用後腳蹬地推進慣性帶動腰轉，擊中瞬間沉肩旋腕，使拳面水平延伸至肘角 168° 以上。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'left_knee',
            currentValue: 138,
            standardRange: [105, 125],
            message: '前屈立定型時前膝彎曲度不足（重心偏高），削弱下盤推進穩定度。',
            prescription:
              '修正建議：上步落定時前膝向前屈曲至垂直對齊腳背上方（約 110°–120°），後腿打直且腳跟緊貼地面不離地。',
            severity: 'minor',
          },
        ];
        break;

      case 'uraken_uchi':
        primaryJoint = 'right_elbow';
        totalScore = 88;
        grade = 'A';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「空手道・裏拳打 (Uraken-uchi)」（信心度 ${confidence}%）。以手肘為支點的拳背鞭打速度出色，惟在擊打頂點瞬間（約 ${peakTime} 秒）手肘延伸略顯僵硬（146°），且缺乏腰胯微幅旋動帶動，回收彈回速度可再提升。`;
        strengths = [
          '起勢時拳背確實置於對側肩前蓄力，出擊隱蔽性佳',
          '擊中後能沿原軌跡快速折返，未出現手臂下垂露空',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_elbow',
            currentValue: 146,
            standardRange: [155, 172],
            message: '裏拳擊打時單靠手臂硬甩，手肘支點展開不足且缺乏鞭打彈性。',
            prescription:
              '修正建議：先以腰轉帶動上臂與肘尖指向目標，再瞬間放鬆前臂如鞭子般甩出拳背關節（延伸至 160° 左右）並立即彈回。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'torso',
            currentValue: 158,
            standardRange: [165, 180],
            message: '橫向揮擊時肩膀隨慣性微幅外傾，影響下盤重心穩定。',
            prescription:
              '修正建議：收緊核心抗側傾肌群，配合對側引手拉回腰側以平衡橫向甩動慣性。',
            severity: 'minor',
          },
        ];
        break;

      case 'shuto_uchi':
        primaryJoint = 'right_elbow';
        totalScore = 86;
        grade = 'A';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「空手道・手刀打 (Shuto-uchi)」（信心度 ${confidence}%）。由耳側向外揮斬的腰轉時序流暢，但在擊打瞬間（約 ${peakTime} 秒）手肘彎曲角度偏大（139°），且手腕張力略顯鬆散，容易演變成用手掌拍打。`;
        strengths = [
          '蓄力階段手刀確實貼近耳際，對側手同步向前伸出定標',
          '擊打瞬間骨盆與雙肩旋轉同步率高，傳導力矩完整',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_elbow',
            currentValue: 139,
            standardRange: [150, 168],
            message: '手刀揮擊終點手肘過度彎曲，攻擊距離縮短且易變成手掌拍擊。',
            prescription:
              '修正建議：揮擊至鎖骨／頸側高度時將前臂延伸至 155°–165°，四指併攏伸直、大拇指內扣，以小指側手刀邊緣精準切入。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'hip',
            currentValue: 146,
            standardRange: [115, 138],
            message: '定型時後屈立／前屈立骨盆微幅外飄，影響下一動連貫。',
            prescription:
              '修正建議：手刀定型瞬間同步鎖定下盤膝蓋方向與引手腰側位置，形成短暫極決め（Kime）。',
            severity: 'minor',
          },
        ];
        break;

      case 'soto_uke':
        primaryJoint = 'right_elbow';
        totalScore = 87;
        grade = 'A';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「中段外受／中段擋 (Soto-uke / Momtong-makgi)」（信心度 ${confidence}%）。前臂保護軀幹中線軌跡清晰，但在定型瞬間（約 ${peakTime} 秒）手肘伸展過直（116°），高於標準 90° 結構角（85°–105°）。`;
        strengths = [
          '前臂揮擺格擋動量充足，有效保護胸腹中線區域',
          '格擋過程下盤與軀幹中軸穩定，未出現左右晃動',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_elbow',
            currentValue: 116,
            standardRange: [85, 105],
            message: '格擋定型時手臂伸太直且位置偏前，削弱了背闊肌與胸大肌的結構支撐力。',
            prescription:
              '修正建議：定型瞬間手肘夾角維持約 90°、前臂接近垂直，拳高與肩同高且手肘距離肋骨約一拳寬度。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'hip',
            currentValue: 145,
            standardRange: [115, 138],
            message: '格擋末端腰胯半身旋轉（Hanmi）幅度不足，僅靠手臂橫撥。',
            prescription:
              '修正建議：配合前臂旋內定型的最後一拍，同步將骨盆微幅旋向內側以疊加全身剛性。',
            severity: 'minor',
          },
        ];
        break;

      case 'hook_kick':
        primaryJoint = 'right_knee';
        totalScore = 84;
        grade = 'B';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「跆拳道・勾踢 (Huryeo-chagi / Golcha-chagi)」（信心度 ${confidence}%）。前段側向展髖伸直軌跡明確，但在由伸直轉為屈膝勾回的關鍵瞬間（約 ${peakTime} 秒）膕旁肌收縮速度偏慢（膝角 136°），使勾打鞭甩感略顯斷裂。`;
        strengths = [
          '第一階段側向提膝與展髖角度充分，成功製造假動作空間',
          '支撐腳前腳掌旋轉穩定，勾擊過程未出現大幅後仰失衡',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_knee',
            currentValue: 136,
            standardRange: [95, 125],
            message: '勾擊瞬間屈膝勾回幅度與速度不足，變成整條直腿橫掃，力量分散。',
            prescription:
              '修正建議：在腿部於目標側面伸展至約 165° 後，立即啟動大腿後側膕旁肌（Hamstrings）爆發屈膝至 105° 左右，以腳跟或腳掌快速鞭勾目標。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'torso',
            currentValue: 155,
            standardRange: [165, 180],
            message: '勾踢結束落步時上身略微側傾，回收回防速度偏慢。',
            prescription:
              '修正建議：勾擊完成後順勢將小腿收摺於臀部前方再落步，同時收緊腹斜肌維持實戰準備姿勢。',
            severity: 'minor',
          },
        ];
        break;

      case 'zenkutsu_dachi':
        primaryJoint = 'left_knee';
        totalScore = 88;
        grade = 'A';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「前屈立 (Zenkutsu-dachi / Ap-kubi)」（信心度 ${confidence}%）。前後腳跨步寬度與上身垂直度良好，但在下沉定型階段（約 ${peakTime} 秒）前膝屈曲角度略淺（134°），重心偏後且後腳跟有微幅浮起現象。`;
        strengths = [
          '雙腳左右橫向維持與肩同寬，下盤具備良好抗側向推力穩定度',
          '上身保持垂直挺立，未因跨步過大而產生駝背前傾',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'left_knee',
            currentValue: 134,
            standardRange: [105, 125],
            message: '前腳膝蓋屈曲不足導致重心過後（未達 60:40），且前膝有微幅內扣趨勢。',
            prescription:
              '修正建議：前膝向前下方推進至垂直遮住腳尖（膝角約 110°–120°），膝蓋方向嚴格對齊腳尖正前方，後腿打直並將後腳跟踩實地面。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'hip',
            currentValue: 143,
            standardRange: [115, 138],
            message: '骨盆兩側高度微幅不平，後側髖關節外翻。',
            prescription:
              '修正建議：收緊後腿臀大肌並將後腳尖朝前斜約 30°，使骨盆水平面向正前方。',
            severity: 'minor',
          },
        ];
        break;

      case 'fighting_stance':
        primaryJoint = 'right_knee';
        totalScore = 89;
        grade = 'A';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「跆拳道・實戰姿勢 (Gyeorugi-junbi)」（信心度 ${confidence}%）。身體側向角度與雙手護架高度標準，惟在步法彈性律動期間（約 ${peakTime} 秒）雙膝伸展過直（164°），削弱了瞬間起動踢擊的地面反作用力。`;
        strengths = [
          '身體呈 45° 側向站位有效縮小受擊面積，雙手穩定護於胸頷前方',
          '前後腳重心分配均衡，具備隨時前後滑步（Step）之機動性',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_knee',
            currentValue: 164,
            standardRange: [135, 155],
            message: '律動過程中膝關節接近完全打直，重心僵硬且高重心不利於快速起腿。',
            prescription:
              '修正建議：雙膝維持 140°–150° 微彎彈性角度，以前腳掌輕快點地維持阿基里斯腱預伸展張力。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'left_elbow',
            currentValue: 138,
            standardRange: [80, 115],
            message: '律動後段前手護架微幅下垂外張，中段防禦出現空檔。',
            prescription:
              '修正建議：前手肘自然收貼肋骨斜前方（肘角約 95°），拳高維持於鎖骨至下巴高度。',
            severity: 'minor',
          },
        ];
        break;

      case 'axe_kick':
      default:
        primaryJoint = 'right_knee';
        totalScore = 84;
        grade = 'B';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「跆拳道・下劈 (Naeryeo-chagi)」（信心度 ${confidence}%）。起腿越過頭頂高度優異，但在由最高點向下劈落瞬間（約 ${peakTime} 秒）膝關節微彎（156°），且軀幹有後仰代償現象，建議強化膕旁肌動態柔韌度與核心穩定。`;
        strengths = [
          '最高點抬腿超越頭部高度，由內向外擺上軌跡流暢無卡頓',
          '下劈角速度峰值突出，具備強大垂直下壓動量',
        ];
        defects = [
          {
            id: `def-${Date.now()}-1`,
            timestamp: peakTime,
            jointName: 'right_knee',
            currentValue: 156,
            standardRange: [165, 179],
            message: '最高點轉折下劈時膝蓋彎曲代償，縮減了腳跟下壓的攻擊距離。',
            prescription:
              '修正建議：加強大腿後側膕旁肌動態伸展，並在最高點瞬間啟動臀大肌與髂腰肌離心控制，保持膝角 168° 以上直線劈落。',
            severity: 'moderate',
          },
          {
            id: `def-${Date.now()}-2`,
            timestamp: recoveryTime,
            jointName: 'torso',
            currentValue: 155,
            standardRange: [165, 180],
            message: '高抬腿時上半身後仰代償，導致下劈落地後重心落於後腳。',
            prescription:
              '修正建議：抬腿至最高點時收緊下腹與肋骨，保持微幅含胸姿勢，使下壓完成後能順勢向前連擊。',
            severity: 'minor',
          },
        ];
        break;
    }

    const actionFocusFeatures = ACTION_METADATA[actionType].focusFeatures;
    const mapLegacyJointToFocusFeature = (j: JointName): JointName => {
      if (j === 'right_elbow') return 'right_elbow_deg';
      if (j === 'left_elbow') return 'left_elbow_deg';
      if (j === 'right_knee') return 'right_knee_deg';
      if (j === 'left_knee') return 'left_knee_deg';
      if (j === 'hip') {
        return actionFocusFeatures.find((f) => f.includes('hip')) ?? 'right_hip_deg';
      }
      if (j === 'torso') {
        return (
          actionFocusFeatures.find((f) => f.includes('shoulder')) ?? 'right_shoulder_deg'
        );
      }
      return j;
    };

    const resolvedPrimaryFeature = mapLegacyJointToFocusFeature(primaryJoint);
    defects = defects.map((d) => ({
      ...d,
      jointName: mapLegacyJointToFocusFeature(d.jointName),
    }));

    const orderedFeatures: JointName[] = [];
    for (const f of [
      resolvedPrimaryFeature,
      ...actionFocusFeatures,
      ...defects.map((d) => d.jointName),
    ]) {
      if (!orderedFeatures.includes(f)) {
        orderedFeatures.push(f);
      }
    }

    const allJointSeries = orderedFeatures.map((feat) =>
      generateRealisticSeries(feat, effectiveDuration, actionType)
    );
    const primarySeries = allJointSeries[0];

    const sampleCount = Math.max(20, Math.floor(effectiveDuration * 10));
    const frames: FrameKeypoints[] = [];
    const clamp01 = (v: number) => Math.max(0, Math.min(1, Number(v.toFixed(4))));
    for (let i = 0; i <= sampleCount; i++) {
      const t = Number((i * 0.1).toFixed(1));
      const progress = i / sampleCount;
      const wave = Math.sin(progress * Math.PI);
      const centerX = 290 / 640;
      const hipY = 205 / 360;
      const neckY = 132 / 360;

      const isUpper =
        actionType === 'straight_punch' ||
        actionType === 'lunge_punch' ||
        actionType === 'uraken_uchi' ||
        actionType === 'shuto_uchi' ||
        actionType === 'age_uke' ||
        actionType === 'soto_uke' ||
        actionType === 'gedan_barai';

      const rightElbowX = isUpper
        ? clamp01((290 + 32 + wave * 38) / 640)
        : clamp01((290 + 24) / 640);
      const rightElbowY = isUpper
        ? clamp01((152 - wave * 14) / 360)
        : clamp01(162 / 360);
      const rightWristX = isUpper
        ? clamp01((290 + 58 + wave * 106) / 640)
        : clamp01((290 + 36) / 640);
      const rightWristY = isUpper ? clamp01(138 / 360) : clamp01(148 / 360);

      const rightKneeX = !isUpper
        ? clamp01((290 + 26 + wave * 48) / 640)
        : clamp01((290 + 22) / 640);
      const rightKneeY = !isUpper
        ? clamp01((205 - wave * 58) / 360)
        : clamp01(252 / 360);
      const rightAnkleX = !isUpper
        ? clamp01((290 + 26 + wave * 126) / 640)
        : clamp01((290 + 38) / 640);
      const rightAnkleY = !isUpper
        ? clamp01((205 - wave * 86) / 360)
        : clamp01(300 / 360);

      frames.push({
        t,
        keypoints: [
          { name: 'head', x: clamp01(centerX), y: clamp01(95 / 360), visibility: 0.99 },
          { name: 'neck', x: clamp01(centerX), y: clamp01(neckY), visibility: 0.99 },
          { name: 'right_shoulder', x: clamp01((290 + 14) / 640), y: clamp01(136 / 360), visibility: 0.98 },
          { name: 'left_shoulder', x: clamp01((290 - 14) / 640), y: clamp01(136 / 360), visibility: 0.98 },
          { name: 'hip', x: clamp01(centerX), y: clamp01(hipY), visibility: 0.99 },
          { name: 'right_hip', x: clamp01((290 + 10) / 640), y: clamp01(hipY), visibility: 0.98 },
          { name: 'left_hip', x: clamp01((290 - 10) / 640), y: clamp01(hipY), visibility: 0.98 },
          { name: 'right_elbow', x: rightElbowX, y: rightElbowY, visibility: 0.96 },
          { name: 'right_wrist', x: rightWristX, y: rightWristY, visibility: 0.95 },
          { name: 'left_elbow', x: clamp01((290 - 26) / 640), y: clamp01(162 / 360), visibility: 0.92 },
          { name: 'left_wrist', x: clamp01((290 - 14) / 640), y: clamp01(175 / 360), visibility: 0.9 },
          { name: 'right_knee', x: rightKneeX, y: rightKneeY, visibility: 0.97 },
          { name: 'right_ankle', x: rightAnkleX, y: rightAnkleY, visibility: 0.95 },
          { name: 'left_knee', x: clamp01((290 - 16) / 640), y: clamp01(252 / 360), visibility: 0.96 },
          { name: 'left_ankle', x: clamp01((290 - 28) / 640), y: clamp01(300 / 360), visibility: 0.95 },
        ],
      });
    }

    const startTimeS = Number((effectiveDuration * 0.12).toFixed(2));
    const completionTimeS = peakTime;
    const endTimeS = Number((effectiveDuration * 0.85).toFixed(2));

    const rawResponse = {
      analysisId: `ana-${videoId}`,
      videoId,
      source: 'mock' as const,
      modelVersion: 'mock-biomechanics-v2.7-csv-aligned',
      fps: 30,
      actionType,
      confidence,
      totalScore,
      grade,
      duration: effectiveDuration,
      feedbackSummary,
      strengths,
      keyframes: {
        preparation: prepTime,
        impact: peakTime,
        recovery: recoveryTime,
        start_time_s: startTimeS,
        completion_time_s: completionTimeS,
        end_time_s: endTimeS,
      },
      frames,
      defects,
      angleTimeSeries: primarySeries,
      allJointSeries,
    };

    try {
      const validated = validateAnalysisResponse(rawResponse, videoId);
      await videoRepository.saveAnalysisResult(videoId, validated);
      return validated;
    } catch (err) {
      const apiErr =
        err instanceof ApiClientError
          ? err
          : new ApiClientError(
              err instanceof Error ? err.message : '模擬分析資料未通過契約驗證',
              'INVALID_PAYLOAD'
            );
      await videoRepository.updateUploadStatus(videoId, 'failed', {
        errorMessage: apiErr.message,
      });
      throw apiErr;
    }
  },

  /**
   * 利用 Canvas 動態生成一段含骨骼關鍵點與即時角度遙測的範例影片，預設為「待系統識別」狀態
   */
  async createSyntheticDemoVideo(preferredAction?: ActionType): Promise<string> {
    const simulatedAction =
      preferredAction ??
      DEMO_ACTION_CYCLE[demoCycleIndex++ % DEMO_ACTION_CYCLE.length];
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;

    const stream = canvas.captureStream(30);
    const mimeType =
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const durationSec = 3.2;
    const totalFrames = Math.floor(durationSec * 30);
    let frame = 0;
    let capturedThumbnail: string | undefined;

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        const id = `vid-demo-${Date.now()}`;
        const record: LocalVideoRecord = {
          id,
          blob,
          mimeType,
          duration: durationSec,
          createdAt: Date.now(),
          status: 'local_saved',
          requestedActionType: preferredAction,
          recognizedActionType: undefined,
          thumbnailDataUrl: capturedThumbnail,
          sourceType: 'synthetic_demo',
          fileName: `MotionCapture-${simulatedAction}.webm`,
        };
        await videoRepository.saveRecordedVideo(record);
        resolve(id);
      };

      recorder.start(100);

      const interval = setInterval(() => {
        const progress = frame / totalFrames;
        const currentTime = (frame / 30).toFixed(2);
        const wave = Math.sin(progress * Math.PI);
        const simulatedAngle = Math.round(78 + wave * 90);

        // 極簡深色背景
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 極淡水平基準線
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, 300);
        ctx.lineTo(canvas.width - 40, 300);
        ctx.stroke();

        const centerX = 290;
        const hipY = 205;

        // 繪製全身骨架與關節點
        ctx.strokeStyle = '#e4e4e7';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        // 頭部與中軸
        ctx.beginPath();
        ctx.arc(centerX, 95, 16, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX, 111);
        ctx.lineTo(centerX, hipY);
        ctx.stroke();

        // 支撐腳
        ctx.beginPath();
        ctx.moveTo(centerX, hipY);
        ctx.lineTo(centerX - 28, 300);
        ctx.stroke();

        // 動態攻擊肢體與關節角度
        const isPeakZone = progress > 0.42 && progress < 0.58;
        ctx.strokeStyle = isPeakZone ? '#f43f5e' : '#10b981';

        let jointX: number;
        let jointY: number;

        if (
          simulatedAction === 'straight_punch' ||
          simulatedAction === 'lunge_punch' ||
          simulatedAction === 'uraken_uchi' ||
          simulatedAction === 'shuto_uchi' ||
          simulatedAction === 'age_uke' ||
          simulatedAction === 'soto_uke' ||
          simulatedAction === 'gedan_barai'
        ) {
          if (simulatedAction === 'age_uke' || simulatedAction === 'soto_uke') {
            jointX = centerX + 26 + wave * 24;
            jointY = 148 - wave * (simulatedAction === 'age_uke' ? 52 : 24);
            const wristX = jointX - 8 + wave * 22;
            const wristY = jointY - 22 - wave * 20;
            ctx.beginPath();
            ctx.moveTo(centerX, 132);
            ctx.lineTo(jointX, jointY);
            ctx.lineTo(wristX, wristY);
            ctx.stroke();
          } else if (simulatedAction === 'gedan_barai') {
            jointX = centerX + 22 + wave * 28;
            jointY = 136 + wave * 34;
            const wristX = jointX + 18 + wave * 42;
            const wristY = jointY + 16 + wave * 38;
            ctx.beginPath();
            ctx.moveTo(centerX, 132);
            ctx.lineTo(jointX, jointY);
            ctx.lineTo(wristX, wristY);
            ctx.stroke();
          } else {
            jointX = centerX + 32 + wave * 38;
            jointY = 152 - wave * 14;
            const wristX = jointX + 26 + wave * 68;
            const wristY = 138;
            ctx.beginPath();
            ctx.moveTo(centerX, 132);
            ctx.lineTo(jointX, jointY);
            ctx.lineTo(wristX, wristY);
            ctx.stroke();
          }

          ctx.strokeStyle = '#e4e4e7';
          ctx.beginPath();
          ctx.moveTo(centerX, hipY);
          ctx.lineTo(centerX + 38, 300);
          ctx.stroke();
        } else if (
          simulatedAction === 'zenkutsu_dachi' ||
          simulatedAction === 'fighting_stance'
        ) {
          jointX = centerX + 34 + wave * 18;
          jointY = hipY + 38 - wave * 10;
          const ankleX = jointX + 12;
          const ankleY = 300;
          ctx.beginPath();
          ctx.moveTo(centerX, hipY);
          ctx.lineTo(jointX, jointY);
          ctx.lineTo(ankleX, ankleY);
          ctx.stroke();
        } else {
          const highLift = simulatedAction === 'axe_kick' ? 82 : 58;
          jointX = centerX + 26 + wave * 48;
          jointY = hipY - wave * highLift;
          const ankleX = jointX + wave * 78;
          const ankleY =
            simulatedAction === 'axe_kick'
              ? jointY - wave * 46
              : jointY - wave * 28;
          ctx.beginPath();
          ctx.moveTo(centerX, hipY);
          ctx.lineTo(jointX, jointY);
          ctx.lineTo(ankleX, ankleY);
          ctx.stroke();
        }

        // 關節圓點與角度標記
        ctx.fillStyle = isPeakZone ? '#f43f5e' : '#10b981';
        ctx.beginPath();
        ctx.arc(jointX, jointY, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fafafa';
        ctx.font = '500 12px monospace';
        ctx.fillText(`${simulatedAngle}°`, jointX + 10, jointY - 10);

        // 左上角極簡時間與角度標記
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '500 12px monospace';
        ctx.fillText(`${currentTime}s · ${simulatedAngle}°`, 24, 32);

        if (frame === Math.floor(totalFrames * 0.48)) {
          capturedThumbnail = canvas.toDataURL('image/jpeg', 0.82);
        }

        frame++;
        if (frame >= totalFrames) {
          clearInterval(interval);
          recorder.stop();
        }
      }, 1000 / 30);
    });
  },
};
