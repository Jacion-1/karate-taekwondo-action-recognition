import {
  type ActionAnalysisResponse,
  type LocalVideoRecord,
  type UserSession,
  VIDEO_RETENTION_MS,
} from '../types/martial-arts.types';
import { videoRepository } from '../db/repositories/video.repo';

export const SESSION_STORAGE_KEY = 'ma_evaluator_user_session_v1';

export const DEFAULT_GUEST_SESSION: UserSession = {
  authStatus: 'guest',
  userId: 'guest-session',
  displayName: '訪客體驗',
};

// 記憶體中的當前 Session 狀態（確保非瀏覽器環境如 Node/SSR/Vitest 亦能正確維護）
let currentSession: UserSession = { ...DEFAULT_GUEST_SESSION };

// 訂閱者監聽清單
const sessionSubscribers = new Set<(session: UserSession) => void>();

function notifySubscribers(session: UserSession): void {
  for (const listener of sessionSubscribers) {
    try {
      listener(session);
    } catch (err) {
      console.error('Session listener error:', err);
    }
  }
}

// 訪客暫態記憶體儲存區（純 In-Memory Map，絕不寫入 IndexedDB）
const guestVideos = new Map<string, LocalVideoRecord>();
const guestAnalyses = new Map<string, ActionAnalysisResponse>();

export const sessionService = {
  /**
   * 從 localStorage 讀取已登入之 'member' session，若無或格式無效則回傳預設 'guest' session
   */
  getSession(): UserSession {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<UserSession>;
          if (
            parsed &&
            parsed.authStatus === 'member' &&
            typeof parsed.userId === 'string' &&
            typeof parsed.displayName === 'string'
          ) {
            currentSession = {
              authStatus: 'member',
              userId: parsed.userId,
              displayName: parsed.displayName,
              email: typeof parsed.email === 'string' ? parsed.email : undefined,
              loginAt: typeof parsed.loginAt === 'number' ? parsed.loginAt : undefined,
            };
            return { ...currentSession };
          }
        }
        currentSession = { ...DEFAULT_GUEST_SESSION };
      } catch {
        currentSession = { ...DEFAULT_GUEST_SESSION };
      }
    }
    return { ...currentSession };
  },

  /**
   * 切換為 'member'，預設 userId: 'member-default', displayName: '正式會員'，
   * 附加 loginAt: Date.now()，寫入 localStorage 並通知訂閱者
   */
  loginAsMember(profile?: {
    userId?: string;
    displayName?: string;
    email?: string;
  }): UserSession {
    const session: UserSession = {
      authStatus: 'member',
      userId: profile?.userId?.trim() || 'member-default',
      displayName: profile?.displayName?.trim() || '正式會員',
      email: profile?.email?.trim(),
      loginAt: Date.now(),
    };

    currentSession = session;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      }
    } catch {
      // ignore storage error
    }

    notifySubscribers(session);
    return session;
  },

  /**
   * 移除 localStorage 中的會員 session，清空訪客暫態記憶體，重設為 'guest' 並通知訂閱者
   */
  logoutToGuest(): UserSession {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // ignore storage error
    }

    guestVideos.clear();
    guestAnalyses.clear();

    currentSession = { ...DEFAULT_GUEST_SESSION };
    notifySubscribers(currentSession);
    return currentSession;
  },

  /**
   * 訂閱工作階段變更事件，回傳取消訂閱函式
   */
  subscribe(listener: (session: UserSession) => void): () => void {
    sessionSubscribers.add(listener);
    return () => {
      sessionSubscribers.delete(listener);
    };
  },

  // ==========================================
  // 訪客暫態記憶體存取層 (Ephemeral Store)
  // ==========================================

  /**
   * 將錄影記錄暫存至記憶體 Map（強制標記 retentionStatus: 'ephemeral_memory'）
   */
  saveGuestVideo(record: LocalVideoRecord): void {
    const guestRecord: LocalVideoRecord = {
      ...record,
      retentionStatus: 'ephemeral_memory',
      userId: record.userId ?? 'guest-session',
    };
    guestVideos.set(record.id, guestRecord);
  },

  /**
   * 從記憶體 Map 取得暫存視訊記錄
   */
  getGuestVideo(videoId: string): LocalVideoRecord | undefined {
    return guestVideos.get(videoId);
  },

  /**
   * 將分析結果暫存至記憶體 Map，並同步更新記憶體內對應 video 之 status, analysisId, recognizedActionType
   */
  saveGuestAnalysis(videoId: string, analysis: ActionAnalysisResponse): void {
    guestAnalyses.set(analysis.analysisId, analysis);
    const existingVideo = guestVideos.get(videoId);
    if (existingVideo) {
      existingVideo.status = 'completed';
      existingVideo.analysisId = analysis.analysisId;
      existingVideo.recognizedActionType = analysis.actionType;
      guestVideos.set(videoId, existingVideo);
    }
  },

  /**
   * 從記憶體 Map 取得暫存分析報告
   */
  getGuestAnalysis(analysisId: string): ActionAnalysisResponse | undefined {
    return guestAnalyses.get(analysisId);
  },

  /**
   * 清空記憶體中所有訪客視訊與分析報告
   */
  clearGuestSessionData(): void {
    guestVideos.clear();
    guestAnalyses.clear();
  },

  /**
   * 當訪客在報告頁點擊「登入以永久保存歷史」時，將暫態記憶體中的 video 與 analysis
   * 正式寫入 IndexedDB (videoRepository)，並從記憶體 Map 移除
   */
  async promoteGuestRecordToMember(
    videoId: string,
    analysisId: string
  ): Promise<boolean> {
    const video = guestVideos.get(videoId);
    const analysis = guestAnalyses.get(analysisId);

    if (!video || !analysis) {
      return false;
    }

    const currentSession = sessionService.getSession();
    const targetUserId =
      currentSession.authStatus === 'member'
        ? currentSession.userId
        : 'member-default';

    const memberVideo: LocalVideoRecord = {
      ...video,
      userId: targetUserId,
      retentionStatus: 'active',
      expiresAt: video.expiresAt ?? video.createdAt + VIDEO_RETENTION_MS,
    };

    await videoRepository.saveRecordedVideo(memberVideo);
    await videoRepository.saveAnalysisResult(videoId, analysis);

    guestVideos.delete(videoId);
    guestAnalyses.delete(analysisId);
    return true;
  },
};
