import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  Pause,
  Play,
  RotateCcw,
  StepBack,
  StepForward,
  Video,
} from 'lucide-react';
import { videoRepository } from '../../db/repositories/video.repo';
import {
  ACTION_METADATA,
  JOINT_LABELS,
  type ActionAnalysisResponse,
  type ActionType,
  type JointName,
  type LocalVideoRecord,
} from '../../types/martial-arts.types';
import { computeBiomechanicsMetrics } from '../../services/apiClient.interface';
import { useObjectUrl } from '../../shared/hooks/useObjectUrl';
import { JointAngleChart } from './components/charts/JointAngleChart';
import { DefectTimelineList } from './components/defects/DefectTimelineList';
import { useToast } from '../../shared/components/ToastContainer';

interface AnalysisDashboardProps {
  videoId: string;
  analysisId: string;
  onBack: () => void;
  onReverifyAction?: (actionType: ActionType) => void;
}

/**
 * 視覺化分析報告儀表板 (Kinovea + JAB AI + Sensei AI + Uplift Labs)
 */
export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  videoId,
  analysisId,
  onBack,
  onReverifyAction,
}) => {
  const { pushToast } = useToast();
  const [videoRecord, setVideoRecord] = useState<LocalVideoRecord | null>(null);
  const [analysis, setAnalysis] = useState<ActionAnalysisResponse | null>(null);
  const [loadState, setLoadState] = useState<
    'loading' | 'ready' | 'not_found' | 'error'
  >('loading');
  const [loadErrorMessage, setLoadErrorMessage] = useState<string>('');
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);
  const [selectedJoint, setSelectedJoint] = useState<JointName>('right_elbow');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showKinoveaOverlay, setShowKinoveaOverlay] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoUrl = useObjectUrl(videoRecord?.blob);

  useEffect(() => {
    let mounted = true;
    setLoadState('loading');
    setLoadErrorMessage('');

    Promise.all([
      videoId ? videoRepository.getVideoById(videoId) : Promise.resolve(undefined),
      videoRepository.getAnalysisById(analysisId),
    ])
      .then(async ([vid, ana]) => {
        if (!mounted) return;
        const resolvedVid =
          vid ?? (ana?.videoId ? await videoRepository.getVideoById(ana.videoId) : undefined);

        if (!ana || !resolvedVid) {
          setLoadState('not_found');
          return;
        }

        setVideoRecord(resolvedVid);
        setAnalysis(ana);
        setSelectedJoint(ana.angleTimeSeries.jointName);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!mounted) return;
        setLoadErrorMessage(
          err instanceof Error ? err.message : '讀取本地資料庫時發生未知錯誤'
        );
        setLoadState('error');
      });

    return () => {
      mounted = false;
    };
  }, [videoId, analysisId, reloadTrigger]);

  const handleSeekToTime = useCallback((seconds: number) => {
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.pause();
      videoEl.currentTime = seconds;
    }
    setCurrentTime(seconds);
  }, []);

  const handleStepFrame = useCallback(
    (deltaSeconds: number) => {
      const videoEl = videoRef.current;
      if (!videoEl) return;
      videoEl.pause();
      const maxDur = videoEl.duration || analysis?.duration || 3.2;
      const nextTime = Math.max(
        0,
        Math.min(maxDur, Number((videoEl.currentTime + deltaSeconds).toFixed(2)))
      );
      videoEl.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [analysis?.duration]
  );

  const handleTogglePlay = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl.play().catch(() => {
        // 瀏覽器阻擋自動播放或切換時被中斷，狀態由 video pause/play 事件同步
      });
    } else {
      videoEl.pause();
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleStepFrame(-0.1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleStepFrame(0.1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay, handleStepFrame]);

  const handleSelectDefect = (timestamp: number, jointName: JointName) => {
    setSelectedJoint(jointName);
    handleSeekToTime(timestamp);
  };

  const handleChangeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleExportJson = () => {
    if (!analysis) return;
    const jsonBlob = new Blob([JSON.stringify(analysis, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.actionType}-${analysis.analysisId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast({
      type: 'success',
      title: '已匯出分析報告 JSON',
    });
  };

  const seriesList = useMemo(
    () => (analysis ? analysis.allJointSeries ?? [analysis.angleTimeSeries] : []),
    [analysis]
  );

  const currentPointHud = useMemo(() => {
    const activeSeries =
      seriesList.find((s) => s.jointName === selectedJoint) ?? seriesList[0];
    if (!activeSeries || activeSeries.points.length === 0) return null;
    const snapped = Number(currentTime.toFixed(1));
    const closest = activeSeries.points.reduce((prev, curr) =>
      Math.abs(curr.time - snapped) < Math.abs(prev.time - snapped) ? curr : prev
    );
    const isCompliant =
      closest.actualAngle >= closest.standardMin &&
      closest.actualAngle <= closest.standardMax;
    const delta = isCompliant
      ? 0
      : closest.actualAngle < closest.standardMin
        ? closest.actualAngle - closest.standardMin
        : closest.actualAngle - closest.standardMax;
    return {
      jointName: activeSeries.jointName,
      jointLabel: JOINT_LABELS[activeSeries.jointName],
      ...closest,
      isCompliant,
      delta,
    };
  }, [seriesList, selectedJoint, currentTime]);

  const subMetrics = useMemo(
    () => (analysis ? computeBiomechanicsMetrics(analysis) : null),
    [analysis]
  );

  if (loadState === 'loading') {
    return (
      <div className="lab-card p-16 text-center text-xs text-zinc-500">
        載入分析報告中...
      </div>
    );
  }

  if (loadState === 'not_found') {
    return (
      <div className="lab-card p-16 text-center space-y-4">
        <div className="text-sm font-medium text-zinc-200">
          找不到對應的動作影片或分析報告
        </div>
        <p className="text-xs text-zinc-500 max-w-md mx-auto">
          該筆紀錄可能已被刪除，或尚未完成分析。請返回影片庫重新選擇影片。
        </p>
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回影片庫
          </button>
        </div>
      </div>
    );
  }

  if (loadState === 'error' || !analysis || !subMetrics) {
    return (
      <div className="lab-card p-16 text-center space-y-4">
        <div className="text-sm font-medium text-rose-300">
          讀取分析報告失敗
        </div>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          {loadErrorMessage || '無法從本地資料庫讀取報告內容'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setReloadTrigger((n) => n + 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重試讀取
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 text-xs font-medium transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回影片庫
          </button>
        </div>
      </div>
    );
  }

  const actionMeta = ACTION_METADATA[analysis.actionType];
  const keyframes = analysis.keyframes;
  const displayDuration = analysis.duration ?? videoRecord?.duration ?? 0;

  return (
    <div className="space-y-8">
      {/* 頂部返回、動作識別結果與 Sensei AI 閉環訓練操作列 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            返回影片庫
          </button>
          <span className="text-zinc-700">|</span>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[11px] font-medium text-zinc-200">
              系統識別結果
            </span>
            <span className="text-sm font-semibold text-white">
              {actionMeta.label}
            </span>
            <span className="text-xs text-zinc-400">
              {actionMeta.martialArt}
            </span>
            {analysis.confidence !== undefined && (
              <span className="text-xs font-mono text-emerald-400">
                信心度 {analysis.confidence}%
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {onReverifyAction && (
            <button
              type="button"
              onClick={() => onReverifyAction(analysis.actionType)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium transition"
            >
              <Video className="w-3.5 h-3.5" />
              再次拍攝驗證
            </button>
          )}

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            匯出 JSON
          </button>
        </div>
      </div>

      {/* JAB AI 回合式極簡數據指標列 (Minimalist Metric Strip) */}
      <div className="lab-card p-6 grid grid-cols-2 sm:grid-cols-5 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
        <div className="sm:pr-4">
          <div className="text-xs text-zinc-500">資料庫比對識別動作</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-semibold text-white">
              {actionMeta.label}
            </span>
            {analysis.confidence !== undefined && (
              <span className="text-xs font-mono text-emerald-400 tabular-nums">
                {analysis.confidence}%
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            {actionMeta.martialArt}標準模型
          </div>
        </div>

        <div className="pt-4 sm:pt-0 sm:px-6">
          <div className="text-xs text-zinc-500">動作評分與等級</div>
          <div className="mt-1.5 flex items-baseline gap-2.5">
            <span className="text-3xl font-semibold font-mono text-white tabular-nums">
              {analysis.totalScore}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-xs font-mono font-medium text-white">
              Grade {analysis.grade}
            </span>
          </div>
        </div>

        <div className="pt-4 sm:pt-0 sm:px-6">
          <div className="text-xs text-zinc-500">標準角度達成率</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-emerald-400 tabular-nums">
            {subMetrics.complianceRate}%
          </div>
        </div>

        <div className="pt-4 sm:pt-0 sm:px-6">
          <div className="text-xs text-zinc-500">核心軸線穩定度</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-zinc-100 tabular-nums">
            {subMetrics.stabilityScore}
          </div>
        </div>

        <div className="pt-4 sm:pt-0 sm:pl-6">
          <div className="text-xs text-zinc-500">最大角度偏差</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-rose-400 tabular-nums">
            {subMetrics.peakDeviationDeg}°
          </div>
        </div>
      </div>

      {/* 主內容雙欄佈局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 左欄 (5 cols)：Kinovea 慢動作角度疊加檢視器 + JAB AI 教練講評與亮點 */}
        <div className="lg:col-span-5 space-y-6">
          <div className="lab-card overflow-hidden">
            <div className="relative aspect-video bg-[#0c0c0f] flex items-center justify-center">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  playsInline
                  onTimeUpdate={(e) =>
                    setCurrentTime(e.currentTarget.currentTime)
                  }
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-zinc-500">載入影片中...</div>
              )}

              {/* 左上角：Kinovea 視覺量角器疊加開關 */}
              <button
                type="button"
                onClick={() => setShowKinoveaOverlay((prev) => !prev)}
                className={`absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium backdrop-blur-md transition ${
                  showKinoveaOverlay
                    ? 'bg-zinc-950/85 border-white/20 text-zinc-100'
                    : 'bg-zinc-950/60 border-white/[0.06] text-zinc-500'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>角度標記 {showKinoveaOverlay ? '開' : '關'}</span>
              </button>

              {/* Kinovea 風格關節量角器與錯誤高亮 SVG 疊加層 */}
              {showKinoveaOverlay && currentPointHud && (
                <svg
                  viewBox="0 0 320 180"
                  className="pointer-events-none absolute inset-0 w-full h-full"
                >
                  {/* 動態關節角度扇形與錯誤高亮圓環 */}
                  {!currentPointHud.isCompliant && (
                    <circle
                      cx="188"
                      cy="76"
                      r="22"
                      fill="rgba(244, 63, 94, 0.14)"
                      stroke="#f43f5e"
                      strokeWidth="1.25"
                      strokeDasharray="3 2"
                    />
                  )}
                  <path
                    d="M 164 92 L 188 76 L 222 62"
                    fill="none"
                    stroke={currentPointHud.isCompliant ? '#10b981' : '#f43f5e'}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="188"
                    cy="76"
                    r="3.5"
                    fill={currentPointHud.isCompliant ? '#10b981' : '#f43f5e'}
                  />
                </svg>
              )}

              {/* 左下角：Kinovea 即時關節角度與偏差狀態 HUD */}
              {currentPointHud && (
                <div className="pointer-events-none absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-zinc-950/85 border border-white/[0.08] backdrop-blur-md font-mono text-xs flex items-center gap-2">
                  <span className="text-zinc-300">
                    {currentPointHud.jointLabel}
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      currentPointHud.isCompliant
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {currentPointHud.actualAngle}°
                  </span>
                  <span className="text-[11px] text-zinc-500 tabular-nums">
                    標準 {currentPointHud.standardMin}°–{currentPointHud.standardMax}°
                    {!currentPointHud.isCompliant &&
                      ` (${currentPointHud.delta > 0 ? `+${currentPointHud.delta}` : currentPointHud.delta}°)`}
                  </span>
                </div>
              )}

              {/* 右上角時間點 */}
              <div className="pointer-events-none absolute top-3 right-3 px-2.5 py-1 rounded-md bg-zinc-950/80 font-mono text-[11px] text-zinc-300 tabular-nums">
                {currentTime.toFixed(2)}s
                {displayDuration > 0 ? ` / ${displayDuration.toFixed(1)}s` : ''}
              </div>
            </div>

            {/* Kinovea 動作三階段關鍵幀快速定位列 (Keyframes) — 僅在後端提供 keyframes 時顯示 */}
            {keyframes && (
              <div className="px-4 py-2.5 bg-zinc-950/50 border-t border-white/[0.05] flex items-center justify-between gap-2 text-xs">
                <span className="text-[11px] text-zinc-500">動作階段定位</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: '蓄力期', time: keyframes.preparation },
                    { label: '擊打頂點', time: keyframes.impact },
                    { label: '收勢回防', time: keyframes.recovery },
                  ].map((kf) => {
                    const isActive = Math.abs(currentTime - kf.time) < 0.2;
                    return (
                      <button
                        key={kf.label}
                        type="button"
                        onClick={() => handleSeekToTime(kf.time)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition ${
                          isActive
                            ? 'bg-zinc-200 text-zinc-950 font-medium'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/[0.05]'
                        }`}
                      >
                        {kf.label} {kf.time.toFixed(1)}s
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 乾淨的播放與慢動作控制列 */}
            <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      暫停
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      播放
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleStepFrame(-0.1)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-300 transition"
                  title="倒退 0.1 秒 (←)"
                >
                  <StepBack className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStepFrame(0.1)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-300 transition"
                  title="前進 0.1 秒 (→)"
                >
                  <StepForward className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSeekToTime(0)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                  title="重頭開始"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 倍速切換 */}
              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-full border border-white/[0.06]">
                {[0.25, 0.5, 1].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleChangeSpeed(rate)}
                    className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] transition ${
                      playbackRate === rate
                        ? 'bg-zinc-200 text-zinc-950 font-medium'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* JAB AI / Sensei AI 教練筆記與動作亮點卡片 — 僅在有回傳對應欄位時顯示 */}
          {(analysis.feedbackSummary ||
            (analysis.strengths && analysis.strengths.length > 0)) && (
            <div className="lab-card p-6 space-y-4">
              {analysis.feedbackSummary && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-zinc-400">
                    教練評估總結
                  </h3>
                  <p className="text-sm text-zinc-200 leading-relaxed">
                    {analysis.feedbackSummary}
                  </p>
                </div>
              )}

              {analysis.strengths && analysis.strengths.length > 0 && (
                <div
                  className={`${
                    analysis.feedbackSummary
                      ? 'pt-4 border-t border-white/[0.06]'
                      : ''
                  } space-y-2`}
                >
                  <div className="text-xs font-medium text-zinc-400">
                    動作表現亮點
                  </div>
                  <ul className="space-y-1.5">
                    {analysis.strengths.map((str, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-xs text-zinc-300 leading-relaxed"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右欄 (7 cols)：Uplift 時序曲線與 Sensei 具體修正處方 */}
        <div className="lg:col-span-7 space-y-6">
          <JointAngleChart
            seriesList={seriesList}
            selectedJoint={selectedJoint}
            onSelectJoint={setSelectedJoint}
            currentTime={currentTime}
            defects={analysis.defects}
            onSeekToTime={handleSeekToTime}
          />

          <DefectTimelineList
            defects={analysis.defects}
            currentTime={currentTime}
            onSelectDefect={handleSelectDefect}
          />
        </div>
      </div>
    </div>
  );
};

