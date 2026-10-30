import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Filter,
  TrendingUp,
  Award,
  Activity,
  ArrowUpRight,
  User,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  ACTION_METADATA,
  type ActionType,
  type HistoryRecordMeta,
  type UserSession,
} from '../../../types/martial-arts.types';

export interface MemberHistorySectionProps {
  userSession: UserSession;
  historyRecords: HistoryRecordMeta[];
  onOpenAnalysis: (videoId: string, analysisId: string) => void;
  onLoginAsMember: () => void;
}

type DateRangePreset = 'all' | '7d' | '30d' | 'custom';

interface ChartPoint {
  id: string;
  createdAt: number;
  dateLabel: string;
  fullTime: string;
  actionLabel: string;
  totalScore: number;
  grade: string;
  defectCount: number;
  videoRetentionStatus: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}

const CustomChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isPurged = data.videoRetentionStatus === 'expired_purged';
    return (
      <div className="bg-app-surface/95 border border-app-border p-3 rounded-panel shadow-card text-caption space-y-1.5 backdrop-blur-md">
        <div className="text-app-muted font-mono text-caption">{data.fullTime}</div>
        <div className="text-app-primary font-medium flex items-center justify-between gap-3">
          <span>{data.actionLabel}</span>
          <span className="font-mono text-brand-primary font-semibold tabular-nums">
            {data.totalScore} 分 (Grade {data.grade})
          </span>
        </div>
        <div className="text-app-muted text-caption flex items-center justify-between gap-3 pt-1 border-t border-app-subtle">
          <span>瑕疵修正：{data.defectCount} 項</span>
          <span className={isPurged ? 'text-app-muted font-mono' : 'text-status-success font-mono'}>
            {isPurged ? '視訊已過期（數據保留）' : '視訊可播放'}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const MemberHistorySection: React.FC<MemberHistorySectionProps> = ({
  userSession,
  historyRecords,
  onOpenAnalysis,
  onLoginAsMember,
}) => {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<ActionType | 'all'>('all');

  // 無條件執行所有 React Hooks，確保符合 Rules of Hooks
  const filteredRecords = useMemo(() => {
    if (userSession.authStatus === 'guest') return [];
    const now = Date.now();
    return historyRecords.filter((rec) => {
      // 動作類別過濾
      if (actionFilter !== 'all' && rec.actionType !== actionFilter) {
        return false;
      }

      // 日期區間過濾
      if (datePreset === '7d') {
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        if (rec.createdAt < sevenDaysAgo) return false;
      } else if (datePreset === '30d') {
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        if (rec.createdAt < thirtyDaysAgo) return false;
      } else if (datePreset === 'custom') {
        if (startDate) {
          const startMs = new Date(startDate).setHours(0, 0, 0, 0);
          if (rec.createdAt < startMs) return false;
        }
        if (endDate) {
          const endMs = new Date(endDate).setHours(23, 59, 59, 999);
          if (rec.createdAt > endMs) return false;
        }
      }
      return true;
    });
  }, [userSession.authStatus, historyRecords, actionFilter, datePreset, startDate, endDate]);

  // 統計指標
  const stats = useMemo(() => {
    const totalCount = filteredRecords.length;
    if (totalCount === 0) {
      return { totalCount: 0, avgScore: 0, maxScore: 0 };
    }
    let sum = 0;
    let max = -Infinity;
    for (const r of filteredRecords) {
      sum += r.totalScore;
      if (r.totalScore > max) max = r.totalScore;
    }
    return {
      totalCount,
      avgScore: Math.round(sum / totalCount),
      maxScore: max === -Infinity ? 0 : max,
    };
  }, [filteredRecords]);

  // 走勢圖資料（依 createdAt 由舊到新升序排列）
  const chartData: ChartPoint[] = useMemo(() => {
    return [...filteredRecords]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((item, index) => {
        const d = new Date(item.createdAt);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return {
          id: `${item.analysisId}-${index}`,
          createdAt: item.createdAt,
          dateLabel: dateStr,
          fullTime: `${d.toLocaleDateString()} ${timeStr}`,
          actionLabel: ACTION_METADATA[item.actionType]?.label ?? item.actionType,
          totalScore: item.totalScore,
          grade: item.grade ?? 'B',
          defectCount: item.defectCount,
          videoRetentionStatus: item.videoRetentionStatus,
        };
      });
  }, [filteredRecords]);

  // 若為訪客模式，渲染深色引導卡片
  if (userSession.authStatus === 'guest') {
    return (
      <div className="lab-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-warning shrink-0" />
            <h3 className="text-title-sm font-semibold text-app-primary">免登入訪客模式</h3>
          </div>
          <p className="text-body text-app-muted leading-relaxed">
            目前為免登入訪客模式 — 訓練分析與視訊僅留存於當前頁面記憶體，返回首頁或重新整理後自動銷毀。登入正式會員即可自動持久化保存每次結構化評估數據，並解鎖日期區間檢索與長期分數走勢圖（原始視訊檔案保留 7 天後自動清理）。
          </p>
        </div>
        <button
          type="button"
          onClick={onLoginAsMember}
          className="btn-primary whitespace-nowrap shrink-0"
        >
          <User className="w-3.5 h-3.5" />
          <span>切換為正式會員</span>
        </button>
      </div>
    );
  }

  const allActions = Object.keys(ACTION_METADATA) as ActionType[];

  return (
    <div className="lab-card p-5 sm:p-6 space-y-6">
      {/* 標題與永久留存標記 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-app-subtle">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-4 h-4 text-brand-primary" />
          <h2 className="text-heading-md font-semibold text-app-primary leading-snug">
            正式會員長期動作評分走勢與歷史紀錄
          </h2>
        </div>

        <div className="flex items-center gap-2 text-caption font-mono text-app-muted">
          <ShieldCheck className="w-3.5 h-3.5 text-status-success" />
          <span>結構化評分數據永久保留 · 原始視訊 7 天自動清理</span>
        </div>
      </div>

      {/* 摘要數據指標列 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-panel bg-app-well border border-app-border">
          <div className="text-caption text-app-muted flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-app-muted" />
            <span>累計訓練次數</span>
          </div>
          <div className="mt-1 text-metric-lg font-bold font-mono text-app-primary tabular-nums">
            {stats.totalCount}{' '}
            <span className="text-body font-normal text-app-muted font-sans">次</span>
          </div>
        </div>

        <div className="p-4 rounded-panel bg-app-well border border-app-border">
          <div className="text-caption text-app-muted flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-brand-primary" />
            <span>平均動作評分</span>
          </div>
          <div className="mt-1 text-metric-lg font-bold font-mono text-brand-primary tabular-nums">
            {stats.avgScore}{' '}
            <span className="text-body font-normal text-app-muted font-sans">分</span>
          </div>
        </div>

        <div className="p-4 rounded-panel bg-app-well border border-app-border col-span-2 sm:col-span-1">
          <div className="text-caption text-app-muted flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-status-warning" />
            <span>歷史最高評分</span>
          </div>
          <div className="mt-1 text-metric-lg font-bold font-mono text-app-primary tabular-nums">
            {stats.maxScore}{' '}
            <span className="text-body font-normal text-app-muted font-sans">分</span>
          </div>
        </div>
      </div>

      {/* 篩選控制列：日期快捷 + 自訂日期 + 動作類別選單 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {/* 日期區間篩選 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-caption text-app-muted mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-app-muted" />
            時間：
          </span>
          {(['all', '7d', '30d', 'custom'] as DateRangePreset[]).map((preset) => {
            const labelMap: Record<DateRangePreset, string> = {
              all: '全部時間',
              '7d': '近 7 天',
              '30d': '近 30 天',
              custom: '自訂日期',
            };
            const isActive = datePreset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1 rounded-control text-caption font-medium transition ${
                  isActive
                    ? 'bg-brand-primary text-white font-semibold shadow-brand'
                    : 'bg-app-well hover:bg-app-elevated text-app-muted hover:text-app-primary border border-app-border'
                }`}
              >
                {labelMap[preset]}
              </button>
            );
          })}

          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5 ml-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-app-well border border-app-border rounded-control px-2 py-0.5 text-caption text-app-primary focus:outline-none focus:border-brand-primary"
              />
              <span className="text-app-muted text-caption">至</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-app-well border border-app-border rounded-control px-2 py-0.5 text-caption text-app-primary focus:outline-none focus:border-brand-primary"
              />
            </div>
          )}
        </div>

        {/* 動作類別選單 */}
        <div className="flex items-center gap-2">
          <span className="text-caption text-app-muted flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-app-muted" />
            動作：
          </span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as ActionType | 'all')}
            className="bg-app-well border border-app-border rounded-control px-3 py-1 text-caption text-app-primary focus:outline-none focus:border-brand-primary cursor-pointer"
          >
            <option value="all">全部動作 (不限專項)</option>
            {allActions.map((action) => (
              <option key={action} value={action}>
                {ACTION_METADATA[action].label} ({ACTION_METADATA[action].martialArt})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 長期分數走勢圖 (Recharts) */}
      <div className="pt-2">
        <div className="flex items-center justify-between text-caption text-app-muted mb-2">
          <span>分數走勢曲線（按時間順序）</span>
          <span>評分標準：0 - 100 分</span>
        </div>
        <div className="h-60 w-full rounded-panel bg-app-well border border-app-border p-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1E2B3E" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#94A3B8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#1E2B3E' }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#94A3B8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#1E2B3E' }}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="totalScore"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#scoreTrendGradient)"
                  dot={{ r: 3, fill: '#3B82F6', stroke: '#0D131D', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: '#60A5FA', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-caption text-app-muted font-mono">
              目前篩選範圍內尚無歷史評估成績
            </div>
          )}
        </div>
      </div>

      {/* 結構化歷史成績明細列表 */}
      <div className="pt-2 space-y-2.5">
        <div className="flex items-center justify-between text-caption text-app-muted">
          <span className="font-medium text-app-primary">歷史評估明細（共 {filteredRecords.length} 筆）</span>
          <span className="text-caption text-app-muted">依訓練時間由新至舊排序</span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-caption text-app-muted rounded-panel bg-app-well border border-app-border">
            無符合條件的歷史成績紀錄
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredRecords.map((item) => {
              const isPurged = item.videoRetentionStatus === 'expired_purged';
              const actionMeta = ACTION_METADATA[item.actionType];
              const dateObj = new Date(item.createdAt);
              const dateStr = dateObj.toLocaleDateString();
              const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={item.analysisId}
                  className="p-3.5 rounded-panel bg-app-surface/60 hover:bg-app-elevated border border-app-border hover:border-app-strong flex flex-wrap items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-caption text-app-muted shrink-0">
                      {dateStr} {timeStr}
                    </span>
                    <span className="text-caption font-semibold text-app-primary">
                      {actionMeta?.label ?? item.actionType}
                    </span>
                    <span className="text-caption text-app-muted">
                      {actionMeta?.martialArt}
                    </span>
                    <span className="px-2 py-0.5 rounded-badge bg-brand-primary/15 border border-brand-primary/30 text-caption font-mono font-medium text-blue-300 tabular-nums">
                      {item.totalScore} 分 · Grade {item.grade ?? 'B'}
                    </span>
                    <span className="text-caption text-app-muted font-mono">
                      瑕疵修正：{item.defectCount} 項
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-badge text-caption font-mono shrink-0 ${
                        isPurged
                          ? 'bg-app-well text-app-muted border border-app-border'
                          : 'bg-status-success/15 text-status-success border border-status-success/30'
                      }`}
                    >
                      {isPurged ? '視訊保存期限已過（數據仍保留）' : '視訊有效（7 天內）'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenAnalysis(item.videoId, item.analysisId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-app-elevated hover:bg-slate-700/80 border border-app-border text-app-primary text-caption font-medium whitespace-nowrap shrink-0 transition"
                  >
                    <span>查看完整報告</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-app-muted" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
