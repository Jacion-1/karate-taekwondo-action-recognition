import { db } from '../database';
import {
  type LocalVideoRecord,
  type UploadStatus,
  type ActionAnalysisResponse,
  type HistoryRecordMeta,
  type VideoRetentionStatus,
  VIDEO_RETENTION_MS,
} from '../../types/martial-arts.types';

export const INTERRUPTED_ANALYSIS_MESSAGE = '上次分析被中斷，請重新送出';

/**
 * 影片與分析結果資料存取層 (Repository Pattern)
 */
export const videoRepository = {
  /**
   * 應用程式啟動時呼叫一次：將上次因重新整理或關閉分頁而殘留的 uploading / processing 影片重設為 failed
   */
  async resetInterruptedAnalyses(): Promise<number> {
    return db.transaction('rw', db.videos, async () => {
      const stuckVideos = await db.videos
        .where('status')
        .anyOf(['uploading', 'processing'])
        .toArray();

      for (const vid of stuckVideos) {
        await db.videos.update(vid.id, {
          status: 'failed',
          uploadProgress: 0,
          errorMessage: INTERRUPTED_ANALYSIS_MESSAGE,
        });
      }
      return stuckVideos.length;
    });
  },

  /**
   * 將錄製完成的二進位 Blob 直接寫入 IndexedDB
   * 若未填寫 expiresAt，預設補上 record.createdAt + VIDEO_RETENTION_MS
   * 若未填寫 retentionStatus，預設補上 'active'
   */
  async saveRecordedVideo(record: LocalVideoRecord): Promise<string> {
    const payload: LocalVideoRecord = {
      ...record,
      expiresAt: record.expiresAt ?? record.createdAt + VIDEO_RETENTION_MS,
      retentionStatus: record.retentionStatus ?? 'active',
    };
    await db.videos.put(payload);
    return payload.id;
  },

  /**
   * 更新影片上傳狀態與進度
   */
  async updateUploadStatus(
    id: string,
    status: UploadStatus,
    extra?: { uploadProgress?: number; analysisId?: string; errorMessage?: string }
  ): Promise<void> {
    await db.videos.update(id, {
      status,
      ...extra,
    });
  },

  /**
   * 取得單一影片記錄（含 Blob）
   */
  async getVideoById(id: string): Promise<LocalVideoRecord | undefined> {
    return db.videos.get(id);
  },

  /**
   * 刪除本地影片與關聯的分析報告
   */
  async deleteVideo(id: string): Promise<void> {
    const video = await db.videos.get(id);
    await db.transaction('rw', db.videos, db.analyses, async () => {
      if (video?.analysisId) {
        await db.analyses.delete(video.analysisId);
      }
      await db.videos.delete(id);
    });
  },

  /**
   * 儲存後端（或模擬層）回傳的完整分析報告，僅寫入 recognizedActionType 與 completed 狀態，不覆蓋 requestedActionType
   */
  async saveAnalysisResult(
    videoId: string,
    analysis: ActionAnalysisResponse
  ): Promise<void> {
    await db.transaction('rw', db.videos, db.analyses, async () => {
      await db.analyses.put(analysis);
      await db.videos.update(videoId, {
        status: 'completed',
        uploadProgress: 100,
        analysisId: analysis.analysisId,
        recognizedActionType: analysis.actionType,
      });
    });
  },

  /**
   * 取得分析報告
   */
  async getAnalysisById(
    analysisId: string
  ): Promise<ActionAnalysisResponse | undefined> {
    return db.analyses.get(analysisId);
  },

  /**
   * 視訊二進位 7 天過期清理排程器：
   * 掃描 db.videos，找出建立時間或過期時間已逾 7 天，且尚未清理二進位 blob 的記錄，
   * 刪除 blob 釋放磁碟空間並標記 retentionStatus = 'expired_purged'，
   * 絕對保留關聯的 db.analyses 結構化數據。
   */
  async pruneExpiredVideos(now: number = Date.now()): Promise<number> {
    return db.transaction('rw', db.videos, async () => {
      let purgedCount = 0;
      await db.videos.toCollection().modify((record) => {
        const isExpired =
          (record.expiresAt !== undefined && now > record.expiresAt) ||
          now - record.createdAt > VIDEO_RETENTION_MS;
        const needsPurge =
          record.blob !== undefined || record.retentionStatus !== 'expired_purged';

        if (isExpired && needsPurge) {
          delete record.blob;
          record.blob = undefined;
          record.retentionStatus = 'expired_purged';
          record.purgedAt = now;
          purgedCount++;
        }
      });
      return purgedCount;
    });
  },

  /**
   * 取得會員歷史分析清單（配對 db.analyses 與 db.videos）
   * 即使影片 blob 已過期被清理，依然完整保留結構化評估結果
   */
  async getMemberHistoryRecords(userId?: string): Promise<HistoryRecordMeta[]> {
    const [analyses, videos] = await Promise.all([
      db.analyses.toArray(),
      db.videos.toArray(),
    ]);

    const videoMap = new Map<string, LocalVideoRecord>();
    for (const v of videos) {
      videoMap.set(v.id, v);
      if (v.analysisId) {
        videoMap.set(`ana:${v.analysisId}`, v);
      }
    }

    const records: HistoryRecordMeta[] = [];

    for (const analysis of analyses) {
      const video =
        videoMap.get(analysis.videoId) ??
        videoMap.get(`ana:${analysis.analysisId}`);

      if (userId && video?.userId && video.userId !== userId) {
        continue;
      }

      const isPurged =
        !video || !video.blob || video.retentionStatus === 'expired_purged';
      const retentionStatus: VideoRetentionStatus = isPurged
        ? 'expired_purged'
        : 'active';

      const createdAt = video?.createdAt ?? Date.now();
      const videoExpiresAt =
        video?.expiresAt ?? createdAt + VIDEO_RETENTION_MS;

      records.push({
        analysisId: analysis.analysisId,
        videoId: analysis.videoId,
        userId: video?.userId ?? (userId ?? 'guest-session'),
        createdAt,
        actionType: analysis.actionType,
        totalScore: analysis.totalScore,
        grade: analysis.grade,
        confidence: analysis.confidence,
        duration: analysis.duration ?? video?.duration ?? 0,
        defectCount: analysis.defects.length,
        feedbackSummary: analysis.feedbackSummary,
        source: analysis.source,
        videoRetentionStatus: retentionStatus,
        videoExpiresAt,
        videoPurgedAt: video?.purgedAt,
        thumbnailDataUrl: video?.thumbnailDataUrl,
      });
    }

    records.sort((a, b) => b.createdAt - a.createdAt);
    return records;
  },
};
