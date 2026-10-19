import React, { useEffect, useRef, useState } from 'react';
import {
  Video,
  Square,
  FlipHorizontal,
  Maximize2,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Timer,
  Upload,
  Info,
  Loader2,
} from 'lucide-react';
import {
  ACTION_METADATA,
  JOINT_LABELS,
  type ActionType,
  type LocalVideoRecord,
} from '../../types/martial-arts.types';
import { useMediaStream } from './hooks/useMediaStream';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { CameraPreview } from './components/CameraPreview';
import { RecordingTimer } from './components/RecordingTimer';
import { mockAnalysisService } from '../../services/mockAnalysis.service';
import { analysisClientFactory } from '../../services/analysisClient.factory';
import { videoRepository } from '../../db/repositories/video.repo';
import { extractVideoMetadataAndThumbnail } from '../../shared/utils/videoMedia.utils';
import { useToast } from '../../shared/components/ToastContainer';

export const MAX_IMPORT_SIZE_MB = 200;
export const MAX_IMPORT_SIZE_BYTES = MAX_IMPORT_SIZE_MB * 1024 * 1024;
export const MAX_IMPORT_DURATION_SEC = 60;

interface RecordWorkspaceProps {
  onNavigateToVault: () => void;
  onOpenAnalysis: (videoId: string, analysisId: string) => void;
  initialFocusAction?: ActionType | 'auto';
}

/**
 * 動作拍攝與影像輸入工作台 (Sensei AI + Uplift Labs + Modern Minimalism)
 * - 左側 (8 cols)：Uplift Labs 大取景區 + 單一整合式控制列 + 閉環一鍵「立即識別並查看報告」
 * - 右側 (4 cols)：Sensei AI / JAB AI 識別模式（預設：AI 自動比對識別）與資料庫標準動作圖譜卡片 + 收合式架構說明
 */
