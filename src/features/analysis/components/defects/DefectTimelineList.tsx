import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import {
  JOINT_LABELS,
  isRelativeFeature,
  type DefectItem,
  type JointName,
  type SeverityLevel,
} from '../../../../types/martial-arts.types';

interface DefectTimelineListProps {
  defects: DefectItem[];
  currentTime: number;
  onSelectDefect: (timestamp: number, jointName: JointName) => void;
}

const SEVERITY_DOT: Record<
  SeverityLevel,
  { label: string; dotClass: string }
> = {
  critical: {
    label: '顯著偏差',
    dotClass: 'bg-rose-500',
  },
  moderate: {
    label: '中度偏差',
    dotClass: 'bg-amber-400',
  },
  minor: {
    label: '微幅偏差',
    dotClass: 'bg-zinc-400',
  },
};

/**
 * 動作細節檢討與具體修正處方列表 (Sensei AI / JAB AI Coaching Prescriptions)
 */
export const DefectTimelineList: React.FC<DefectTimelineListProps> = ({
  defects,
  currentTime,
  onSelectDefect,
}) => {
  return (
    <div className="lab-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">
            動作細節檢討與教練修正處方 ({defects.length})
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            點選項目可將左側慢動作影片、Kinovea 角度疊加與時序曲線同步定位至該時間點
          </p>
        </div>
      </div>

      {defects.length === 0 ? (
        <div className="p-5 rounded-xl bg-zinc-950/60 border border-white/[0.05] text-zinc-300 text-xs">
          本次動作所有關鍵特徵皆符合標準範圍。
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
          {defects.map((defect) => {
            const sev = SEVERITY_DOT[defect.severity];
            const isNearCurrentTime =
              Math.abs(currentTime - defect.timestamp) < 0.25;
            const isRel = isRelativeFeature(defect.jointName);
            const unitSuffix = isRel ? ' rel' : '°';
            const rawDelta =
              defect.currentValue < defect.standardRange[0]
                ? defect.currentValue - defect.standardRange[0]
                : defect.currentValue > defect.standardRange[1]
                  ? defect.currentValue - defect.standardRange[1]
                  : 0;
            const delta = isRel ? Number(rawDelta.toFixed(2)) : Math.round(rawDelta);

            return (
              <button
                key={defect.id}
                type="button"
                onClick={() =>
                  onSelectDefect(defect.timestamp, defect.jointName)
                }
                className={`w-full text-left py-4 px-3.5 -mx-3.5 rounded-xl transition space-y-2.5 ${
                  isNearCurrentTime
                    ? 'bg-zinc-800/75'
                    : 'hover:bg-zinc-900/70'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-zinc-950 border border-white/[0.07] font-mono text-xs font-medium text-zinc-200 tabular-nums">
                      {defect.timestamp.toFixed(1)}s
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {JOINT_LABELS[defect.jointName] || defect.jointName}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-900/80 border border-white/[0.05] font-mono text-[10px] text-zinc-400">
                      {defect.jointName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                      <span className={`w-1.5 h-1.5 rounded-full ${sev.dotClass}`} />
                      {sev.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="font-mono text-xs tabular-nums">
                      <span className="text-rose-400 font-semibold">
                        實測 {defect.currentValue}{unitSuffix}
                      </span>
                      <span className="text-zinc-500 ml-1.5">
                        (標準 {defect.standardRange[0]}–{defect.standardRange[1]}{unitSuffix}
                        {delta !== 0 ? ` · 差 ${delta > 0 ? `+${delta}` : delta}${unitSuffix}` : ''})
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-zinc-400">
                      定位檢視
                      <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  {defect.message}
                </p>

                {defect.prescription && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-zinc-950/70 border border-white/[0.06] text-xs text-zinc-300 leading-relaxed">
                    {defect.prescription}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

