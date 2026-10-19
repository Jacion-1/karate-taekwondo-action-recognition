import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { MartialArtsDatabase, db } from '../database';
import { videoRepository } from '../repositories/video.repo';
import type { ActionAnalysisResponse, LocalVideoRecord } from '../../types/martial-arts.types';

describe('video.repo & Dexie v1 -> v2 migration', () => {
  beforeEach(async () => {
    await db.videos.clear();
    await db.analyses.clear();
  });

  it('migrates v1 actionType into recognizedActionType when analysisId exists, and into requestedActionType when analysisId does not exist', async () => {
    const dbName = `MigrationTestDB-${Date.now()}`;

    // 1. 建立 v1 舊版資料庫並寫入兩筆舊格式紀錄
    const v1Db = new Dexie(dbName);
    v1Db.version(1).stores({
      videos: 'id, createdAt, status, actionType, analysisId',
      analyses: 'analysisId, videoId, actionType, grade',
    });
    await v1Db.open();

    await v1Db.table('videos').bulkPut([
      {
        id: 'legacy-analyzed',
        blob: new Blob(['a'], { type: 'video/webm' }),
        mimeType: 'video/webm',
        duration: 3.0,
        createdAt: 1000,
        status: 'completed',
        actionType: 'roundhouse_kick',
        analysisId: 'ana-legacy-1',
      },
      {
        id: 'legacy-unmated',
        blob: new Blob(['b'], { type: 'video/webm' }),
        mimeType: 'video/webm',
        duration: 2.5,
        createdAt: 2000,
        status: 'local_saved',
        actionType: 'straight_punch',
      },
    ]);
    v1Db.close();

    // 2. 以新版 MartialArtsDatabase (v2) 開啟同一個資料庫，觸發 upgrade
    const upgradedDb = new MartialArtsDatabase(dbName);
    await upgradedDb.open();

    const analyzedRecord = (await upgradedDb.videos.get('legacy-analyzed')) as
      | (LocalVideoRecord & { actionType?: unknown })
      | undefined;
    const pendingRecord = (await upgradedDb.videos.get('legacy-unmated')) as
      | (LocalVideoRecord & { actionType?: unknown })
      | undefined;

    expect(analyzedRecord?.recognizedActionType).toBe('roundhouse_kick');
    expect(analyzedRecord?.requestedActionType).toBeUndefined();
    expect(analyzedRecord?.actionType).toBeUndefined();

    expect(pendingRecord?.requestedActionType).toBe('straight_punch');
    expect(pendingRecord?.recognizedActionType).toBeUndefined();
    expect(pendingRecord?.actionType).toBeUndefined();

    await upgradedDb.delete();
  });

  it('saveAnalysisResult writes only recognizedActionType and never overwrites requestedActionType (auto remains auto on re-analysis)', async () => {
    const record: LocalVideoRecord = {
      id: 'vid-auto-1',
      blob: new Blob(['test'], { type: 'video/webm' }),
      mimeType: 'video/webm',
      duration: 3.2,
      createdAt: Date.now(),
      status: 'local_saved',
      requestedActionType: undefined,
      recognizedActionType: undefined,
    };

    await videoRepository.saveRecordedVideo(record);

    const mockResult: ActionAnalysisResponse = {
      analysisId: 'ana-auto-1',
      videoId: 'vid-auto-1',
      source: 'mock',
      actionType: 'axe_kick',
      totalScore: 86,
      grade: 'A',
      defects: [],
      angleTimeSeries: {
        jointName: 'right_knee',
        points: [
          {
            time: 0.5,
            actualAngle: 168,
            standardMin: 165,
            standardMax: 179,
            standardBand: [165, 179],
          },
        ],
      },
      allJointSeries: [],
    };

    await videoRepository.saveAnalysisResult('vid-auto-1', mockResult);

    const afterFirstAnalysis = await videoRepository.getVideoById('vid-auto-1');
    expect(afterFirstAnalysis?.status).toBe('completed');
    expect(afterFirstAnalysis?.recognizedActionType).toBe('axe_kick');
    // 關鍵：原本為 auto (requestedActionType === undefined)，分析後不可把辨識結果覆寫進 requestedActionType
    expect(afterFirstAnalysis?.requestedActionType).toBeUndefined();
  });
});
