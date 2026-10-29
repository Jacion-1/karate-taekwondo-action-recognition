import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { MartialArtsDatabase, db } from '../database';
import { videoRepository } from '../repositories/video.repo';
import { sessionService } from '../../services/session.service';
import type { ActionAnalysisResponse, LocalVideoRecord } from '../../types/martial-arts.types';

describe('video.repo & Dexie v1 -> v2 migration', () => {
  beforeEach(async () => {
    await db.videos.clear();
    await db.analyses.clear();
    sessionService.clearGuestSessionData();
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

  it('resetInterruptedAnalyses resets uploading and processing videos to failed with clear message', async () => {
    await videoRepository.saveRecordedVideo({
      id: 'stuck-uploading',
      blob: new Blob(['u'], { type: 'video/webm' }),
      mimeType: 'video/webm',
      duration: 2.0,
      createdAt: 1000,
      status: 'uploading',
      uploadProgress: 40,
    });
    await videoRepository.saveRecordedVideo({
      id: 'stuck-processing',
      blob: new Blob(['p'], { type: 'video/webm' }),
      mimeType: 'video/webm',
      duration: 3.0,
      createdAt: 2000,
      status: 'processing',
      uploadProgress: 100,
    });
    await videoRepository.saveRecordedVideo({
      id: 'normal-local',
      blob: new Blob(['l'], { type: 'video/webm' }),
      mimeType: 'video/webm',
      duration: 2.5,
      createdAt: 3000,
      status: 'local_saved',
    });

    const resetCount = await videoRepository.resetInterruptedAnalyses();
    expect(resetCount).toBe(2);

    const u = await videoRepository.getVideoById('stuck-uploading');
    const p = await videoRepository.getVideoById('stuck-processing');
    const l = await videoRepository.getVideoById('normal-local');

    expect(u?.status).toBe('failed');
    expect(u?.errorMessage).toBe('上次分析被中斷，請重新送出');
    expect(p?.status).toBe('failed');
    expect(p?.errorMessage).toBe('上次分析被中斷，請重新送出');
    expect(l?.status).toBe('local_saved');
  });

  it('pruneExpiredVideos purges blob (>7 days) and marks expired_purged while keeping unexpired blob intact', async () => {
    const now = 10_000_000;
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
    const oneDayAgo = now - 1 * 24 * 60 * 60 * 1000;

    await videoRepository.saveRecordedVideo({
      id: 'video-expired-1',
      blob: new Blob(['expired_binary_data'], { type: 'video/webm' }),
      mimeType: 'video/webm',
      duration: 3.0,
      createdAt: eightDaysAgo,
      status: 'completed',
    });

    await videoRepository.saveRecordedVideo({
      id: 'video-active-1',
      blob: new Blob(['active_binary_data'], { type: 'video/webm' }),
      mimeType: 'video/webm',
      duration: 2.0,
      createdAt: oneDayAgo,
      status: 'completed',
    });

    const purgedCount = await videoRepository.pruneExpiredVideos(now);
    expect(purgedCount).toBe(1);

    const expiredVid = await videoRepository.getVideoById('video-expired-1');
    const activeVid = await videoRepository.getVideoById('video-active-1');

    // 驗證過期影片：blob 被設為 undefined、retentionStatus 標為 expired_purged、purgedAt 有記錄
    expect(expiredVid?.blob).toBeUndefined();
    expect(expiredVid?.retentionStatus).toBe('expired_purged');
    expect(expiredVid?.purgedAt).toBe(now);

    // 驗證未滿 7 天影片：blob 保持完整、retentionStatus 為 active
    expect(activeVid?.blob).toBeDefined();
    expect(activeVid?.blob?.size).toBeGreaterThan(0);
    expect(activeVid?.retentionStatus).toBe('active');

    // 再次執行 pruneExpiredVideos，已被清理者不應重複被計數或清理
    const secondPurgeCount = await videoRepository.pruneExpiredVideos(now);
    expect(secondPurgeCount).toBe(0);
  });

  it('preserves structured analysis data and reports expired_purged in history records when video blob is purged', async () => {
    const now = 20_000_000;
    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;

    await videoRepository.saveRecordedVideo({
      id: 'vid-purge-test',
      blob: new Blob(['test-video'], { type: 'video/webm' }),
      mimeType: 'video/webm',
      duration: 4.5,
      createdAt: tenDaysAgo,
      status: 'local_saved',
      userId: 'user-vip-1',
    });

    const mockAnalysis: ActionAnalysisResponse = {
      analysisId: 'ana-purge-test',
      videoId: 'vid-purge-test',
      source: 'mock',
      actionType: 'gedan_barai',
      totalScore: 92,
      grade: 'A',
      confidence: 95,
      duration: 4.5,
      feedbackSummary: '下段防守動作扎實穩定',
      defects: [
        {
          id: 'DEFECT-01',
          timestamp: 1.2,
          jointName: 'left_elbow',
          currentValue: 125,
          standardRange: [120, 135],
          message: '前臂下壓延遲',
          severity: 'minor',
        },
      ],
      angleTimeSeries: {
        jointName: 'left_elbow',
        points: [
          {
            time: 1.0,
            actualAngle: 125,
            standardMin: 120,
            standardMax: 135,
            standardBand: [120, 135],
          },
        ],
      },
      allJointSeries: [],
    };

    await videoRepository.saveAnalysisResult('vid-purge-test', mockAnalysis);

    // 執行 7 天過期清理
    const purgedCount = await videoRepository.pruneExpiredVideos(now);
    expect(purgedCount).toBe(1);

    // 1. 驗證結構化分析報告完全保留，不受二進位過期影響
    const preservedAnalysis = await videoRepository.getAnalysisById('ana-purge-test');
    expect(preservedAnalysis).toBeDefined();
    expect(preservedAnalysis?.totalScore).toBe(92);
    expect(preservedAnalysis?.grade).toBe('A');
    expect(preservedAnalysis?.defects.length).toBe(1);
    expect(preservedAnalysis?.defects[0].message).toBe('前臂下壓延遲');
    expect(preservedAnalysis?.angleTimeSeries.points[0].actualAngle).toBe(125);

    // 2. 驗證會員歷史紀錄 getMemberHistoryRecords
    const historyRecords = await videoRepository.getMemberHistoryRecords('user-vip-1');
    expect(historyRecords.length).toBe(1);
    expect(historyRecords[0].analysisId).toBe('ana-purge-test');
    expect(historyRecords[0].videoId).toBe('vid-purge-test');
    expect(historyRecords[0].userId).toBe('user-vip-1');
    expect(historyRecords[0].totalScore).toBe(92);
    expect(historyRecords[0].grade).toBe('A');
    expect(historyRecords[0].actionType).toBe('gedan_barai');
    expect(historyRecords[0].defectCount).toBe(1);
    expect(historyRecords[0].videoRetentionStatus).toBe('expired_purged');
    expect(historyRecords[0].videoPurgedAt).toBe(now);
  });

  it('sessionService isolates guest videos/analyses in memory only, clears correctly, and promotes to IndexedDB on demand', async () => {
    // 確保訪客初始狀態
    sessionService.logoutToGuest();
    const guestSession = sessionService.getSession();
    expect(guestSession.authStatus).toBe('guest');

    // 訪客儲存錄影與分析
    const guestVideo: LocalVideoRecord = {
      id: 'guest-vid-1',
      blob: new Blob(['guest-binary'], { type: 'video/webm' }),
      mimeType: 'video/webm',
      duration: 3.5,
      createdAt: Date.now(),
      status: 'local_saved',
      requestedActionType: 'front_kick',
    };
    sessionService.saveGuestVideo(guestVideo);

    const guestAnalysis: ActionAnalysisResponse = {
      analysisId: 'guest-ana-1',
      videoId: 'guest-vid-1',
      source: 'mock',
      actionType: 'front_kick',
      totalScore: 88,
      grade: 'B',
      defects: [],
      angleTimeSeries: {
        jointName: 'right_knee',
        points: [],
      },
      allJointSeries: [],
    };
    sessionService.saveGuestAnalysis('guest-vid-1', guestAnalysis);

    // 驗證暫態記憶體取得
    const retrievedGuestVid = sessionService.getGuestVideo('guest-vid-1');
    const retrievedGuestAna = sessionService.getGuestAnalysis('guest-ana-1');
    expect(retrievedGuestVid).toBeDefined();
    expect(retrievedGuestVid?.retentionStatus).toBe('ephemeral_memory');
    expect(retrievedGuestVid?.status).toBe('completed');
    expect(retrievedGuestVid?.analysisId).toBe('guest-ana-1');
    expect(retrievedGuestAna?.totalScore).toBe(88);

    // 關鍵：驗證訪客資料完全未寫入 IndexedDB
    const dbVideosCount = await db.videos.count();
    const dbAnalysesCount = await db.analyses.count();
    expect(dbVideosCount).toBe(0);
    expect(dbAnalysesCount).toBe(0);

    // 測試 clearGuestSessionData 清除暫態記憶體
    sessionService.clearGuestSessionData();
    expect(sessionService.getGuestVideo('guest-vid-1')).toBeUndefined();
    expect(sessionService.getGuestAnalysis('guest-ana-1')).toBeUndefined();

    // 重新放一筆供升級至會員使用
    sessionService.saveGuestVideo(guestVideo);
    sessionService.saveGuestAnalysis('guest-vid-1', guestAnalysis);

    // 模擬使用者登入為會員
    sessionService.loginAsMember({
      userId: 'member-007',
      displayName: '黑帶高手',
      email: 'master@test.com',
    });
    expect(sessionService.getSession().authStatus).toBe('member');

    // 呼叫 promoteGuestRecordToMember 持久化至 IndexedDB
    const promoted = await sessionService.promoteGuestRecordToMember('guest-vid-1', 'guest-ana-1');
    expect(promoted).toBe(true);

    // 暫態記憶體已清除該筆
    expect(sessionService.getGuestVideo('guest-vid-1')).toBeUndefined();
    expect(sessionService.getGuestAnalysis('guest-ana-1')).toBeUndefined();

    // IndexedDB 成功持久化
    const savedInDbVid = await videoRepository.getVideoById('guest-vid-1');
    const savedInDbAna = await videoRepository.getAnalysisById('guest-ana-1');
    expect(savedInDbVid).toBeDefined();
    expect(savedInDbVid?.userId).toBe('member-007');
    expect(savedInDbVid?.retentionStatus).toBe('active');
    expect(savedInDbAna).toBeDefined();
    expect(savedInDbAna?.totalScore).toBe(88);
  });
});
