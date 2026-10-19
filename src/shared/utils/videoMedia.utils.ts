/**
 * 從任意視訊 Blob 或 File 解析真實時長 (duration) 並擷取首幀縮圖 (JPEG DataURL)，
 * 嚴格遵守規範 2：完成擷取或發生錯誤時立即呼叫 URL.revokeObjectURL 釋放記憶體。
 */
export async function extractVideoMetadataAndThumbnail(
  blob: Blob,
  fallbackDuration = 3.2
): Promise<{ duration: number; thumbnailDataUrl?: string }> {
  if (typeof document === 'undefined' || !blob || blob.size === 0) {
    return { duration: fallbackDuration };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    const finish = (result: { duration: number; thumbnailDataUrl?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      finish({ duration: fallbackDuration });
    }, 3500);

    video.onerror = () => {
      finish({ duration: fallbackDuration });
    };

    video.onloadedmetadata = () => {
      const rawDuration = video.duration;
      const validDuration =
        Number.isFinite(rawDuration) && rawDuration > 0
          ? Number(rawDuration.toFixed(1))
          : fallbackDuration;

      // 跳轉至 0.2 秒處擷取具有動作畫面的縮圖
      const targetTime = Math.min(0.25, validDuration * 0.2);
      try {
        video.currentTime = targetTime;
      } catch {
        finish({ duration: validDuration });
      }
    };

    video.onseeked = () => {
      const rawDuration = video.duration;
      const validDuration =
        Number.isFinite(rawDuration) && rawDuration > 0
          ? Number(rawDuration.toFixed(1))
          : fallbackDuration;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.78);
          finish({ duration: validDuration, thumbnailDataUrl });
          return;
        }
      } catch {
        // Ignore canvas taint or codec error and resolve duration only
      }
      finish({ duration: validDuration });
    };

    video.src = objectUrl;
  });
}
