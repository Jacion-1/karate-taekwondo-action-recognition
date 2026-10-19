import { useEffect, useState } from 'react';
import type { NetworkStatus } from '../../types/martial-arts.types';

/**
 * 監聽瀏覽器離線與連線狀態，並支援在開發驗證時手動切換「模擬離線模式」
 */
export function useNetworkStatus() {
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const networkStatus: NetworkStatus =
    browserOnline && !simulateOffline ? 'online' : 'offline';

  return {
    networkStatus,
    simulateOffline,
    toggleSimulateOffline: () => setSimulateOffline((prev) => !prev),
  };
}
