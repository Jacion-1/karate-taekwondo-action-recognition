import React, { useEffect, useState } from 'react';
import {
  X,
  Activity,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { analysisClientFactory } from '../../services/analysisClient.factory';
import type { ApiConnectionConfig, ApiMode } from '../../services/apiClient.interface';
import { useToast } from './ToastContainer';

interface ApiConnectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange?: (config: ApiConnectionConfig) => void;
}

const SAMPLE_CONTRACT_JSON = `{
  "analysisId": "ana-20261019-001",
  "videoId": "vid-1729327200",
  "actionType": "roundhouse_kick",
  "confidence": 95.8,
  "totalScore": 88,
  "grade": "A",
  "duration": 3.2,
  "feedbackSummary": "經資料庫比對識別為跆拳道・迴旋踢（信心度 95.8%），提膝與轉髖流暢，彈踢瞬間角度達標。",
  "defects": [
    {
      "id": "def-1",
      "timestamp": 1.6,
      "jointName": "right_knee",
      "currentValue": 154,
      "standardRange": [160, 176],
      "message": "踢擊頂點膝關節伸展不足 6 度",
      "severity": "moderate"
    }
  ],
  "angleTimeSeries": {
    "jointName": "right_knee",
    "points": [
      { "time": 0.0, "actualAngle": 72, "standardMin": 65, "standardMax": 80 }
    ]
  }
}`;

export const ApiConnectionDrawer: React.FC<ApiConnectionDrawerProps> = ({
  isOpen,
  onClose,
  onConfigChange,
}) => {
  const { pushToast } = useToast();
  const [config, setConfig] = useState<ApiConnectionConfig>(() =>
    analysisClientFactory.getConfig()
  );
  const [healthStatus, setHealthStatus] = useState<{
    checking: boolean;
    ok?: boolean;
    latencyMs?: number;
    message?: string;
  }>({ checking: false });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(analysisClientFactory.getConfig());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (nextMode?: ApiMode) => {
    const updated = analysisClientFactory.saveConfig({
      ...config,
      mode: nextMode ?? config.mode,
    });
    setConfig(updated);
    onConfigChange?.(updated);
    pushToast({
      type: 'success',
      title:
        updated.mode === 'mock'
          ? '已切換至內建模擬引擎'
          : '已切換至遠端 REST API 模式',
      message:
        updated.mode === 'http'
          ? `端點：${updated.baseUrl}/api/v1/analyses`
          : undefined,
    });
  };

  const handlePingHealth = async () => {
    analysisClientFactory.saveConfig(config);
    setHealthStatus({ checking: true });
    const res = await analysisClientFactory.checkBackendHealth();
    setHealthStatus({
      checking: false,
      ok: res.ok,
      latencyMs: res.latencyMs,
      message: res.message,
    });
  };

  const handleCopyContract = () => {
    navigator.clipboard?.writeText(SAMPLE_CONTRACT_JSON);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#0c0c0f] border-l border-white/[0.08] h-full flex flex-col justify-between overflow-y-auto">
        <div className="p-6 sm:p-8 space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                後端連線與資料合約設定
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                切換前端模擬演算法或連接遠端後端辨識伺服器
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 雙模式切換 */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-zinc-400">
              運算模式
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSave('mock')}
                className={`p-4 rounded-2xl border text-left transition ${
                  config.mode === 'mock'
                    ? 'bg-zinc-800/90 border-white/30 text-white'
                    : 'bg-zinc-900/40 border-white/[0.06] text-zinc-400 hover:border-white/15'
                }`}
              >
                <div className="font-medium text-sm">內建模擬引擎</div>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  無需啟動後端，於本地端模擬上傳與關節角度分析
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSave('http')}
                className={`p-4 rounded-2xl border text-left transition ${
                  config.mode === 'http'
                    ? 'bg-zinc-800/90 border-white/30 text-white'
                    : 'bg-zinc-900/40 border-white/[0.06] text-zinc-400 hover:border-white/15'
                }`}
              >
                <div className="font-medium text-sm">遠端 REST API</div>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  透過 Multipart 將影片上傳至後端伺服器推論
                </p>
              </button>
            </div>
          </div>

          {/* 連線設定 */}
          <div className="space-y-4 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                伺服器端點
              </span>
              <button
                type="button"
                onClick={() => {
                  const reset = analysisClientFactory.resetConfig();
                  setConfig(reset);
                  onConfigChange?.(reset);
                }}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition"
              >
                <RotateCcw className="w-3 h-3" />
                重設預設值
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs text-zinc-500">Base URL</label>
                <input
                  type="url"
                  value={config.baseUrl}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))
                  }
                  placeholder="http://localhost:8000"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/[0.08] text-xs font-mono text-zinc-100 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500">逾時 (ms)</label>
                <input
                  type="number"
                  step={1000}
                  min={3000}
                  value={config.timeoutMs}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      timeoutMs: Number(e.target.value) || 30000,
                    }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/[0.08] text-xs font-mono text-zinc-100 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handlePingHealth}
                disabled={healthStatus.checking}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-white/[0.08] transition"
              >
                <Activity className="w-3.5 h-3.5 text-zinc-400" />
                {healthStatus.checking ? '測試中...' : '測試連線狀態'}
              </button>

              <button
                type="button"
                onClick={() => handleSave()}
                className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition"
              >
                儲存設定
              </button>
            </div>

            {healthStatus.message && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  healthStatus.ok
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                }`}
              >
                {healthStatus.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="font-mono">{healthStatus.message}</span>
              </div>
            )}
          </div>

          {/* 資料合約 */}
          <div className="space-y-3 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">
                API 回應格式規格 (`POST /api/v1/analyses`)
              </label>
              <button
                type="button"
                onClick={handleCopyContract}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    已複製
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    複製 JSON
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 rounded-2xl bg-zinc-900/70 border border-white/[0.06] text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
              {SAMPLE_CONTRACT_JSON}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
