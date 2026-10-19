import { useCallback, useEffect, useRef, useState } from 'react';

export interface StreamTelemetry {
  width: number;
  height: number;
  frameRate: number;
  label: string;
}

export function mapMediaStreamErrorToMessage(err: unknown): string {
  const errorName =
    err && typeof err === 'object' && 'name' in err && typeof (err as { name?: unknown }).name === 'string'
      ? (err as { name: string }).name
      : '';

  switch (errorName) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return '攝影機權限已被拒絕，請於瀏覽器網址列開啟攝影機權限後重試。';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '找不到可用的攝影機裝置，請確認鏡頭已連接或改用「匯入本地影片」。';
    case 'NotReadableError':
    case 'TrackStartError':
      return '攝影機正被其他應用程式佔用或硬體無法讀取，請關閉其他視訊程式後重試。';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return '攝影機不支援所請求的解析度或鏡頭方向，請切換鏡頭或改用其他裝置。';
    default:
      return err instanceof Error && err.message
        ? `無法存取攝影機：${err.message}`
        : '無法存取攝影機，請確認瀏覽器權限或使用下方「匯入本地影片 / 產生範例影片」功能。';
  }
}

/**
 * 嚴格遵守架構規範 2（副作用清理與競態防護）：
 * 所有涉及攝影機串流的組件，必須在卸載或新請求取代舊請求時逐一停止所有視訊軌道 (track.stop())。
 */
export function useMediaStream() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [telemetry, setTelemetry] = useState<StreamTelemetry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);

  const stopAllTracks = useCallback(() => {
    // 遞增 requestId 使任何進行中的 getUserMedia 請求失效
    requestIdRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (mountedRef.current) {
      setStream(null);
      setTelemetry(null);
    }
  }, []);

  const startCamera = useCallback(
    async (preferredFacing?: 'user' | 'environment') => {
      stopAllTracks();
      const currentRequestId = ++requestIdRef.current;

      if (mountedRef.current) {
        setError(null);
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        if (mountedRef.current) {
          setError('需要 HTTPS 或 localhost 才能使用攝影機');
        }
        return;
      }

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

        // 若等待期間元件已卸載或已被更新的 startCamera/stopCamera 呼叫取代，立即釋放軌道避免洩漏
        if (!mountedRef.current || currentRequestId !== requestIdRef.current) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

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
        if (!mountedRef.current || currentRequestId !== requestIdRef.current) {
          return;
        }
        setError(mapMediaStreamErrorToMessage(err));
      }
    },
    [facingMode, stopAllTracks]
  );

  const toggleFacingMode = useCallback(() => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (streamRef.current) {
      void startCamera(nextMode);
    }
  }, [facingMode, startCamera]);

  // 組件卸載時強制標記卸載並釋放所有攝影機軌道
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
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
