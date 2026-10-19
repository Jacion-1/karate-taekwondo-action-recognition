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
  "source": "backend",
  "modelVersion": "mediapipe-stgcn-v1.0",
  "fps": 30,
  "actionType": "roundhouse_kick",
  "confidence": 95.8,
  "totalScore": 88,
  "grade": "A",
  "duration": 3.2,
  "feedbackSummary": "系統經資料庫特徵比對識別為「跆拳道・迴旋踢 (Dollyo-Chagi)」（信心度 95.8%）。",
  "metrics": {
    "stability": 89,
    "explosiveness": 86
  },
  "frames": [
    {
      "t": 1.6,
      "keypoints": [
        { "name": "hip", "x": 0.4531, "y": 0.5694, "visibility": 0.99 },
        { "name": "right_knee", "x": 0.5688, "y": 0.4083, "visibility": 0.96 },
        { "name": "right_ankle", "x": 0.6906, "y": 0.3306, "visibility": 0.95 }
      ]
    }
  ],
  "defects": [
    {
      "id": "def-1",
      "timestamp": 1.6,
      "jointName": "right_knee",
      "currentValue": 154,
      "standardRange": [160, 176],
      "message": "踢擊瞬間小腿鞭甩延伸不足，膝關節角度低於標準下限。",
      "prescription": "修正建議：在支撐腳腳掌旋轉至 150° 後再啟動小腿鞭甩。",
      "severity": "moderate"
    }
  ],
  "angleTimeSeries": {
    "jointName": "right_knee",
    "points": [
      { "time": 0.0, "actualAngle": 72, "standardMin": 60, "standardMax": 78 },
      { "time": 1.6, "actualAngle": 154, "standardMin": 160, "standardMax": 176 }
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

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500">
                API Key（選填，將帶入 Authorization: Bearer 標頭）
              </label>
              <input
                type="password"
                value={config.apiKey ?? ''}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    apiKey: e.target.value || undefined,
                  }))
                }
                placeholder="留空則不傳送 Authorization 標頭"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/[0.08] text-xs font-mono text-zinc-100 focus:outline-none focus:border-white/30"
              />
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                Key 儲存在瀏覽器 localStorage，不是機密；正式環境請由後端驗證。
              </p>
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
                API 規格 (`POST /api/v1/analyses`)
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

            <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/[0.05] text-[11px] text-zinc-400 space-y-1">
              <div>
                <span className="text-zinc-200 font-mono">Multipart 欄位：</span>
                <code className="text-zinc-300">video</code> (File)、
                <code className="text-zinc-300">clientVideoId</code>、
                <code className="text-zinc-300">duration</code>、選填{' '}
                <code className="text-zinc-300">requestedActionType</code>
              </div>
              <div>
                <span className="text-zinc-200 font-mono">回應模式：</span>
                支援 <code className="text-zinc-300">200 OK</code> 同步回傳，或{' '}
                <code className="text-zinc-300">202 Accepted</code> 輪詢{' '}
                <code className="text-zinc-300">GET /api/v1/analyses/&#123;analysisId&#125;</code>
              </div>
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
