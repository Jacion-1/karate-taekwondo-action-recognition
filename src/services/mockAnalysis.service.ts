import type {
  ActionAnalysisResponse,
  ActionType,
  AngleTimeSeriesPoint,
  DefectItem,
  JointAngleSeries,
  JointName,
  LocalVideoRecord,
} from '../types/martial-arts.types';
import { videoRepository } from '../db/repositories/video.repo';
import type {
  IAnalysisApiClient,
  UploadAnalyzeOptions,
} from './apiClient.interface';

/**
 * 根據武術動作類型與關節，生成物理上逼真的時序角度數據（每 0.1 秒一筆採樣）
 */
function generateRealisticSeries(
  jointName: JointName,
  duration: number,
  actionType: ActionType
): JointAngleSeries {
  const sampleCount = Math.max(20, Math.floor(duration * 10));
  const points: AngleTimeSeriesPoint[] = [];

  for (let i = 0; i <= sampleCount; i++) {
    const time = Number((i * 0.1).toFixed(1));
    const progress = i / sampleCount;

    let standardMin = 140;
    let standardMax = 165;
    let actualAngle = 150;

    if (actionType === 'straight_punch' && jointName === 'right_elbow') {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(70 + wave * 95);
      standardMax = Math.round(85 + wave * 95);
      const deviation = progress > 0.42 && progress < 0.58 ? -14 : Math.sin(i * 0.9) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (actionType === 'age_uke' && jointName === 'right_elbow') {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(52 + wave * 40);
      standardMax = Math.round(68 + wave * 44);
      const deviation = progress > 0.44 && progress < 0.58 ? 14 : Math.sin(i * 0.8) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (actionType === 'gedan_barai' && jointName === 'left_elbow') {
      const wave = Math.sin(progress * Math.PI);
      standardMin = Math.round(62 + wave * 88);
      standardMax = Math.round(76 + wave * 92);
      const deviation = progress > 0.45 && progress < 0.6 ? -13 : Math.cos(i * 0.8) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (
      (actionType === 'roundhouse_kick' ||
        actionType === 'front_kick' ||
        actionType === 'back_kick' ||
        actionType === 'axe_kick') &&
      jointName === 'right_knee'
    ) {
      const wave = Math.pow(Math.sin(progress * Math.PI), 1.4);
      const peakAdd = actionType === 'axe_kick' ? 105 : 100;
      standardMin = Math.round(60 + wave * peakAdd);
      standardMax = Math.round(78 + wave * peakAdd);
      const deviation = progress > 0.45 && progress < 0.62 ? -15 : Math.cos(i * 0.7) * 4;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (actionType === 'side_kick' && jointName === 'left_knee') {
      const wave = Math.pow(Math.sin(progress * Math.PI), 1.3);
      standardMin = Math.round(62 + wave * 100);
      standardMax = Math.round(77 + wave * 100);
      const deviation = progress > 0.44 && progress < 0.6 ? -15 : Math.sin(i * 0.7) * 3;
      actualAngle = Math.round((standardMin + standardMax) / 2 + deviation);
    } else if (jointName === 'hip') {
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
  'age_uke',
  'side_kick',
  'back_kick',
  'gedan_barai',
  'axe_kick',
];
let demoCycleIndex = 0;

const ACTION_CONFIDENCE_MAP: Record<ActionType, number> = {
  straight_punch: 96.4,
  age_uke: 95.2,
  gedan_barai: 94.9,
  front_kick: 96.1,
  roundhouse_kick: 95.8,
  side_kick: 94.6,
  back_kick: 93.8,
  axe_kick: 94.3,
};

/**
 * 模擬後端透過骨架特徵與資料庫標準動作進行時序比對 (DTW / ST-GCN)，自動識別使用者正在執行的動作
 */
function recognizeActionFromVideo(video: LocalVideoRecord): {
  actionType: ActionType;
  confidence: number;
} {
  if (video.actionType) {
    return {
      actionType: video.actionType,
      confidence: ACTION_CONFIDENCE_MAP[video.actionType] ?? 95.5,
    };
  }

  const name = (video.fileName || '').toLowerCase();
  for (const act of DEMO_ACTION_CYCLE) {
    if (name.includes(act)) {
      return { actionType: act, confidence: ACTION_CONFIDENCE_MAP[act] };
    }
  }
  if (name.includes('punch') || name.includes('正拳')) {
    return { actionType: 'straight_punch', confidence: 96.4 };
  }
  if (name.includes('age') || name.includes('上段')) {
    return { actionType: 'age_uke', confidence: 95.2 };
  }
  if (name.includes('gedan') || name.includes('下段')) {
    return { actionType: 'gedan_barai', confidence: 94.9 };
  }
  if (name.includes('front') || name.includes('前踢')) {
    return { actionType: 'front_kick', confidence: 96.1 };
  }
  if (name.includes('roundhouse') || name.includes('迴旋')) {
    return { actionType: 'roundhouse_kick', confidence: 95.8 };
  }
  if (name.includes('side') || name.includes('側踢')) {
    return { actionType: 'side_kick', confidence: 94.6 };
  }
  if (name.includes('back') || name.includes('後踢')) {
    return { actionType: 'back_kick', confidence: 93.8 };
  }
  if (name.includes('axe') || name.includes('下壓')) {
    return { actionType: 'axe_kick', confidence: 94.3 };
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
      message: '內建空手道／跆拳道 8 項標準動作識別與生物力學模擬引擎就緒 (v2.4)',
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

    let primaryJoint: JointName = 'right_elbow';
    let defects: DefectItem[] = [];
    let strengths: string[] = [];
    let feedbackSummary = '';
    let totalScore = 86;
    let grade: 'A' | 'B' | 'C' | 'D' = 'B';

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

      case 'axe_kick':
      default:
        primaryJoint = 'right_knee';
        totalScore = 84;
        grade = 'B';
        feedbackSummary =
          `系統經資料庫特徵比對識別為「跆拳道・下壓踢 (Naeryeo-Chagi)」（信心度 ${confidence}%）。起腿越過頭頂高度優異，但在由最高點向下劈落瞬間（約 ${peakTime} 秒）膝關節微彎（156°），且軀幹有後仰代償現象，建議強化膕旁肌動態柔韌度與核心穩定。`;
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

    const primarySeries = generateRealisticSeries(primaryJoint, effectiveDuration, actionType);
    const hipSeries = generateRealisticSeries('hip', effectiveDuration, actionType);
    const torsoSeries = generateRealisticSeries('torso', effectiveDuration, actionType);

    const response: ActionAnalysisResponse = {
      analysisId: `ana-${videoId}`,
      videoId,
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
      },
      defects,
      angleTimeSeries: primarySeries,
      allJointSeries: [primarySeries, hipSeries, torsoSeries],
    };

    await videoRepository.saveAnalysisResult(videoId, response);
    return response;
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
          // 保持未標記狀態，待上傳分析時由系統比對資料庫自動識別（檔名保留特徵供模擬器辨識）
          actionType: undefined,
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

        let jointX = centerX + 40;
        let jointY = 150;

        if (
          simulatedAction === 'straight_punch' ||
          simulatedAction === 'age_uke' ||
          simulatedAction === 'gedan_barai'
        ) {
          if (simulatedAction === 'age_uke') {
            jointX = centerX + 26 + wave * 24;
            jointY = 148 - wave * 52;
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
