import Dexie, { type EntityTable } from 'dexie';
import type { LocalVideoRecord, ActionAnalysisResponse } from '../types/martial-arts.types';

/**
 * 本機 IndexedDB 資料庫封裝 (Dexie.js)
 * 遵循規範 3：視訊錄製完成後的二進位物件直接寫入 IndexedDB，不暫存於全域反應式狀態中
 */
export class MartialArtsDatabase extends Dexie {
  videos!: EntityTable<LocalVideoRecord, 'id'>;
  analyses!: EntityTable<ActionAnalysisResponse, 'analysisId'>;

  constructor() {
    super('MartialArtsEvaluatorDB');

    this.version(1).stores({
      // 只對需要查詢與排序的輕量欄位建立索引，blob 不建立索引以維持極致寫入效能
      videos: 'id, createdAt, status, actionType, analysisId',
      analyses: 'analysisId, videoId, actionType, grade',
    });
  }
}

export const db = new MartialArtsDatabase();
