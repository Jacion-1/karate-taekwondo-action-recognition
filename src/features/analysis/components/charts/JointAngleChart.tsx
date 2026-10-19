import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import {
  JOINT_LABELS,
  type AngleTimeSeriesPoint,
  type DefectItem,
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
}

/**
 * 時序關節角度圖表 (Modern Minimalism)
 */
export const JointAngleChart: React.FC<JointAngleChartProps> = React.memo(
  ({
    seriesList,
    selectedJoint,
    onSelectJoint,
    currentTime,
    defects,
    onSeekToTime,
  }) => {
    const activeSeries = useMemo(() => {
      return (
        seriesList.find((s) => s.jointName === selectedJoint) ?? seriesList[0]
      );
    }, [seriesList, selectedJoint]);

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

    const snappedTime = Number(currentTime.toFixed(1));

    return (
      <div className="lab-card p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">
              關節角度時序曲線
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              點擊圖表任意時間點可同步定位左側慢動作影片
            </p>
          </div>

          {/* 乾淨的關節切換膠囊 */}
          <div className="flex flex-wrap items-center gap-1 bg-zinc-950/80 p-1 rounded-full border border-white/[0.06]">
            {seriesList.map((s) => {
              const active = s.jointName === activeSeries?.jointName;
              return (
                <button
                  key={s.jointName}
                  type="button"
                  onClick={() => onSelectJoint(s.jointName)}
                  className={`px-3.5 py-1 rounded-full text-xs font-medium transition ${
                    active
                      ? 'bg-white text-zinc-950'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {JOINT_LABELS[s.jointName] || s.jointName}
                </button>
              );
            })}
          </div>
        </div>

        {/* 極簡圖例 */}
        <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/25 border border-emerald-400/60 inline-block" />
            標準範圍
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3.5 h-0.5 bg-white inline-block" />
            實測角度
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            偏差標記
          </span>
        </div>

        <div className="h-64 w-full select-none">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
              onClick={(state) => {
                if (state && state.activeLabel !== undefined) {
                  const clickedTime = Number(state.activeLabel);
                  if (!Number.isNaN(clickedTime)) {
                    onSeekToTime(clickedTime);
                  }
                }
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                stroke="#52525b"
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit="s"
              />
              <YAxis
                domain={[40, 190]}
                stroke="#52525b"
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit="°"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: 'rgba(255,255,255,0.08)',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  color: '#f4f4f5',
                }}
                labelFormatter={(label) => `${label}s`}
              />

              {/* 標準容許範圍 [standardMin, standardMax] */}
              <Area
                type="monotone"
                dataKey="standardBand"
                name="標準範圍"
                fill="#10b981"
                fillOpacity={0.14}
                stroke="#10b981"
                strokeOpacity={0.35}
                strokeDasharray="3 3"
                isAnimationActive={false}
              />

              {/* 學員實測角度曲線（使用高對比純白線條，極簡俐落） */}
              <Line
                type="monotone"
                dataKey="actualAngle"
                name="實測角度"
                stroke="#ffffff"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#ffffff' }}
                isAnimationActive={false}
              />

              {/* 動態時間同步指針 */}
              <ReferenceLine
                x={snappedTime}
                stroke="#a1a1aa"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                label={{
                  value: `${snappedTime}s`,
                  position: 'insideTopRight',
                  fill: '#d4d4d8',
                  fontSize: 11,
                }}
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
        </div>
      </div>
    );
  }
);

JointAngleChart.displayName = 'JointAngleChart';
