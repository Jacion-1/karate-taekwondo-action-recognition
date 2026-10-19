import { useCallback, useRef, useState } from 'react';
import type { ActionType, LocalVideoRecord } from '../../../types/martial-arts.types';
import { videoRepository } from '../../../db/repositories/video.repo';
import { extractVideoMetadataAndThumbnail } from '../../../shared/utils/videoMedia.utils';

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

/**
 * 嚴格遵守架構規範 3（非同步儲存與主執行緒解耦）：
 * 視訊錄製完成後的二進位物件 (Blob) 直接寫入 IndexedDB，並自動擷取首幀縮圖，不暫存於全域反應式狀態中。
 */
export function useMediaRecorder(onVideoSaved?: (videoId: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number>(0);

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
        const videoBlob = new Blob(chunksRef.current, { type: finalMimeType });

        // 清空記憶體暫存陣列
        chunksRef.current = [];

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
          fileName: `Camera-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.webm`,
        };

        await videoRepository.saveRecordedVideo(record);
        setIsRecording(false);
        onVideoSaved?.(record.id);
      };

      startTimeRef.current = Date.now();
      recorder.start(250);
      recorderRef.current = recorder;
      setIsRecording(true);
    },
    [isRecording, onVideoSaved]
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
