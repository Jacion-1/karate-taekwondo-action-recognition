import React, { useEffect, useRef } from 'react';
import { Camera } from 'lucide-react';
import type { StreamTelemetry } from '../hooks/useMediaStream';

interface CameraPreviewProps {
  stream: MediaStream | null;
  telemetry: StreamTelemetry | null;
  error: string | null;
  showGuideGrid: boolean;
  countdownSeconds: number | null;
  onStartCamera: () => void;
}

/**
 * 攝影機視訊預覽組件 (Modern Minimalism & Tokenized)
 * 1. 移除中間重複的次要按鈕，保持取景畫面乾淨純粹。
 * 2. 將繁複的虛線框改為極簡相機四角對齊標記 (Corner Brackets)。
 */
export const CameraPreview: React.FC<CameraPreviewProps> = React.memo(
  ({
    stream,
    telemetry,
    error,
    showGuideGrid,
    countdownSeconds,
    onStartCamera,
  }) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
      const videoEl = videoRef.current;
      if (!videoEl) return;

      if (stream) {
        videoEl.srcObject = stream;
      } else {
        videoEl.srcObject = null;
      }

      return () => {
        if (videoEl) {
          videoEl.srcObject = null;
        }
      };
    }, [stream]);

    return (
      <div className="relative w-full min-h-[250px] sm:min-h-0 aspect-video bg-app-well rounded-card overflow-hidden border border-app-border flex items-center justify-center">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center pt-12 pb-5 px-4 sm:p-6 text-center max-w-sm z-10">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-panel bg-app-surface border border-app-border flex items-center justify-center mb-3 sm:mb-4 text-app-muted">
              <Camera className="w-5 h-5 text-app-primary" />
            </div>
            <h3 className="text-heading-md font-semibold text-app-primary mb-1.5">
              準備拍攝動作影像
            </h3>
            <p className="text-body text-app-muted mb-6 leading-relaxed">
              {error
                ? error
                : '開啟攝影機進行全身動作錄製，或由下方工具列匯入預錄影片檔。'}
            </p>
            <button
              type="button"
              onClick={onStartCamera}
              className="btn-primary touch-manipulation"
            >
              開啟攝影機
            </button>
          </div>
        )}

        {/* 3 秒倒數開拍遮罩 */}
        {countdownSeconds !== null && countdownSeconds > 0 && (
          <div className="absolute inset-0 z-20 bg-app-canvas/85 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="text-7xl font-bold font-mono text-app-primary tabular-nums">
              {countdownSeconds}
            </div>
            <p className="text-caption text-app-muted mt-3 tracking-wide">
              請退至取景範圍內預備
            </p>
          </div>
        )}

        {/* 極簡四角取景對齊標記 (Viewfinder Corner Brackets) */}
        {showGuideGrid && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-3/5 h-4/5 relative">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-brand-primary/60 rounded-tl-sm" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-brand-primary/60 rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-brand-primary/60 rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-brand-primary/60 rounded-br-sm" />
              <div className="absolute inset-y-8 left-1/2 w-px bg-app-border/40" />
            </div>
          </div>
        )}

        {/* 右下角極簡解析度資訊 */}
        {stream && telemetry && (
          <div className="pointer-events-none absolute bottom-3 right-3 px-2.5 py-1 rounded-control bg-app-canvas/80 border border-app-border font-mono text-caption text-app-muted tabular-nums">
            {telemetry.width}×{telemetry.height} · {telemetry.frameRate}fps
          </div>
        )}
      </div>
    );
  }
);

CameraPreview.displayName = 'CameraPreview';
