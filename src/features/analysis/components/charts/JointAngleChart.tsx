import React, { useCallback, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import {
  FOCUS_FEATURE_METADATA,
  JOINT_LABELS,
  isRelativeFeature,
  type AngleTimeSeriesPoint,
  type DefectItem,
  type FocusFeatureCode,
  type JointAngleSeries,
  type JointName,
} from '../../../../types/martial-arts.types';

interface JointAngleChartProps {
  seriesList: JointAngleSeries[];
  selectedJoint: JointName;
  onSelectJoint: (joint: JointName) => void;
  currentTime: number;
  defects: DefectItem[];
  onSeekToTime: (seconds: number) => void;
  focusFeatures?: FocusFeatureCode[];
}

const TOOLTIP_CONTENT_STYLE: React.CSSProperties = {
  backgroundColor: '#18181b',
  borderColor: 'rgba(255,255,255,0.08)',
  borderRadius: '0.75rem',
  fontSize: '12px',
  color: '#f4f4f5',
};

const CHART_MARGIN = { top: 8, right: 12, left: 0, bottom: 0 };
const Y_AXIS_WIDTH = 48;

interface StaticRechartsLayerProps {
  chartData: AngleTimeSeriesPoint[];
  jointDefects: DefectItem[];
  isRelative: boolean;
  onSeekToTime: (seconds: number) => void;
}

/**
 * 靜態圖表資料層：僅在切換特徵、時序資料或瑕疵清單變動時重繪，
 * 播放期間 currentTime 以 60fps 更新時此組件完全不重繪。
 */
const StaticRechartsLayer: React.FC<StaticRechartsLayerProps> = React.memo(
  ({ chartData, jointDefects, isRelative, onSeekToTime }) => {
    const handleChartClick = useCallback(
      (state: { activeLabel?: string | number } | null | undefined) => {
        if (state && state.activeLabel !== undefined) {
          const clickedTime = Number(state.activeLabel);
          if (!Number.isNaN(clickedTime)) {
            onSeekToTime(clickedTime);
          }
        }
      },
      [onSeekToTime]
    );

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={CHART_MARGIN}
          onClick={handleChartClick}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            stroke="#52525b"
            tick={{ fill: '#71717a', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            unit="s"
          />
          <YAxis
            width={Y_AXIS_WIDTH}
            domain={isRelative ? ['auto', 'auto'] : [30, 190]}
            stroke="#52525b"
            tick={{ fill: '#71717a', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            unit={isRelative ? '' : '°'}
          />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelFormatter={(label) => `${label}s`}
          />

          {/* 標準容許範圍 [standardMin, standardMax] */}
          <Area
            type="monotone"
            dataKey="standardBand"
            name={isRelative ? '標準相對範圍 (rel)' : '標準角度範圍 (°)'}
            fill="#10b981"
            fillOpacity={0.14}
            stroke="#10b981"
            strokeOpacity={0.35}
            strokeDasharray="3 3"
            isAnimationActive={false}
          />

          {/* 學員實測特徵曲線（使用高對比純白線條，極簡俐落） */}
          <Line
            type="monotone"
            dataKey="actualAngle"
            name={isRelative ? '實測相對位置 (rel)' : '實測角度 (°)'}
            stroke="#ffffff"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#ffffff' }}
            isAnimationActive={false}
          />

          {/* 瑕疵點 */}
          {jointDefects.map((defect) => (
            <ReferenceDot
              key={defect.id}
              x={Number(defect.timestamp.toFixed(1))}
              y={defect.currentValue}
              r={5}
              fill="#f43f5e"
              stroke="#09090b"
              strokeWidth={2}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }
);
StaticRechartsLayer.displayName = 'StaticRechartsLayer';

interface PlayheadCursorProps {
  currentTime: number;
  minTime: number;
  maxTime: number;
}

/**
 * 獨立輕量時間游標小元件：承載高頻 currentTime 更新，避免觸發 Recharts SVG 重新計算。
 */
const PlayheadCursor: React.FC<PlayheadCursorProps> = React.memo(
  ({ currentTime, minTime, maxTime }) => {
    const span = Math.max(0.1, maxTime - minTime);
    const ratio = Math.max(0, Math.min(1, (currentTime - minTime) / span));
    const percent = ratio * 100;

    return (
      <div
        className="pointer-events-none absolute top-2 bottom-7"
        style={{
          left: `${Y_AXIS_WIDTH}px`,
          right: `${CHART_MARGIN.right}px`,
        }}
      >
        <div
          className="absolute top-0 bottom-0 border-l border-dashed border-zinc-400/80"
          style={{ left: `${percent}%` }}
        >
          <span className="absolute top-0.5 left-1 px-1 py-0.5 rounded bg-zinc-950/90 text-[10px] font-mono text-zinc-300 tabular-nums whitespace-nowrap">
            {currentTime.toFixed(2)}s
          </span>
        </div>
      </div>
    );
  }
);
PlayheadCursor.displayName = 'PlayheadCursor';

/**
 * 時序關鍵特徵圖表 (支援 *_deg 夾角與 *_rel 相對位置雙單位切換)
 */
export const JointAngleChart: React.FC<JointAngleChartProps> = React.memo(
  ({
    seriesList,
    selectedJoint,
    onSelectJoint,
    currentTime,
    defects,
    onSeekToTime,
    focusFeatures,
  }) => {
    const activeSeries = useMemo(() => {
      return (
        seriesList.find((s) => s.jointName === selectedJoint) ?? seriesList[0]
      );
    }, [seriesList, selectedJoint]);

    const activeFeatureName = activeSeries?.jointName ?? selectedJoint;
    const isRelative = isRelativeFeature(activeFeatureName);
    const csvMeta =
      activeFeatureName in FOCUS_FEATURE_METADATA
        ? FOCUS_FEATURE_METADATA[activeFeatureName as FocusFeatureCode]
        : undefined;

    const chartData = useMemo(() => {
      if (!activeSeries) return [];
      return activeSeries.points.map((pt: AngleTimeSeriesPoint) => ({
        ...pt,
        standardBand: [pt.standardMin, pt.standardMax] as [number, number],
      }));
    }, [activeSeries]);

    const jointDefects = useMemo(
      () => defects.filter((d) => d.jointName === activeSeries?.jointName),
      [defects, activeSeries]
    );

    const { minTime, maxTime } = useMemo(() => {
      if (chartData.length === 0) return { minTime: 0, maxTime: 3.2 };
      return {
        minTime: chartData[0].time,
        maxTime: chartData[chartData.length - 1].time,
      };
    }, [chartData]);

    return (
      <div className="lab-card p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                關鍵特徵時序曲線 (focus_feature_1~4)
              </h3>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/[0.06] font-mono text-[10px] text-zinc-400">
                {activeFeatureName}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {csvMeta
                ? `計算方式：${csvMeta.formula} · 推薦情境：${csvMeta.scenario}（左右為選手自身之左右）`
                : '點擊圖表任意時間點可同步定位左側慢動作影片'}
            </p>
          </div>

          {/* 關鍵特徵切換膠囊 (對應 CSV focus_feature_1 ~ 4) */}
          <div className="flex flex-wrap items-center gap-1 bg-zinc-950/80 p-1 rounded-2xl border border-white/[0.06]">
            {seriesList.map((s) => {
              const active = s.jointName === activeSeries?.jointName;
              const focusIdx = focusFeatures
                ? focusFeatures.indexOf(s.jointName as FocusFeatureCode)
                : -1;
              return (
                <button
                  key={s.jointName}
                  type="button"
                  onClick={() => onSelectJoint(s.jointName)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-white text-zinc-950'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {focusIdx >= 0 && (
                    <span
                      className={`text-[10px] font-mono ${
                        active ? 'text-zinc-700 font-semibold' : 'text-zinc-500'
                      }`}
                    >
                      F{focusIdx + 1}
                    </span>
                  )}
                  <span>{JOINT_LABELS[s.jointName] || s.jointName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 極簡圖例 */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-400">
          <div className="flex flex-wrap items-center gap-6">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/25 border border-emerald-400/60 inline-block" />
              {isRelative ? '標準相對範圍 (rel)' : '標準角度範圍 (°)'}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-3.5 h-0.5 bg-white inline-block" />
              {isRelative ? '實測相對位置／軀幹比 (rel)' : '實測關節夾角 (°)'}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              偏差標記
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            {isRelative
              ? '單位：相對髖中心／軀幹尺度比值 (y_rel 向下增加)'
              : '單位：關節夾角度數 (°)'}
          </span>
        </div>

        <div className="relative h-64 w-full select-none">
          <StaticRechartsLayer
            chartData={chartData}
            jointDefects={jointDefects}
            isRelative={isRelative}
            onSeekToTime={onSeekToTime}
          />
          <PlayheadCursor
            currentTime={currentTime}
            minTime={minTime}
            maxTime={maxTime}
          />
        </div>
      </div>
    );
  }
);

JointAngleChart.displayName = 'JointAngleChart';

