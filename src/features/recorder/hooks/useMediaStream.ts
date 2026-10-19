import { useCallback, useEffect, useRef, useState } from 'react';

export interface StreamTelemetry {
  width: number;
  height: number;
  frameRate: number;
  label: string;
}

/**
 * 嚴格遵守架構規範 2（副作用清理）：
 * 所有涉及攝影機串流的組件，必須在卸載函式中逐一停止所有視訊軌道 (track.stop())。
 */
export function useMediaStream() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [telemetry, setTelemetry] = useState<StreamTelemetry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const streamRef = useRef<MediaStream | null>(null);

  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    setStream(null);
    setTelemetry(null);
  }, []);

  const startCamera = useCallback(
    async (preferredFacing?: 'user' | 'environment') => {
      stopAllTracks();
      setError(null);
      const targetFacing = preferredFacing ?? facingMode;

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        streamRef.current = mediaStream;
        setStream(mediaStream);

        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          setTelemetry({
            width: settings.width || 1280,
            height: settings.height || 720,
            frameRate: Math.round(settings.frameRate || 30),
            label: videoTrack.label || 'Optical Camera Sensor',
          });
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : '無法存取攝影機，請確認瀏覽器權限或使用下方「匯入影片檔 / AI 骨架模擬」功能。';
        setError(message);
      }
    },
    [facingMode, stopAllTracks]
  );

  const toggleFacingMode = useCallback(() => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (streamRef.current) {
      startCamera(nextMode);
    }
  }, [facingMode, startCamera]);

  // 組件卸載時強制釋放所有攝影機軌道
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    stream,
    telemetry,
    error,
    facingMode,
    startCamera,
    stopCamera: stopAllTracks,
    toggleFacingMode,
  };
}
