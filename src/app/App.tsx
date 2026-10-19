import React, { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { videoRepository } from '../db/repositories/video.repo';
import { useNetworkStatus } from '../shared/hooks/useNetworkStatus';
import { RecordWorkspace } from '../features/recorder/RecordWorkspace';
import { VideoVault } from '../features/vault/VideoVault';
import { AnalysisDashboard } from '../features/analysis/AnalysisDashboard';
import { ToastProvider } from '../shared/components/ToastContainer';
import { ApiConnectionDrawer } from '../shared/components/ApiConnectionDrawer';
import { analysisClientFactory } from '../services/analysisClient.factory';
import type { ActionType } from '../types/martial-arts.types';
import type { ApiConnectionConfig } from '../services/apiClient.interface';

type ActiveTab = 'record' | 'vault' | 'analysis';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('record');
  const [focusAction, setFocusAction] = useState<ActionType | 'auto'>('auto');
  const [selectedReport, setSelectedReport] = useState<{
    videoId: string;
    analysisId: string;
  } | null>(null);
  const [isApiDrawerOpen, setIsApiDrawerOpen] = useState<boolean>(false);
  const [apiConfig, setApiConfig] = useState<ApiConnectionConfig>(() =>
    analysisClientFactory.getConfig()
  );
  const [isClientHealthy, setIsClientHealthy] = useState<boolean>(true);

  // 啟動時重設上次中斷殘留的 uploading / processing 紀錄，並請求持久化儲存空間
  useEffect(() => {
    videoRepository.resetInterruptedAnalyses().catch(() => {
      // 忽略啟動清理異常
    });
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persist === 'function'
    ) {
      navigator.storage.persist().catch(() => {
        // 失敗則忽略
      });
    }
  }, []);

  useEffect(() => {
    return analysisClientFactory.subscribe(setApiConfig);
  }, []);

  const { networkStatus, simulateOffline, toggleSimulateOffline } =
    useNetworkStatus();

  // 依目前 client 的 checkHealth() 結果決定能否送出（mock 模式永遠可用）
  useEffect(() => {
    let active = true;
    if (apiConfig.mode === 'mock') {
      setIsClientHealthy(true);
      return;
    }
    if (simulateOffline) {
      setIsClientHealthy(false);
      return;
    }
    analysisClientFactory
      .getClient()
      .checkHealth()
      .then((res) => {
        if (active) setIsClientHealthy(res.ok);
      })
      .catch(() => {
        if (active) setIsClientHealthy(false);
      });
    return () => {
      active = false;
    };
  }, [apiConfig, simulateOffline]);

  const videoCount = useLiveQuery(() => db.videos.count(), []) ?? 0;

  const handleOpenAnalysis = (videoId: string, analysisId: string) => {
    setSelectedReport({ videoId, analysisId });
    setActiveTab('analysis');
  };

  const handleReverifyAction = (actionType: ActionType) => {
    setFocusAction(actionType);
    setActiveTab('record');
  };

  const canSubmitAnalysis =
    apiConfig.mode === 'mock' ? true : isClientHealthy && !simulateOffline;

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100">
        {/* 極簡頂部導覽列 */}
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#09090b]/85 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
            {/* 左側：專題名稱 */}
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span className="text-sm sm:text-base font-semibold tracking-tight text-white">
                空手道與跆拳道動作識別系統
              </span>
            </div>

            {/* 中央：分段式導覽器 */}
            <nav className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-full border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setActiveTab('record')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeTab === 'record'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                拍攝與輸入
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('vault')}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeTab === 'vault'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <span>影片庫</span>
                {videoCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${
                      activeTab === 'vault'
                        ? 'bg-zinc-950/15 text-zinc-950 font-semibold'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {videoCount}
                  </span>
                )}
              </button>

              {selectedReport && (
                <button
                  type="button"
                  onClick={() => setActiveTab('analysis')}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeTab === 'analysis'
                      ? 'bg-white text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  分析報告
                </button>
              )}
            </nav>

            {/* 右側：極簡連線與後端設定控制 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSimulateOffline}
                title="開發工具：切換模擬離線狀態"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/70 hover:bg-zinc-800/80 border border-white/[0.06] text-xs text-zinc-300 transition"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    canSubmitAnalysis ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="hidden sm:inline">
                  {simulateOffline
                    ? '模擬離線'
                    : canSubmitAnalysis
                      ? '服務就緒'
                      : '後端未就緒'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsApiDrawerOpen(true)}
                title="後端 API 連線設定"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/70 hover:bg-zinc-800/80 border border-white/[0.06] text-xs text-zinc-300 hover:text-white transition"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  {apiConfig.mode === 'mock' ? '模擬引擎' : 'REST API'}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* 主內容區：留白充足 */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 sm:py-10">
          {activeTab === 'record' && (
            <RecordWorkspace
              onNavigateToVault={() => setActiveTab('vault')}
              onOpenAnalysis={handleOpenAnalysis}
              initialFocusAction={focusAction}
            />
          )}

          {activeTab === 'vault' && (
            <VideoVault
              networkStatus={networkStatus}
              canAnalyze={canSubmitAnalysis}
              onOpenAnalysis={handleOpenAnalysis}
            />
          )}

          {activeTab === 'analysis' && selectedReport && (
            <AnalysisDashboard
              videoId={selectedReport.videoId}
              analysisId={selectedReport.analysisId}
              onBack={() => setActiveTab('vault')}
              onReverifyAction={handleReverifyAction}
            />
          )}
        </main>

        {/* 後端 API 設定抽屜 */}
        <ApiConnectionDrawer
          isOpen={isApiDrawerOpen}
          onClose={() => setIsApiDrawerOpen(false)}
          onConfigChange={setApiConfig}
        />
      </div>
    </ToastProvider>
  );
};
