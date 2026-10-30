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
  User,
  FileVideo,
} from 'lucide-react';
import { videoRepository } from '../../db/repositories/video.repo';
import { sessionService } from '../../services/session.service';
import {
  ACTION_METADATA,
  JOINT_LABELS,
  isRelativeFeature,
  type ActionAnalysisResponse,
  type ActionType,
  type JointName,
  type LocalVideoRecord,
  type UserSession,
} from '../../types/martial-arts.types';
import { computeBiomechanicsMetrics } from '../../services/apiClient.interface';
import { useObjectUrl } from '../../shared/hooks/useObjectUrl';
import { JointAngleChart } from './components/charts/JointAngleChart';
import { DefectTimelineList } from './components/defects/DefectTimelineList';
import { PoseCanvasOverlay } from './components/PoseCanvasOverlay';
import { useToast } from '../../shared/components/ToastContainer';

interface AnalysisDashboardProps {
  videoId: string;
  analysisId: string;
  onBack: () => void;
  onReverifyAction?: (actionType: ActionType) => void;
}

type VideoWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (
      now: number,
      metadata: { mediaTime: number; presentedFrames: number }
    ) => void
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

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
  const [userSession, setUserSession] = useState<UserSession>(() =>
    sessionService.getSession()
  );
  const [isPromoting, setIsPromoting] = useState<boolean>(false);

  useEffect(() => {
    return sessionService.subscribe(setUserSession);
  }, []);

  const handlePromoteToMember = async () => {
    if (!analysis || isPromoting) return;
    setIsPromoting(true);
    try {
      sessionService.loginAsMember();
      const targetVideoId = videoRecord?.id || analysis.videoId;
      await sessionService.promoteGuestRecordToMember(
        targetVideoId,
        analysis.analysisId
      );
      const updatedVid =
        (await videoRepository.getVideoById(targetVideoId)) ??
        sessionService.getGuestVideo(targetVideoId);
      if (updatedVid) {
        setVideoRecord(updatedVid);
      }
      pushToast({
        type: 'success',
        title: '登入成功',
        message: '已登入正式會員並永久保存此筆訓練紀錄',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: '儲存失敗',
        message: err instanceof Error ? err.message : '保存失敗',
      });
    } finally {
      setIsPromoting(false);
    }
  };
  const [analysis, setAnalysis] = useState<ActionAnalysisResponse | null>(null);
  const [loadState, setLoadState] = useState<
    'loading' | 'ready' | 'not_found' | 'error'
  >('loading');
  const [loadErrorMessage, setLoadErrorMessage] = useState<string>('');
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);
  const [selectedJoint, setSelectedJoint] = useState<JointName>('right_elbow');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [detectedFps, setDetectedFps] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showKinoveaOverlay, setShowKinoveaOverlay] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoUrl = useObjectUrl(videoRecord?.blob);

  useEffect(() => {
    let mounted = true;
    setLoadState('loading');
    setLoadErrorMessage('');
    setDetectedFps(null);

    Promise.all([
      (async () => {
        if (!videoId) return undefined;
        return (
          (await videoRepository.getVideoById(videoId)) ??
          sessionService.getGuestVideo(videoId)
        );
      })(),
      (async () => {
        return (
          (await videoRepository.getAnalysisById(analysisId)) ??
          sessionService.getGuestAnalysis(analysisId)
        );
      })(),
    ])
      .then(async ([vid, ana]) => {
        if (!mounted) return;
        let resolvedVid = vid;
        if (!resolvedVid && ana?.videoId) {
          resolvedVid =
            (await videoRepository.getVideoById(ana.videoId)) ??
            sessionService.getGuestVideo(ana.videoId);
        }

        if (!ana) {
          setLoadState('not_found');
          return;
        }

        setVideoRecord(resolvedVid ?? null);
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

  // Phase 5.1: 以 requestVideoFrameCallback 同步 currentTime（不支援時退回 requestAnimationFrame）
  useEffect(() => {
    const videoEl = videoRef.current as VideoWithRVFC | null;
    if (!videoEl || !videoUrl) return;

    let rvfcId: number | null = null;
    let rafId: number | null = null;
    let lastMediaTime: number | null = null;
    let lastFrames: number | null = null;
    let cancelled = false;

    if (typeof videoEl.requestVideoFrameCallback === 'function') {
      const onVideoFrame = (
        _now: number,
        metadata: { mediaTime: number; presentedFrames: number }
      ) => {
        if (cancelled) return;
        setCurrentTime(metadata.mediaTime);

        if (
          lastMediaTime !== null &&
          lastFrames !== null &&
          metadata.mediaTime > lastMediaTime &&
          metadata.presentedFrames > lastFrames
        ) {
          const dt = metadata.mediaTime - lastMediaTime;
          const df = metadata.presentedFrames - lastFrames;
          const instantFps = Math.round(df / dt);
          if (instantFps >= 12 && instantFps <= 120) {
            setDetectedFps((prev) => prev ?? instantFps);
          }
        }
        lastMediaTime = metadata.mediaTime;
        lastFrames = metadata.presentedFrames;

        if (!cancelled && typeof videoEl.requestVideoFrameCallback === 'function') {
          rvfcId = videoEl.requestVideoFrameCallback(onVideoFrame);
        }
      };

      rvfcId = videoEl.requestVideoFrameCallback(onVideoFrame);
      return () => {
        cancelled = true;
        if (rvfcId !== null && typeof videoEl.cancelVideoFrameCallback === 'function') {
          videoEl.cancelVideoFrameCallback(rvfcId);
        }
      };
    }

    const onAnimationFrame = () => {
      if (cancelled) return;
      if (!videoEl.paused) {
        setCurrentTime(videoEl.currentTime);
      }
      rafId = requestAnimationFrame(onAnimationFrame);
    };
    rafId = requestAnimationFrame(onAnimationFrame);

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [videoUrl, loadState]);

  // 優先取 rVFC 回報的 metadata 或契約中的 fps，兩者都沒有才假設 30
  const effectiveFps = detectedFps ?? analysis?.fps ?? 30;
  const frameStepSeconds = 1 / effectiveFps;

  const handleSeekToTime = useCallback((seconds: number) => {
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.pause();
      videoEl.currentTime = seconds;
    }
    setCurrentTime(seconds);
  }, []);

  const handleStepFrame = useCallback(
    (frameDirection: -1 | 1) => {
      const videoEl = videoRef.current;
      if (!videoEl) return;
      videoEl.pause();
      const maxDur =
        (Number.isFinite(videoEl.duration) && videoEl.duration > 0
          ? videoEl.duration
          : undefined) ||
        analysis?.duration ||
        3.2;
      const step = 1 / effectiveFps;
      const nextTime = Math.max(
        0,
        Math.min(maxDur, Number((videoEl.currentTime + frameDirection * step).toFixed(4)))
      );
      videoEl.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [analysis?.duration, effectiveFps]
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
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable ||
          target.closest('[contenteditable]')
        ) {
          return;
        }
        if (
          e.code === 'Space' &&
          (tag === 'BUTTON' ||
            target.closest('button') ||
            target.getAttribute('role') === 'slider' ||
            target.closest('[role="slider"]'))
        ) {
          return;
        }
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleStepFrame(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleStepFrame(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay, handleStepFrame]);

  const handleSelectDefect = useCallback(
    (timestamp: number, jointName: JointName) => {
      setSelectedJoint(jointName);
      handleSeekToTime(timestamp);
    },
    [handleSeekToTime]
  );

  const handleChangeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleExportJson = () => {
    if (!analysis) return;
    const exportPayload = {
      ...analysis,
      source: analysis.source,
    };
    const jsonBlob = new Blob([JSON.stringify(exportPayload, null, 2)], {
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

  // Phase 5.5: 圖表的 HUD 直接以 currentTime 取最近的時序點，不先以 toFixed(1) 四捨五入
  const currentPointHud = useMemo(() => {
    const activeSeries =
      seriesList.find((s) => s.jointName === selectedJoint) ?? seriesList[0];
    if (!activeSeries || activeSeries.points.length === 0) return null;
    const closest = activeSeries.points.reduce((prev, curr) =>
      Math.abs(curr.time - currentTime) < Math.abs(prev.time - currentTime)
        ? curr
        : prev
    );
    const isCompliant =
      closest.actualAngle >= closest.standardMin &&
      closest.actualAngle <= closest.standardMax;
    const rawDelta = isCompliant
      ? 0
      : closest.actualAngle < closest.standardMin
        ? closest.actualAngle - closest.standardMin
        : closest.actualAngle - closest.standardMax;
    const isRel = isRelativeFeature(activeSeries.jointName);
    const delta = isRel ? Number(rawDelta.toFixed(2)) : Math.round(rawDelta);
    return {
      jointName: activeSeries.jointName,
      jointLabel: JOINT_LABELS[activeSeries.jointName] || activeSeries.jointName,
      unitSuffix: isRel ? ' rel' : '°',
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
  const isVideoExpired =
    !videoRecord?.blob || videoRecord?.retentionStatus === 'expired_purged';

  return (
    <div className="space-y-6">
      {/* 訪客模式：提示登入以永久保存歷史 */}
      {(userSession.authStatus === 'guest' ||
        videoRecord?.retentionStatus === 'ephemeral_memory') && (
        <div
          role="region"
          aria-label="訪客模式儲存提示"
          className="bg-zinc-900/90 border border-slate-700/50 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>
              訪客模式 — 本次分析數據與視訊僅暫存於當前頁面記憶體，重新整理或切換回首頁後將自動銷毀。
            </span>
          </div>
          <button
            type="button"
            disabled={isPromoting}
            onClick={handlePromoteToMember}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-medium transition text-xs shrink-0 disabled:opacity-50"
          >
            <User className="w-3.5 h-3.5 text-zinc-800" />
            <span>登入以永久保存歷史</span>
          </button>
        </div>
      )}
      {/* Phase 6.1: 當結果的 source === 'mock' 時，報告頁頂部顯示固定的醒目標示 */}
      {analysis.source === 'mock' && (
        <div
          role="note"
          className="sticky top-16 z-20 px-4 py-2.5 rounded-2xl mock-banner-prominent backdrop-blur-md flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span>模擬資料（非真實辨識結果）</span>
          </div>
          <span className="text-[11px] text-amber-200/80">
            此報告由前端內建模擬引擎產生，僅供介面與流程展示；如需實機推論請於右上角切換至 REST API 後端。
          </span>
        </div>
      )}

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
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[11px] font-medium text-zinc-200">
              系統識別結果
            </span>
            <span className="text-sm font-semibold text-white">
              {actionMeta.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${actionMeta.martialArt === '空手道' ? 'badge-karate' : 'badge-taekwondo'}`}>
              {actionMeta.martialArt}
            </span>
            {analysis.confidence !== undefined && (
              <span className="text-xs font-mono text-emerald-400">
                信心度 {analysis.confidence}%
              </span>
            )}
            <span className="provenance-tag px-2 py-0.5 rounded-full text-[10px]">
              {actionMeta.provenance.status === 'cited' && actionMeta.provenance.citation
                ? `標準來源：${actionMeta.provenance.citation}`
                : '初始經驗閾值，待驗證'}
            </span>
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

      {/* JAB AI 回合式極簡數據指標列 (Minimalist Metric Strip) — 穩定度與爆發力僅在後端提供 metrics 時顯示 */}
      <div className="lab-card p-6 grid grid-cols-2 sm:grid-flow-col sm:auto-cols-fr gap-6 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
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
            {actionMeta.martialArt}標準模型 ·{' '}
            {actionMeta.provenance.status === 'cited' && actionMeta.provenance.citation
              ? actionMeta.provenance.citation
              : '初始經驗閾值，待驗證'}
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

        {subMetrics.stabilityScore !== undefined && (
          <div className="pt-4 sm:pt-0 sm:px-6">
            <div className="text-xs text-zinc-500">核心軸線穩定度</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono text-zinc-100 tabular-nums">
              {subMetrics.stabilityScore}
            </div>
          </div>
        )}

        {subMetrics.explosivenessScore !== undefined && (
          <div className="pt-4 sm:pt-0 sm:px-6">
            <div className="text-xs text-zinc-500">動作爆發力</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono text-zinc-100 tabular-nums">
              {subMetrics.explosivenessScore}
            </div>
          </div>
        )}

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
            <div className="relative aspect-video bg-[#0c0c0f] flex items-center justify-center p-6 text-center">
              {isVideoExpired ? (
                <div className="space-y-3 max-w-sm">
                  <div className="inline-flex p-3 rounded-full bg-zinc-900 border border-white/[0.06] text-zinc-400">
                    <FileVideo className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-zinc-200">
                    視訊保存期限已過（數據仍保留）
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    原始訓練視訊已超過 7 天保存期限並自動清理以釋放本機空間；該筆紀錄之結構化數據評分、關節角度時序與教練修正建議仍完整保留。
                  </p>
                </div>
              ) : videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  playsInline
                  onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-zinc-500">載入影片中...</div>
              )}

              {/* 左上角：Kinovea 視覺量角器疊加開關 — 僅在未過期且有 frames 時顯示 */}
              {!isVideoExpired && analysis.frames && analysis.frames.length > 0 && (
                <button
                  type="button"
                  aria-label={showKinoveaOverlay ? '關閉角度標記疊加層' : '開啟角度標記疊加層'}
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
              )}

              {/* Kinovea 風格骨架與關節量角器 Canvas 疊加層（僅在未過期時） */}
              {!isVideoExpired &&
                showKinoveaOverlay &&
                analysis.frames &&
                analysis.frames.length > 0 &&
                currentPointHud && (
                  <PoseCanvasOverlay
                    videoRef={videoRef}
                    frames={analysis.frames}
                    currentTime={currentTime}
                    selectedJoint={selectedJoint}
                    actualAngle={currentPointHud.actualAngle}
                    isCompliant={currentPointHud.isCompliant}
                  />
                )}

              {/* 左下角：Kinovea 即時關鍵特徵與偏差狀態 HUD（僅在未過期時） */}
              {!isVideoExpired && currentPointHud && (
                <div className="pointer-events-none absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-xl bg-zinc-950/85 border border-white/[0.08] backdrop-blur-md font-mono text-xs flex items-center gap-2">
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
                    {currentPointHud.actualAngle}
                    {currentPointHud.unitSuffix}
                  </span>
                  <span className="text-[11px] text-zinc-500 tabular-nums">
                    標準 {currentPointHud.standardMin}–{currentPointHud.standardMax}
                    {currentPointHud.unitSuffix}
                    {!currentPointHud.isCompliant &&
                      ` (${currentPointHud.delta > 0 ? `+${currentPointHud.delta}` : currentPointHud.delta}${currentPointHud.unitSuffix})`}
                  </span>
                </div>
              )}

              {/* 右上角時間點（僅在未過期時） */}
              {!isVideoExpired && (
                <div className="pointer-events-none absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md bg-zinc-950/80 font-mono text-[11px] text-zinc-300 tabular-nums">
                  {currentTime.toFixed(2)}s
                  {displayDuration > 0 ? ` / ${displayDuration.toFixed(1)}s` : ''}
                </div>
              )}
            </div>

            {/* CSV 分段與關鍵時間點快速定位列 (start_time_s / completion_time_s / end_time_s) */}
            {!isVideoExpired && keyframes && (
              <div className="px-4 py-2.5 bg-zinc-950/50 border-t border-white/[0.05] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[11px] text-zinc-500">
                  動作時間定位 (start / completion / end)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    {
                      label: '動作開始 (start_time_s)',
                      time: keyframes.start_time_s ?? keyframes.preparation,
                    },
                    {
                      label: '動作到位 (completion_time_s)',
                      time: keyframes.completion_time_s ?? keyframes.impact,
                    },
                    {
                      label: '動作結束 (end_time_s)',
                      time: keyframes.end_time_s ?? keyframes.recovery,
                    },
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
                        {kf.label} {kf.time.toFixed(2)}s
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 乾淨的播放與慢動作控制列（影片過期時隱藏） */}
            {!isVideoExpired && (
            <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={isPlaying ? '暫停影片' : '播放影片'}
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
                  aria-label="上一幀"
                  onClick={() => handleStepFrame(-1)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-300 transition"
                  title={`上一幀 (-${frameStepSeconds.toFixed(3)}s @ ${effectiveFps}fps, ←)`}
                >
                  <StepBack className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="下一幀"
                  onClick={() => handleStepFrame(1)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-300 transition"
                  title={`下一幀 (+${frameStepSeconds.toFixed(3)}s @ ${effectiveFps}fps, →)`}
                >
                  <StepForward className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="重頭開始播放"
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
            )}
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
            focusFeatures={actionMeta.focusFeatures}
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

