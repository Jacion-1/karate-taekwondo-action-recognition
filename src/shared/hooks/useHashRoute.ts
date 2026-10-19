import { useCallback, useEffect, useState } from 'react';
import { ACTION_METADATA, type ActionType } from '../../types/martial-arts.types';

export type RoutePage = 'record' | 'vault' | 'analysis';

export interface ParsedHashRoute {
  page: RoutePage;
  focusAction: ActionType | 'auto';
  analysisId?: string;
  videoId?: string;
}

function isValidActionType(val: string | null): val is ActionType {
  return Boolean(val && val in ACTION_METADATA);
}

/**
 * 解析瀏覽器 location.hash：
 * - `#/record` 或 `#/record?focus=roundhouse_kick`
 * - `#/vault`
 * - `#/report/:analysisId`（選填 `?videoId=...`）
 */
export function parseHashRoute(hashStr: string): ParsedHashRoute {
  const cleaned = hashStr.replace(/^#/, '').trim();
  if (!cleaned || cleaned === '/') {
    return { page: 'record', focusAction: 'auto' };
  }

  const [pathPart, queryPart = ''] = cleaned.split('?');
  const params = new URLSearchParams(queryPart);

  if (pathPart === '/vault' || pathPart.startsWith('/vault/')) {
    return { page: 'vault', focusAction: 'auto' };
  }

  const reportMatch = pathPart.match(/^\/report\/([^/?#]+)/);
  if (reportMatch && reportMatch[1]) {
    const analysisId = decodeURIComponent(reportMatch[1]);
    const videoId = params.get('videoId') || undefined;
    return {
      page: 'analysis',
      focusAction: 'auto',
      analysisId,
      videoId,
    };
  }

  const focusParam = params.get('focus');
  const focusAction: ActionType | 'auto' = isValidActionType(focusParam)
    ? focusParam
    : 'auto';

  return {
    page: 'record',
    focusAction,
  };
}

export function buildHashUrl(
  route:
    | { page: 'record'; focusAction?: ActionType | 'auto' }
    | { page: 'vault' }
    | { page: 'analysis'; analysisId: string; videoId?: string }
): string {
  if (route.page === 'vault') {
    return '#/vault';
  }
  if (route.page === 'analysis') {
    const base = `#/report/${encodeURIComponent(route.analysisId)}`;
    return route.videoId
      ? `${base}?videoId=${encodeURIComponent(route.videoId)}`
      : base;
  }
  if (route.focusAction && route.focusAction !== 'auto') {
    return `#/record?focus=${encodeURIComponent(route.focusAction)}`;
  }
  return '#/record';
}

export function useHashRoute() {
  const [route, setRoute] = useState<ParsedHashRoute>(() =>
    typeof window !== 'undefined'
      ? parseHashRoute(window.location.hash)
      : { page: 'record', focusAction: 'auto' }
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 初次載入若無 hash，使用 replaceState 正規化為 #/record 不污染返回歷史
    if (!window.location.hash || window.location.hash === '#') {
      window.history.replaceState(null, '', '#/record');
    }

    const syncFromHash = () => {
      setRoute(parseHashRoute(window.location.hash));
    };

    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('popstate', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('popstate', syncFromHash);
    };
  }, []);

  const navigateToRecord = useCallback((focusAction: ActionType | 'auto' = 'auto') => {
    const targetHash = buildHashUrl({ page: 'record', focusAction });
    if (typeof window !== 'undefined' && window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    } else {
      setRoute({ page: 'record', focusAction });
    }
  }, []);

  const navigateToVault = useCallback(() => {
    const targetHash = buildHashUrl({ page: 'vault' });
    if (typeof window !== 'undefined' && window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    } else {
      setRoute((prev) => ({ ...prev, page: 'vault' }));
    }
  }, []);

  const navigateToReport = useCallback((analysisId: string, videoId?: string) => {
    const targetHash = buildHashUrl({ page: 'analysis', analysisId, videoId });
    if (typeof window !== 'undefined' && window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    } else {
      setRoute({ page: 'analysis', focusAction: 'auto', analysisId, videoId });
    }
  }, []);

  return {
    route,
    navigateToRecord,
    navigateToVault,
    navigateToReport,
  };
}
