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
    dotClass: 'bg-status-danger',
  },
  moderate: {
    label: '中度偏差',
    dotClass: 'bg-status-warning',
  },
  minor: {
    label: '微幅偏差',
    dotClass: 'bg-app-muted',
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
          <h3 className="text-heading-md font-semibold text-app-primary">
            動作細節檢討與教練修正處方 ({defects.length})
          </h3>
          <p className="text-caption text-app-muted mt-0.5">
            點選項目可將左側慢動作影片、Kinovea 角度疊加與時序曲線同步定位至該時間點
          </p>
        </div>
      </div>

      {defects.length === 0 ? (
        <div className="p-5 rounded-panel bg-app-well border border-app-border text-app-secondary text-body">
          本次動作所有關鍵特徵皆符合標準範圍。
        </div>
      ) : (
        <div className="space-y-3 pt-1">
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
                className={`w-full text-left p-4 rounded-panel border transition space-y-2.5 ${
                  isNearCurrentTime
                    ? 'bg-app-elevated border-brand-primary shadow-elevated'
                    : 'bg-app-elevated/60 border-app-border hover:bg-app-elevated hover:border-app-strong'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-control bg-app-well border border-app-border font-mono text-caption font-medium text-app-primary tabular-nums">
                      {defect.timestamp.toFixed(1)}s
                    </span>
                    <span className="text-title-sm font-semibold text-app-primary whitespace-nowrap shrink-0">
                      {JOINT_LABELS[defect.jointName] || defect.jointName}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-badge bg-app-well border border-app-border font-mono text-caption text-app-muted shrink-0">
                      {defect.jointName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-caption text-app-muted whitespace-nowrap shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${sev.dotClass}`} />
                      {sev.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between w-full sm:w-auto gap-2">
                    <div className="font-mono text-caption tabular-nums">
                      <span className="text-status-danger font-semibold">
                        實測 {defect.currentValue}{unitSuffix}
                      </span>
                      <span className="text-app-muted ml-1.5">
                        (標準 {defect.standardRange[0]}–{defect.standardRange[1]}{unitSuffix}
                        {delta !== 0 ? ` · 差 ${delta > 0 ? `+${delta}` : delta}${unitSuffix}` : ''})
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-caption text-brand-primary hover:text-brand-hover whitespace-nowrap shrink-0 font-medium">
                      定位檢視
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                <p className="text-body text-app-primary leading-relaxed">
                  {defect.message}
                </p>

                {defect.prescription && (
                  <div className="bg-app-well border-l-2 border-l-brand-primary rounded-control p-3.5 text-body text-app-secondary leading-relaxed">
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
