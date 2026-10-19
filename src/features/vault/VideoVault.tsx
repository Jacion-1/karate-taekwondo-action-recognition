import React, { useMemo, useState } from 'react';
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
import { mockAnalysisService } from '../../services/mockAnalysis.service';
import { analysisClientFactory } from '../../services/analysisClient.factory';
import {
  ACTION_METADATA,
  type ActionType,
  type LocalVideoRecord,
  type NetworkStatus,
  type UploadStatus,
} from '../../types/martial-arts.types';
import { useObjectUrl } from '../../shared/hooks/useObjectUrl';
import { useToast } from '../../shared/components/ToastContainer';

interface VideoVaultProps {
  networkStatus: NetworkStatus;
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
  networkStatus: NetworkStatus;
  onUploadAndAnalyze: (record: LocalVideoRecord) => void;
  onDelete: (id: string) => void;
  onOpenAnalysis: (videoId: string, analysisId: string) => void;
}> = ({
  record,
  networkStatus,
  onUploadAndAnalyze,
  onDelete,
  onOpenAnalysis,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const previewUrl = useObjectUrl(showPreview ? record.blob : null);

  const meta = record.actionType ? ACTION_METADATA[record.actionType] : null;
  const statusInfo = STATUS_DOT[record.status];
  const sizeMB = (record.blob.size / (1024 * 1024)).toFixed(2);
  const isBusy = record.status === 'uploading' || record.status === 'processing';
  const sourceText =
    SOURCE_LABEL[record.sourceType ?? 'camera'] ?? SOURCE_LABEL.camera;

  return (
    <div className="lab-card-interactive p-4 flex flex-col justify-between gap-4">
      <div>
        {/* 縮圖與預覽容器 */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#0c0c0f] border border-white/[0.05] mb-3.5 group">
          {showPreview && previewUrl ? (
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
                alt={meta ? meta.label : '待識別動作影片'}
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
            {meta ? (
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
                <span className="text-xs text-zinc-500">{meta.martialArt}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-200">
                  待系統識別動作
                </h3>
                <span className="text-[11px] text-zinc-500">
                  分析時自動比對資料庫
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
        <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-2">
          <span>{sourceText}</span>
          <span>·</span>
          <span>{sizeMB} MB</span>
          <span>·</span>
          <span>
            {new Date(record.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
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
        <button
          type="button"
          onClick={() => setShowPreview((prev) => !prev)}
          className="text-xs text-zinc-400 hover:text-white transition"
        >
          {showPreview ? '關閉預覽' : '播放原片'}
        </button>

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
              disabled={isBusy || networkStatus === 'offline'}
              onClick={() => onUploadAndAnalyze(record)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-medium text-xs transition"
            >
              {record.status === 'failed' ? (
                <>
                  <RotateCcw className="w-3 h-3" />
                  重試
                </>
              ) : networkStatus === 'offline' ? (
                '離線暫存中'
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
  networkStatus,
  onOpenAnalysis,
}) => {
  const { pushToast } = useToast();
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const [actionFilter, setActionFilter] = useState<ActionType | 'UNIDENTIFIED' | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<UploadStatus | 'ALL'>('ALL');

  const videos = useLiveQuery(
    () => db.videos.orderBy('createdAt').reverse().toArray(),
    []
  );

  const filteredVideos = useMemo(() => {
    if (!videos) return [];
    return videos.filter((v) => {
      if (actionFilter === 'UNIDENTIFIED' && v.actionType !== undefined) return false;
      if (
        actionFilter !== 'ALL' &&
        actionFilter !== 'UNIDENTIFIED' &&
        v.actionType !== actionFilter
      ) {
        return false;
      }
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
      return true;
    });
  }, [videos, actionFilter, statusFilter]);

  const handleUploadAndAnalyze = async (record: LocalVideoRecord) => {
    if (networkStatus === 'offline') return;
    const client = analysisClientFactory.getClient();
    try {
      const result = await client.uploadAndAnalyzeVideo(record);
      const recognizedLabel = ACTION_METADATA[result.actionType].label;
      pushToast({
        type: 'success',
        title: `識別為「${recognizedLabel}」（信心度 ${result.confidence}% · 評分 ${result.totalScore}）`,
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
    if (!videos || networkStatus === 'offline') return;
    const pending = videos.filter(
      (v) => v.status === 'local_saved' || v.status === 'failed'
    );
    const client = analysisClientFactory.getClient();
    for (const item of pending) {
      try {
        await client.uploadAndAnalyzeVideo(item);
      } catch {
        // Error saved to record
      }
    }
  };

  const handleQuickCreateAndAnalyze = async () => {
    setIsCreatingDemo(true);
    try {
      const id = await mockAnalysisService.createSyntheticDemoVideo();
      const saved = await videoRepository.getVideoById(id);
      if (saved && networkStatus === 'online') {
        const analysis = await analysisClientFactory
          .getClient()
          .uploadAndAnalyzeVideo(saved);
        onOpenAnalysis(saved.id, analysis.analysisId);
      }
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const pendingCount =
    videos?.filter((v) => v.status === 'local_saved' || v.status === 'failed')
      .length ?? 0;

  return (
    <div className="space-y-8">
      {/* 極簡標題與操作列 */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            動作影片庫
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            管理待識別與已完成分析的影片，由系統比對空手道／跆拳道資料庫自動識別動作並評分
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {pendingCount > 0 && (
            <button
              type="button"
              disabled={networkStatus === 'offline'}
              onClick={handleBatchUploadAllPending}
              className="px-4 py-2 rounded-full bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-medium text-xs transition"
            >
              批次識別與評估 ({pendingCount})
            </button>
          )}

          <button
            type="button"
            disabled={isCreatingDemo}
            onClick={handleQuickCreateAndAnalyze}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 font-medium text-xs transition"
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
              networkStatus={networkStatus}
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
