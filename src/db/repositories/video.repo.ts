import { db } from '../database';
import type {
  LocalVideoRecord,
  UploadStatus,
  ActionAnalysisResponse,
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
   */
  async saveRecordedVideo(record: LocalVideoRecord): Promise<string> {
    await db.videos.put(record);
    return record.id;
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
};
