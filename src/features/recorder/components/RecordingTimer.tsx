import React, { useEffect, useState } from 'react';

interface RecordingTimerProps {
  isRecording: boolean;
}

/**
 * 嚴格遵守架構規範 1（狀態下沉與組件隔離）：
 * 錄影過程中的「已錄製秒數」封裝於此獨立葉子組件內，防止每秒觸發父層視訊畫面重新渲染。
 */
export const RecordingTimer: React.FC<RecordingTimerProps> = React.memo(({ isRecording }) => {
  const [elapsedDeciseconds, setElapsedDeciseconds] = useState(0);

  useEffect(() => {
    if (!isRecording) {
      setElapsedDeciseconds(0);
      return;
    }

    const startTime = performance.now();
    const timer = setInterval(() => {
      const diffSec = (performance.now() - startTime) / 100;
      setElapsedDeciseconds(Math.floor(diffSec));
    }, 100);

    return () => clearInterval(timer);
  }, [isRecording]);

  const totalSeconds = Math.floor(elapsedDeciseconds / 10);
  const tenths = elapsedDeciseconds % 10;
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');

  if (!isRecording) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-zinc-950/75 px-3 py-1 text-xs font-medium text-zinc-400 backdrop-blur-md border border-white/[0.08]">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
        <span>待機</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-rose-950/90 px-3.5 py-1 text-xs font-mono font-medium text-rose-100 backdrop-blur-md border border-rose-500/40 tabular-nums">
      <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
      <span>
        {mins}:{secs}.{tenths}
      </span>
    </div>
  );
});

RecordingTimer.displayName = 'RecordingTimer';
