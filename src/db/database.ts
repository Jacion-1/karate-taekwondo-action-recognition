import Dexie, { type EntityTable, type Transaction } from 'dexie';
import type { LocalVideoRecord, ActionAnalysisResponse } from '../types/martial-arts.types';

/**
 * Dexie v1 -> v2 資料遷移邏輯：
 * - 若舊紀錄已有 analysisId，代表已完成辨識，將舊 actionType 搬移至 recognizedActionType
 * - 若舊紀錄尚無 analysisId，代表為拍攝時鎖定的動作，將舊 actionType 搬移至 requestedActionType
 * - 移除舊有混淆的 actionType 欄位
 */
export async function upgradeVideosV1ToV2(tx: Transaction): Promise<void> {
  await tx
    .table('videos')
    .toCollection()
    .modify((record: Record<string, unknown>) => {
      if ('actionType' in record && record.actionType !== undefined) {
        if (record.analysisId) {
          record.recognizedActionType = record.actionType;
        } else {
          record.requestedActionType = record.actionType;
        }
      }
      delete record.actionType;
    });
}

/**
 * 本機 IndexedDB 資料庫封裝 (Dexie.js)
 * 遵循規範 3：視訊錄製完成後的二進位物件直接寫入 IndexedDB，不暫存於全域反應式狀態中
 */
export class MartialArtsDatabase extends Dexie {
  videos!: EntityTable<LocalVideoRecord, 'id'>;
  analyses!: EntityTable<ActionAnalysisResponse, 'analysisId'>;

  constructor(dbName = 'MartialArtsEvaluatorDB') {
    super(dbName);

    this.version(1).stores({
      videos: 'id, createdAt, status, actionType, analysisId',
      analyses: 'analysisId, videoId, actionType, grade',
    });

    this.version(2)
      .stores({
        videos:
          'id, createdAt, status, requestedActionType, recognizedActionType, analysisId',
        analyses: 'analysisId, videoId, actionType, grade',
      })
      .upgrade(upgradeVideosV1ToV2);
  }
}

export const db = new MartialArtsDatabase();
