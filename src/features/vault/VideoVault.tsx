import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Trash2,
  Play,
  ArrowUpRight,
  Loader2,
  Sparkles,
  RotateCcw,
  FileVideo,
} from 'lucide-react';
import { db } from '../../db/database';
import { videoRepository } from '../../db/repositories/video.repo';
import { sessionService } from '../../services/session.service';
import { MemberHistorySection } from './components/MemberHistorySection';
import { mockAnalysisService } from '../../services/mockAnalysis.service';
import { analysisClientFactory } from '../../services/analysisClient.factory';
import {
  ACTION_METADATA,
  type ActionType,
  type LocalVideoRecord,
  type NetworkStatus,
  type UploadStatus,
  type UserSession,
} from '../../types/martial-arts.types';
import { useObjectUrl } from '../../shared/hooks/useObjectUrl';
import { useToast } from '../../shared/components/ToastContainer';

interface VideoVaultProps {
  networkStatus?: NetworkStatus;
  canAnalyze?: boolean;
  onOpenAnalysis: (videoId: string, analysisId: string) => void;
}

const STATUS_DOT: Record<
  UploadStatus,
  { label: string; dotClass: string }
> = {
  local_saved: {
    label: '待分析',
    dotClass: 'bg-zinc-400',
  },
  uploading: {
    label: '上傳中',
    dotClass: 'bg-sky-400 animate-pulse',
  },
  processing: {
    label: '辨識中',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  completed: {
    label: '已完成',
    dotClass: 'bg-emerald-400',
  },
  failed: {
    label: '失敗',
    dotClass: 'bg-rose-400',
  },
};

const SOURCE_LABEL = {
  camera: '實機拍攝',
  file_import: '檔案匯入',
  synthetic_demo: '範例模擬',
};

const VideoVaultItemCard: React.FC<{
  record: LocalVideoRecord;
  analysisSource?: 'mock' | 'backend';
  canAnalyze: boolean;
  onUploadAndAnalyze: (record: LocalVideoRecord) => void;
  onDelete: (id: string) => void;
  onOpenAnalysis: (videoId: string, analysisId: string) => void;
}> = ({
  record,
  analysisSource,
  canAnalyze,
  onUploadAndAnalyze,
  onDelete,
  onOpenAnalysis,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const previewUrl = useObjectUrl(showPreview ? record.blob : null);

  const recognizedMeta = record.recognizedActionType
    ? ACTION_METADATA[record.recognizedActionType]
    : null;
  const requestedMeta = record.requestedActionType
    ? ACTION_METADATA[record.requestedActionType]
    : null;
  const statusInfo = STATUS_DOT[record.status];
  const isVideoExpired =
    !record.blob || record.retentionStatus === 'expired_purged';
  const sizeMB = isVideoExpired
    ? '已清理 (0.00 MB)'
    : `${((record.blob?.size ?? 0) / (1024 * 1024)).toFixed(2)} MB`;
  const isBusy = record.status === 'uploading' || record.status === 'processing';
  const sourceText =
    SOURCE_LABEL[record.sourceType ?? 'camera'] ?? SOURCE_LABEL.camera;

  return (
    <div className="lab-card-interactive p-4 flex flex-col justify-between gap-4">
      <div>
        {/* 縮圖與預覽容器 */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#0c0c0f] border border-white/[0.05] mb-3.5 group">
          {isVideoExpired ? (
            <div className="relative w-full h-full">
              {record.thumbnailDataUrl ? (
                <img
                  src={record.thumbnailDataUrl}
                  alt={recognizedMeta ? recognizedMeta.label : '視訊已過期清理'}
                  className="w-full h-full object-cover opacity-40 grayscale"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                  <FileVideo className="w-8 h-8 text-zinc-700" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-2 text-center">
                <span className="px-2.5 py-1 rounded-full bg-zinc-900/90 border border-white/10 text-[11px] font-mono text-zinc-300">
                  視訊已過期清理 · 數據仍保留
                </span>
              </div>
            </div>
          ) : showPreview && previewUrl ? (
            <video
              src={previewUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : record.thumbnailDataUrl ? (
            <>
              <img
                src={record.thumbnailDataUrl}
                alt={recognizedMeta ? recognizedMeta.label : '待識別動作影片'}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
              >
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-950/90 border border-white/15 text-xs font-medium text-white">
                  <Play className="w-3 h-3 fill-white" />
                  預覽影片
                </span>
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-2">
              <FileVideo className="w-6 h-6 text-zinc-600" />
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="text-xs text-zinc-300 hover:text-white underline"
              >
                預覽本地影片
              </button>
            </div>
          )}

          {/* 右下角極簡時長標籤 */}
          <div className="pointer-events-none absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-zinc-950/80 font-mono text-[11px] text-zinc-300 tabular-nums">
            {record.duration}s
          </div>
        </div>

        {/* 標題與狀態圓點 */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            {recognizedMeta ? (
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white">
                  {recognizedMeta.label}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${recognizedMeta.martialArt === '空手道' ? 'badge-karate' : 'badge-taekwondo'}`}>
                  {recognizedMeta.martialArt}
                </span>
                {analysisSource && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      analysisSource === 'mock'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                    }`}
                  >
                    {analysisSource === 'mock' ? '模擬資料' : '實機後端'}
                  </span>
                )}
                {requestedMeta && (
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono text-zinc-400">
                    鎖定：{requestedMeta.shortLabel}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-zinc-200">
                  待系統識別動作
                </h3>
                <span className="text-[11px] text-zinc-500">
                  {requestedMeta
                    ? `已鎖定專項：${requestedMeta.label}`
                    : '分析時自動比對資料庫'}
                </span>
              </div>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
            {statusInfo.label}
          </span>
        </div>

        {/* 精簡檔案資訊 */}
        <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-2 flex-wrap">
          <span>{sourceText}</span>
          <span>·</span>
          <span>{sizeMB}</span>
          <span>·</span>
          <span>
            {new Date(record.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isVideoExpired && (
            <>
              <span>·</span>
              <span className="text-zinc-400">視訊保存期限已過（數據仍保留）</span>
            </>
          )}
        </div>

        {record.status === 'failed' && record.errorMessage && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/20 text-xs text-rose-300">
            {record.errorMessage}
          </div>
        )}

        {/* 上傳與分析進度條 */}
        {isBusy && (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                {record.status === 'uploading'
                  ? '上傳影片中...'
                  : '資料庫動作比對與角度評估中...'}
              </span>
              <span className="font-mono tabular-nums">
                {record.uploadProgress ?? 0}%
              </span>
            </div>
            <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${record.uploadProgress ?? 15}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 底部操作列 */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.05]">
        {isVideoExpired ? (
          <span className="text-xs text-zinc-600 font-mono">視訊已過期清理</span>
        ) : (
          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className="text-xs text-zinc-400 hover:text-white transition"
          >
            {showPreview ? '關閉預覽' : '播放原片'}
          </button>
        )}

        <div className="flex items-center gap-2">
          {record.status === 'completed' && record.analysisId ? (
            <button
              type="button"
              onClick={() => onOpenAnalysis(record.id, record.analysisId!)}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition"
            >
              <span>查看報告</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isBusy || !canAnalyze}
              onClick={() => onUploadAndAnalyze(record)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-medium text-xs transition"
            >
              {record.status === 'failed' ? (
                <>
                  <RotateCcw className="w-3 h-3" />
                  重試
                </>
              ) : !canAnalyze ? (
                '後端未連線'
              ) : (
                '識別並評估'
              )}
            </button>
          )}

          <button
            type="button"
            disabled={isBusy}
            onClick={() => onDelete(record.id)}
            className="p-1.5 rounded-full text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/60 transition disabled:opacity-40"
            title="刪除紀錄"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const VideoVault: React.FC<VideoVaultProps> = ({
  canAnalyze = true,
  onOpenAnalysis,
}) => {
  const { pushToast } = useToast();
  const [userSession, setUserSession] = useState<UserSession>(() =>
    sessionService.getSession()
  );

  useEffect(() => {
    return sessionService.subscribe(setUserSession);
  }, []);

  const historyRecords = useLiveQuery(
    () =>
      videoRepository.getMemberHistoryRecords(
        userSession.authStatus === 'member' ? userSession.userId : undefined
      ),
    [userSession.authStatus, userSession.userId]
  );

  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [actionFilter, setActionFilter] = useState<
    ActionType | 'UNIDENTIFIED' | 'ALL'
  >('ALL');
  const [statusFilter, setStatusFilter] = useState<UploadStatus | 'ALL'>('ALL');
  const [storageEstimate, setStorageEstimate] = useState<{
    usageBytes: number;
    quotaBytes?: number;
  } | null>(null);

  const videos = useLiveQuery(
    () => db.videos.orderBy('createdAt').reverse().toArray(),
    []
  );

  const analyses = useLiveQuery(() => db.analyses.toArray(), []);

  const analysisSourceById = useMemo(() => {
    const map = new Map<string, 'mock' | 'backend'>();
    if (analyses) {
      for (const a of analyses) {
        map.set(a.analysisId, a.source);
      }
    }
    return map;
  }, [analyses]);

  useEffect(() => {
    let active = true;
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.estimate === 'function'
    ) {
      navigator.storage
        .estimate()
        .then((est) => {
          if (active && typeof est.usage === 'number') {
            setStorageEstimate({
              usageBytes: est.usage,
              quotaBytes: est.quota,
            });
          }
        })
        .catch(() => {
          // 忽略不支援環境
        });
    }
    return () => {
      active = false;
    };
  }, [videos]);

  const filteredVideos = useMemo(() => {
    if (!videos) return [];
    return videos.filter((v) => {
      if (actionFilter === 'UNIDENTIFIED' && v.recognizedActionType !== undefined) {
        return false;
      }
      if (
        actionFilter !== 'ALL' &&
        actionFilter !== 'UNIDENTIFIED' &&
        v.recognizedActionType !== actionFilter
      ) {
        return false;
      }
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
      return true;
    });
  }, [videos, actionFilter, statusFilter]);

  const handleUploadAndAnalyze = async (record: LocalVideoRecord) => {
    const client = analysisClientFactory.getClient();
    if (client.mode === 'http') {
      const health = await client.checkHealth();
      if (!health.ok) {
        pushToast({
          type: 'error',
          title: '後端服務無法連線',
          message: health.message,
        });
        return;
      }
    }
    try {
      const result = await client.uploadAndAnalyzeVideo(record);
      const recognizedLabel = ACTION_METADATA[result.actionType].label;
      const confText =
        result.confidence !== undefined ? `信心度 ${result.confidence}% · ` : '';
      pushToast({
        type: 'success',
        title: `識別為「${recognizedLabel}」（${confText}評分 ${result.totalScore}）`,
      });
      onOpenAnalysis(record.id, result.analysisId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '分析失敗';
      pushToast({
        type: 'error',
        title: '動作識別與評估失敗',
        message: msg,
      });
    }
  };

  const handleBatchUploadAllPending = async () => {
    if (!videos || isBatchAnalyzing || !canAnalyze) return;
    const pending = videos.filter(
      (v) => v.status === 'local_saved' || v.status === 'failed'
    );
    if (pending.length === 0) return;

    const client = analysisClientFactory.getClient();
    if (client.mode === 'http') {
      const health = await client.checkHealth();
      if (!health.ok) {
        pushToast({
          type: 'error',
          title: '批次識別無法啟動',
          message: health.message,
        });
        return;
      }
    }

    setIsBatchAnalyzing(true);
    setBatchProgress({ current: 0, total: pending.length });
    const errors: string[] = [];
    let completedCount = 0;

    try {
      for (let i = 0; i < pending.length; i++) {
        const item = pending[i];
        setBatchProgress({ current: i + 1, total: pending.length });
        try {
          await client.uploadAndAnalyzeVideo(item);
          completedCount++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : '未知錯誤';
          errors.push(`${item.fileName || item.id}: ${msg}`);
        }
      }

      if (errors.length === 0) {
        pushToast({
          type: 'success',
          title: `批次識別完成（共 ${completedCount}/${pending.length} 筆成功）`,
        });
      } else {
        pushToast({
          type: 'error',
          title: `批次識別完成：成功 ${completedCount} 筆，失敗 ${errors.length} 筆`,
          message: errors.slice(0, 2).join('；'),
        });
      }
    } finally {
      setIsBatchAnalyzing(false);
      setBatchProgress(null);
    }
  };

  const handleQuickCreateAndAnalyze = async () => {
    if (isCreatingDemo) return;
    setIsCreatingDemo(true);
    try {
      const id = await mockAnalysisService.createSyntheticDemoVideo();
      const saved = await videoRepository.getVideoById(id);
      if (saved && canAnalyze) {
        const analysis = await analysisClientFactory
          .getClient()
          .uploadAndAnalyzeVideo(saved);
        onOpenAnalysis(saved.id, analysis.analysisId);
      }
    } catch (err) {
      pushToast({
        type: 'error',
        title: '快速產生與分析失敗',
        message: err instanceof Error ? err.message : '未知錯誤',
      });
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const pendingCount =
    videos?.filter((v) => v.status === 'local_saved' || v.status === 'failed')
      .length ?? 0;

  return (
    <div className="space-y-8">
      {/* 會員歷史紀錄與長期走勢圖（或訪客引導提示） */}
      <MemberHistorySection
        userSession={userSession}
        historyRecords={historyRecords ?? []}
        onOpenAnalysis={onOpenAnalysis}
        onLoginAsMember={() => sessionService.loginAsMember()}
      />

      {/* 極簡標題與操作列 */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-white leading-snug">
              動作影片庫
            </h2>
            {storageEstimate && (
              <span
                className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-white/[0.07] text-[11px] font-mono text-zinc-400"
                title="瀏覽器 IndexedDB 本機儲存空間用量 (navigator.storage.estimate)"
              >
                本機儲存：{(storageEstimate.usageBytes / (1024 * 1024)).toFixed(1)} MB
                {storageEstimate.quotaBytes && storageEstimate.quotaBytes > 0
                  ? ` / ${(storageEstimate.quotaBytes / (1024 * 1024 * 1024)).toFixed(1)} GB (${Math.min(
                      100,
                      (storageEstimate.usageBytes / storageEstimate.quotaBytes) * 100
                    ).toFixed(2)}%)`
                  : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            管理待識別與已完成分析的影片，由系統比對空手道／跆拳道資料庫自動識別動作並評分
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {pendingCount > 0 && (
            <button
              type="button"
              disabled={!canAnalyze || isBatchAnalyzing}
              onClick={handleBatchUploadAllPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-medium text-xs transition"
            >
              {isBatchAnalyzing && batchProgress ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    批次識別中 ({batchProgress.current}/{batchProgress.total})
                  </span>
                </>
              ) : (
                <span>批次識別與評估 ({pendingCount})</span>
              )}
            </button>
          )}

          <button
            type="button"
            disabled={isCreatingDemo || isBatchAnalyzing}
            onClick={handleQuickCreateAndAnalyze}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 font-medium text-xs transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            {isCreatingDemo ? '產生並識別動作中...' : '快速產生範例並查看報告'}
          </button>
        </div>
      </div>

      {/* 輕量篩選列 */}
      {videos && videos.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                'ALL',
                'UNIDENTIFIED',
                ...(Object.keys(ACTION_METADATA) as ActionType[]),
              ] as const
            ).map((act) => (
              <button
                key={act}
                type="button"
                onClick={() => setActionFilter(act)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
                  actionFilter === act
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {act === 'ALL'
                  ? '全部影片'
                  : act === 'UNIDENTIFIED'
                    ? '待識別動作'
                    : ACTION_METADATA[act].shortLabel}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {(['ALL', 'local_saved', 'completed', 'failed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full text-xs transition ${
                  statusFilter === st
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {st === 'ALL'
                  ? '全部狀態'
                  : st === 'local_saved'
                    ? '待分析'
                    : st === 'completed'
                      ? '已完成'
                      : '失敗'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 影片卡片網格 */}
      {!videos || videos.length === 0 ? (
        <div className="lab-card p-16 text-center space-y-3">
          <h3 className="text-sm font-medium text-zinc-200">
            尚無儲存的動作影片
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            前往「拍攝與輸入」錄製或匯入影片，或點擊右上角「快速產生範例並查看報告」。
          </p>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="lab-card p-12 text-center text-xs text-zinc-500">
          沒有符合篩選條件的影片紀錄。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((record) => (
            <VideoVaultItemCard
              key={record.id}
              record={record}
              analysisSource={
                record.analysisId
                  ? analysisSourceById.get(record.analysisId)
                  : undefined
              }
              canAnalyze={canAnalyze}
              onUploadAndAnalyze={handleUploadAndAnalyze}
              onDelete={async (id) => {
                await videoRepository.deleteVideo(id);
                pushToast({
                  type: 'info',
                  title: '已刪除影片紀錄',
                });
              }}
              onOpenAnalysis={onOpenAnalysis}
            />
          ))}
        </div>
      )}
    </div>
  );
};
