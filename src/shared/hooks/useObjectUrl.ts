import { useEffect, useState } from 'react';

/**
 * 嚴格遵守架構規範 2：
 * 透過瀏覽器生成的預覽物件位址 (ObjectURL)，必須在組件銷毀或影片切換時明確調用釋放函式，避免記憶體洩漏。
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    setObjectUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  return objectUrl;
}
