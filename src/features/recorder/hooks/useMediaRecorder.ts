import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionType, LocalVideoRecord } from '../../../types/martial-arts.types';
import { videoRepository } from '../../../db/repositories/video.repo';
import { extractVideoMetadataAndThumbnail } from '../../../shared/utils/videoMedia.utils';
import { fixWebmDuration } from '../../../shared/utils/webmDurationFix';

function getSupportedMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

export function getExtensionFromMimeType(mimeType: string): 'mp4' | 'webm' {
  return mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
}

/**
 * 嚴格遵守架構規範 3（非同步儲存與主執行緒解耦）：
 * 視訊錄製完成後的二進位物件 (Blob) 修補 WebM 時長後直接寫入 IndexedDB，
 * 並自動擷取首幀縮圖，不暫存於全域反應式狀態中；卸載時若仍在錄影則自動停止且不對已卸載組件 setState。
 */
export function useMediaRecorder(onVideoSaved?: (videoId: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);
  const onVideoSavedRef = useRef(onVideoSaved);

  useEffect(() => {
    onVideoSavedRef.current = onVideoSaved;
  }, [onVideoSaved]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // 忽略已停止之狀態異常
        }
      }
    };
  }, []);

  const startRecording = useCallback(
    (stream: MediaStream, requestedActionType?: ActionType) => {
      if (!stream || isRecording) return;

      chunksRef.current = [];
      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const elapsedSeconds = Number(
          Math.max(1, (Date.now() - startTimeRef.current) / 1000).toFixed(1)
        );
        const finalMimeType = recorder.mimeType || mimeType || 'video/webm';
        const rawBlob = new Blob(chunksRef.current, { type: finalMimeType });

        // 清空記憶體暫存陣列
        chunksRef.current = [];

        const ext = getExtensionFromMimeType(finalMimeType);
        const videoBlob =
          ext === 'webm'
            ? await fixWebmDuration(rawBlob, elapsedSeconds)
            : rawBlob;

        const { thumbnailDataUrl } = await extractVideoMetadataAndThumbnail(
          videoBlob,
          elapsedSeconds
        );

        const record: LocalVideoRecord = {
          id: `vid-${Date.now()}`,
          blob: videoBlob,
          mimeType: finalMimeType,
          duration: elapsedSeconds,
          createdAt: Date.now(),
          status: 'local_saved',
          requestedActionType,
          recognizedActionType: undefined,
          thumbnailDataUrl,
          sourceType: 'camera',
          fileName: `Camera-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.${ext}`,
        };

        try {
          await videoRepository.saveRecordedVideo(record);
        } catch {
          // 忽略卸載後 DB 寫入錯誤
        }

        if (mountedRef.current) {
          setIsRecording(false);
          onVideoSavedRef.current?.(record.id);
        }
      };

      startTimeRef.current = Date.now();
      recorder.start(250);
      recorderRef.current = recorder;
      if (mountedRef.current) {
        setIsRecording(true);
      }
    },
    [isRecording]
  );

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