export const RecordWorkspace: React.FC<RecordWorkspaceProps> = ({
  onNavigateToVault,
  onOpenAnalysis,
  initialFocusAction = 'auto',
}) => {
  const { pushToast } = useToast();
  const [recognitionMode, setRecognitionMode] = useState<ActionType | 'auto'>(
    initialFocusAction
  );
  const [disciplineFilter, setDisciplineFilter] = useState<
    'all' | 'karate' | 'taekwondo'
  >('all');
  const [showGuideGrid, setShowGuideGrid] = useState<boolean>(true);
  const [useCountdown, setUseCountdown] = useState<boolean>(true);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState<boolean>(false);
  const [isAnalyzingInstant, setIsAnalyzingInstant] = useState<boolean>(false);
  const [isImportingFile, setIsImportingFile] = useState<boolean>(false);
  const [recentSavedId, setRecentSavedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    setRecognitionMode(initialFocusAction);
  }, [initialFocusAction]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, []);

  const {
    stream,
    telemetry,
    error,
    startCamera,
    stopCamera,
    toggleFacingMode,
  } = useMediaStream();

  const { isRecording, startRecording, stopRecording } = useMediaRecorder(
    (savedId) => {
      if (!mountedRef.current) return;
      setRecentSavedId(savedId);
      pushToast({
        type: 'success',
        title: '拍攝完成並已存入影片庫',
        message: '可點擊下方「立即識別並查看報告」直接進入分析',
      });
    }
  );

  const handleToggleRecord = () => {
    if (!stream || countdownSeconds !== null) return;
    if (isRecording) {
      stopRecording();
      return;
    }

    const requested = recognitionMode === 'auto' ? undefined : recognitionMode;
    setRecentSavedId(null);
    if (!useCountdown) {
      startRecording(stream, requested);
      return;
    }

    let remaining = 3;
    setCountdownSeconds(remaining);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    countdownTimerRef.current = setInterval(() => {
      if (!mountedRef.current) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdownSeconds(null);
        startRecording(stream, requested);
      } else {
        setCountdownSeconds(remaining);
      }
    }, 1000);
  };

  const handleGenerateSyntheticVideo = async () => {
    if (isGeneratingDemo || isAnalyzingInstant || isRecording) return;
    setIsGeneratingDemo(true);
    setRecentSavedId(null);
    try {
      const preferred = recognitionMode === 'auto' ? undefined : recognitionMode;
      const id = await mockAnalysisService.createSyntheticDemoVideo(preferred);
      if (!mountedRef.current) return;
      setRecentSavedId(id);
      pushToast({
        type: 'success',
        title:
          recognitionMode === 'auto'
            ? '已產生待識別動作範例影片'
            : `已產生「${ACTION_METADATA[recognitionMode].label}」專項範例影片`,
        message: '可立即執行資料庫比對與動作評估',
      });
    } finally {
      if (mountedRef.current) {
        setIsGeneratingDemo(false);
      }
    }
  };

  const handleInstantAnalyzeRecent = async () => {
    if (!recentSavedId || isAnalyzingInstant) return;
    setIsAnalyzingInstant(true);
    try {
      const record = await videoRepository.getVideoById(recentSavedId);
      if (!record) return;
      const targetRecord: LocalVideoRecord =
        recognitionMode !== 'auto'
          ? { ...record, requestedActionType: recognitionMode }
          : record;
      const result = await analysisClientFactory
        .getClient()
        .uploadAndAnalyzeVideo(targetRecord);
      if (!mountedRef.current) return;
      const label = ACTION_METADATA[result.actionType].label;
      const confText =
        result.confidence !== undefined ? `信心度 ${result.confidence}% · ` : '';
      pushToast({
        type: 'success',
        title: `識別為「${label}」（${confText}評分 ${result.totalScore}）`,
      });
      onOpenAnalysis(record.id, result.analysisId);
    } catch (err) {
      if (!mountedRef.current) return;
      pushToast({
        type: 'error',
        title: '識別分析失敗',
        message: err instanceof Error ? err.message : '未知錯誤',
      });
    } finally {
      if (mountedRef.current) {
        setIsAnalyzingInstant(false);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('video/')) {
      pushToast({
        type: 'error',
        title: '請選擇 .mp4 或 .webm 視訊檔案',
      });
      return;
    }

    if (file.size > MAX_IMPORT_SIZE_BYTES) {
      const actualSizeMb = (file.size / (1024 * 1024)).toFixed(1);
      pushToast({
        type: 'error',
        title: `檔案大小超過上限（上限 ${MAX_IMPORT_SIZE_MB} MB）`,
        message: `您選擇的檔案為 ${actualSizeMb} MB，請剪輯或壓縮後再匯入。`,
      });
      return;
    }

    setIsImportingFile(true);
    setRecentSavedId(null);
    try {
      const { duration, thumbnailDataUrl } =
        await extractVideoMetadataAndThumbnail(file, 3.5);
      if (!mountedRef.current) return;

      if (duration > MAX_IMPORT_DURATION_SEC) {
        pushToast({
          type: 'error',
          title: `影片長度超過上限（上限 ${MAX_IMPORT_DURATION_SEC} 秒）`,
          message: `此影片長度為 ${duration} 秒，請裁切為 ${MAX_IMPORT_DURATION_SEC} 秒以內的單一動作或回合片段。`,
        });
        return;
      }

      const id = `vid-import-${Date.now()}`;
      const record: LocalVideoRecord = {
        id,
        blob: file,
        mimeType: file.type || 'video/mp4',
        duration,
        createdAt: Date.now(),
        status: 'local_saved',
        requestedActionType: recognitionMode === 'auto' ? undefined : recognitionMode,
        recognizedActionType: undefined,
        thumbnailDataUrl,
        sourceType: 'file_import',
        fileName: file.name,
      };
      await videoRepository.saveRecordedVideo(record);
      if (!mountedRef.current) return;
      setRecentSavedId(id);
      pushToast({
        type: 'success',
        title: '影片已匯入影片庫',
        message: `${file.name} (${duration}s) — 可立即執行識別分析`,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      pushToast({
        type: 'error',
        title: '影片匯入失敗',
        message: err instanceof Error ? err.message : '未知錯誤',
      });
    } finally {
      if (mountedRef.current) {
        setIsImportingFile(false);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 左側 (8 cols)：Uplift Labs 極簡大影像區 + 底部整合控制列 */}
      <div className="lg:col-span-8 space-y-4">
        <div className="relative">
          {/* 取景窗頂部極簡浮動列 */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
            <RecordingTimer isRecording={isRecording} />

            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                aria-label="切換倒數 3 秒開拍"
                onClick={() => setUseCountdown((prev) => !prev)}
                disabled={isRecording}
                className={`px-3 py-1 rounded-full border text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition ${
                  useCountdown
                    ? 'bg-white/15 border-white/25 text-white'
                    : 'bg-zinc-950/75 border-white/[0.08] text-zinc-400'
                }`}
                title="倒數 3 秒開拍"
              >
                <Timer className="w-3.5 h-3.5" />
                <span>3s 倒數</span>
              </button>

              <button
                type="button"
                aria-label="切換取景參考線"
                onClick={() => setShowGuideGrid((prev) => !prev)}
                className={`p-1.5 rounded-full border text-xs flex items-center backdrop-blur-md transition ${
                  showGuideGrid
                    ? 'bg-white/15 border-white/25 text-white'
                    : 'bg-zinc-950/75 border-white/[0.08] text-zinc-400'
                }`}
                title="切換取景參考線"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {stream && (
                <button
                  type="button"
                  aria-label="切換前後鏡頭"
                  onClick={toggleFacingMode}
                  disabled={isRecording}
                  className="p-1.5 rounded-full bg-zinc-950/75 hover:bg-zinc-900 border border-white/[0.08] text-zinc-300 backdrop-blur-md disabled:opacity-40 transition"
                  title="切換前後鏡頭"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <CameraPreview
            stream={stream}
            telemetry={telemetry}
            error={error}
            showGuideGrid={showGuideGrid}
            countdownSeconds={countdownSeconds}
            onStartCamera={() => startCamera()}
          />
        </div>

        {/* 底部單一整合式控制列 */}
        <div className="lab-card px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {stream ? (
              <>
                <button
                  type="button"
                  aria-label={isRecording ? '停止錄影' : '開始錄影'}
                  onClick={handleToggleRecord}
                  disabled={countdownSeconds !== null}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-xs transition ${
                    isRecording
                      ? 'bg-rose-500 hover:bg-rose-600 text-white'
                      : 'bg-white hover:bg-zinc-200 text-zinc-950'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      停止錄影
                    </>
                  ) : (
                    <>
                      <Video className="w-3.5 h-3.5" />
                      {useCountdown ? '開始錄影 (3s 倒數)' : '開始錄影'}
                    </>
                  )}
                </button>
                {!isRecording && (
                  <button
                    type="button"
                    aria-label="關閉鏡頭"
                    onClick={stopCamera}
                    className="px-3.5 py-2 rounded-full text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition"
                  >
                    關閉鏡頭
                  </button>
                )}
              </>
            ) : (
              <span className="text-xs text-zinc-400">
                單鏡頭即可完成空手道／跆拳道動作識別與關節角度分析
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImportingFile || isRecording || isAnalyzingInstant}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/80 hover:bg-zinc-800 border border-white/[0.06] text-zinc-200 text-xs font-medium transition disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              {isImportingFile ? '匯入中...' : '匯入本地影片'}
            </button>

            <button
              type="button"
              onClick={handleGenerateSyntheticVideo}
              disabled={isGeneratingDemo || isRecording || isAnalyzingInstant}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/80 hover:bg-zinc-800 border border-white/[0.06] text-zinc-200 text-xs font-medium transition disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
              {isGeneratingDemo ? '產生中...' : '產生範例影片'}
            </button>
          </div>
        </div>

        {/* Phase 7.7: 隱私與安全同意說明 */}
        <p className="px-2 text-[11px] text-zinc-500">
          影片含人體影像，將在你按下分析後才會上傳到所設定的後端。
        </p>

        {/* Phase 6.4: 依動作顯示建議拍攝視角提示文字，並註明單鏡頭 2D 透視變形限制 */}
        <div className="px-4 py-3 rounded-2xl bg-zinc-900/45 border border-white/[0.06] text-xs text-zinc-400 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-medium text-zinc-300">建議拍攝視角：</span>
            <span>
              {recognitionMode === 'auto'
                ? '踢擊類與直線出拳建議側面拍攝、格擋類建議斜側 45°–90° 拍攝，並保持全身完整入鏡。'
                : ACTION_METADATA[recognitionMode].cameraViewHint}
            </span>
          </div>
          <span className="text-[11px] font-mono text-amber-300/90 shrink-0">
            注意：單鏡頭 2D 角度會隨拍攝方向變形
          </span>
        </div>

        {/* Sensei AI 閉環教練捷徑條：拍攝/匯入後可一鍵直接識別分析 */}
        {recentSavedId && (
          <div className="px-5 py-3.5 rounded-2xl bg-zinc-900/95 border border-white/[0.12] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-zinc-200">
                動作影片已就緒，可立即比對資料庫識別動作並查看教練修正建議
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleInstantAnalyzeRecent}
                disabled={isAnalyzingInstant}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition disabled:opacity-60"
              >
                {isAnalyzingInstant ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    識別與評估中...
                  </>
                ) : (
                  <>
                    <span>立即識別並查看報告</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onNavigateToVault}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition"
              >
                <span>前往影片庫</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 右側 (4 cols)：Sensei AI / JAB AI 識別模式與標準資料庫動作圖譜 */}
      <div className="lg:col-span-4 space-y-5">
        <div className="space-y-3">
          <div className="px-1 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                識別模式與動作技術圖譜
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                預設自動比對資料庫識別動作，亦可點選圖譜檢視各動作標準角度
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* 預設首選：AI 自動比對資料庫識別 */}
            <button
              type="button"
              disabled={isRecording}
              onClick={() => setRecognitionMode('auto')}
              className={`group text-left p-4 rounded-2xl border transition-all ${
                recognitionMode === 'auto'
                  ? 'bg-zinc-900 border-white/25'
                  : 'bg-zinc-900/30 border-white/[0.05] hover:bg-zinc-900/60 hover:border-white/[0.1]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full transition ${
                      recognitionMode === 'auto'
                        ? 'bg-emerald-400'
                        : 'bg-zinc-700 group-hover:bg-zinc-500'
                    }`}
                  />
                  <span className="font-medium text-sm text-white">
                    AI 自動比對識別
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white/[0.07] text-[10px] font-mono text-zinc-300">
                  預設推薦
                </span>
              </div>
              <p className="text-xs text-zinc-400 pl-4.5 leading-relaxed">
                透過骨架時序特徵自動比對空手道與跆拳道資料庫，判定使用者動作並給予評分與建議
              </p>
            </button>

            <div className="pt-1 px-1 flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-500">
                標準動作資料庫圖譜（點擊可鎖定專項）
              </span>
              <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-full border border-white/[0.06]">
                {(
                  [
                    { key: 'all', label: '全部 8' },
                    { key: 'karate', label: '空手道 5' },
                    { key: 'taekwondo', label: '跆拳道 5' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setDisciplineFilter(tab.key)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition ${
                      disciplineFilter === tab.key
                        ? 'bg-zinc-200 text-zinc-950'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
              {(Object.keys(ACTION_METADATA) as ActionType[])
                .filter((type) => {
                  if (disciplineFilter === 'all') return true;
                  const d = ACTION_METADATA[type].discipline;
                  return d === disciplineFilter || d === 'both';
                })
                .map((type) => {
                  const meta = ACTION_METADATA[type];
                  const isSelected = recognitionMode === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={isRecording}
                      onClick={() => setRecognitionMode(type)}
                      className={`group text-left p-3.5 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-zinc-900 border-white/25'
                          : 'bg-zinc-900/30 border-white/[0.05] hover:bg-zinc-900/60 hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full transition ${
                              isSelected
                                ? 'bg-white'
                                : 'bg-zinc-700 group-hover:bg-zinc-500'
                            }`}
                          />
                          <span className="font-medium text-sm text-white">
                            {meta.label}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[140px]">
                            {meta.terminology}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 shrink-0">
                          {meta.martialArt}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 pl-3.5 leading-relaxed">
                        {meta.description}
                      </p>
                      <div className="mt-2 pl-3.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
                        <span>{meta.targetAngleHint}</span>
                        <span>
                          關鍵：{meta.primaryJoints.map((j) => JOINT_LABELS[j]).join(' · ')}
                        </span>
                      </div>
                      <div className="mt-1.5 pl-3.5 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                        <span>
                          {meta.provenance.status === 'cited' && meta.provenance.citation
                            ? `閾值來源：${meta.provenance.citation}`
                            : '初始經驗閾值，待驗證'}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* 次要位置：預設收合的系統架構說明 */}
        <details className="group rounded-2xl bg-zinc-900/30 border border-white/[0.05] px-4 py-3 text-xs text-zinc-500">
          <summary className="cursor-pointer list-none flex items-center justify-between font-medium text-zinc-400 hover:text-zinc-300 transition">
            <span className="inline-flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-zinc-500" />
              系統架構與效能防護資訊
            </span>
            <span className="text-[11px] group-open:rotate-180 transition-transform">
              ▾
            </span>
          </summary>
          <ul className="mt-3 pt-3 border-t border-white/[0.05] space-y-2 text-[11px] text-zinc-400 leading-relaxed">
            <li>• 計時狀態封裝於獨立葉子組件，錄影期間視訊畫面零重繪。</li>
            <li>• 卸載時自動執行視訊軌道與 ObjectURL 記憶體釋放。</li>
            <li>• 影片二進位資料直接寫入本機 IndexedDB，支援離線暫存。</li>
          </ul>
        </details>
      </div>
    </div>
  );
};


