import React, { useEffect, useRef, useState } from 'react';
import {
  isRelativeFeature,
  type FrameKeypoints,
  type JointName,
} from '../../../types/martial-arts.types';

export interface ContainedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 計算 <video class="object-contain"> 在容器內實際顯示的影像區域（扣除上下或左右黑邊）。
 * 支援 16:9 橫式影片與 9:16 手機直式影片。
 */
export function computeContainedVideoRect(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number
): ContainedRect {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    videoWidth <= 0 ||
    videoHeight <= 0
  ) {
    return {
      left: 0,
      top: 0,
      width: Math.max(0, containerWidth),
      height: Math.max(0, containerHeight),
    };
  }

  const containerAspect = containerWidth / containerHeight;
  const videoAspect = videoWidth / videoHeight;

  if (videoAspect > containerAspect) {
    // 影片較寬（上下留黑邊 Letterbox）
    const width = containerWidth;
    const height = containerWidth / videoAspect;
    return {
      left: 0,
      top: (containerHeight - height) / 2,
      width,
      height,
    };
  }

  // 影片較窄或直式 9:16（左右留黑邊 Pillarbox）
  const height = containerHeight;
  const width = containerHeight * videoAspect;
  return {
    left: (containerWidth - width) / 2,
    top: 0,
    width,
    height,
  };
}

interface PoseCanvasOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  frames: FrameKeypoints[];
  currentTime: number;
  selectedJoint: JointName;
  actualAngle: number;
  isCompliant: boolean;
}

const SKELETON_EDGES: Array<[string, string]> = [
  // 簡化中心軸骨架 (Mock / OpenPose 風格)
  ['head', 'neck'],
  ['neck', 'hip'],
  ['neck', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['neck', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
  ['hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  // MediaPipe / COCO 17-keypoint 雙側肩髖骨架相容邊
  ['nose', 'left_shoulder'],
  ['nose', 'right_shoulder'],
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['right_shoulder', 'right_elbow'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['right_hip', 'right_knee'],
];

function resolveJointTriplet(
  kpMap: Map<string, { x: number; y: number }>,
  joint: JointName
): [
  { x: number; y: number } | undefined,
  { x: number; y: number } | undefined,
  { x: number; y: number } | undefined,
] {
  const getFirst = (...names: string[]) => {
    for (const n of names) {
      const found = kpMap.get(n);
      if (found) return found;
    }
    return undefined;
  };

  switch (joint) {
    case 'right_elbow':
    case 'right_elbow_deg':
      return [
        getFirst('right_shoulder', 'neck'),
        getFirst('right_elbow'),
        getFirst('right_wrist'),
      ];
    case 'left_elbow':
    case 'left_elbow_deg':
      return [
        getFirst('left_shoulder', 'neck'),
        getFirst('left_elbow'),
        getFirst('left_wrist'),
      ];
    case 'right_shoulder_deg':
      return [
        getFirst('right_elbow'),
        getFirst('right_shoulder', 'neck'),
        getFirst('right_hip', 'hip'),
      ];
    case 'left_shoulder_deg':
      return [
        getFirst('left_elbow'),
        getFirst('left_shoulder', 'neck'),
        getFirst('left_hip', 'hip'),
      ];
    case 'right_knee':
    case 'right_knee_deg':
      return [
        getFirst('right_hip', 'hip'),
        getFirst('right_knee'),
        getFirst('right_ankle'),
      ];
    case 'left_knee':
    case 'left_knee_deg':
      return [
        getFirst('left_hip', 'hip'),
        getFirst('left_knee'),
        getFirst('left_ankle'),
      ];
    case 'hip':
    case 'right_hip_deg':
      return [
        getFirst('right_shoulder', 'neck'),
        getFirst('right_hip', 'hip'),
        getFirst('right_knee'),
      ];
    case 'left_hip_deg':
      return [
        getFirst('left_shoulder', 'neck'),
        getFirst('left_hip', 'hip'),
        getFirst('left_knee'),
      ];
    case 'torso':
      return [
        getFirst('head', 'nose'),
        getFirst('neck', 'right_shoulder', 'left_shoulder'),
        getFirst('hip', 'right_hip', 'left_hip'),
      ];
    case 'right_wrist_x_rel':
    case 'right_wrist_y_rel':
      return [undefined, getFirst('right_wrist'), undefined];
    case 'left_wrist_x_rel':
    case 'left_wrist_y_rel':
      return [undefined, getFirst('left_wrist'), undefined];
    case 'right_knee_x_rel':
    case 'right_knee_y_rel':
      return [undefined, getFirst('right_knee'), undefined];
    case 'left_knee_x_rel':
    case 'left_knee_y_rel':
      return [undefined, getFirst('left_knee'), undefined];
    case 'right_ankle_x_rel':
    case 'right_ankle_y_rel':
      return [undefined, getFirst('right_ankle'), undefined];
    case 'left_ankle_x_rel':
    case 'left_ankle_y_rel':
      return [undefined, getFirst('left_ankle'), undefined];
    case 'stance_width_rel':
      return [undefined, getFirst('left_ankle', 'right_ankle', 'hip'), undefined];
  }
}

export const PoseCanvasOverlay: React.FC<PoseCanvasOverlayProps> = ({
  videoRef,
  frames,
  currentTime,
  selectedJoint,
  actualAngle,
  isCompliant,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rect, setRect] = useState<ContainedRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  // 監聽容器尺寸與影片 metadata 變化，精準對齊實際顯示畫面（扣除黑邊）
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const containerEl = videoEl.parentElement;
    if (!containerEl) return;

    const updateRect = () => {
      const cw = containerEl.clientWidth;
      const ch = containerEl.clientHeight;
      const vw = videoEl.videoWidth || 16;
      const vh = videoEl.videoHeight || 9;
      setRect(computeContainedVideoRect(cw, ch, vw, vh));
    };

    updateRect();
    videoEl.addEventListener('loadedmetadata', updateRect);
    videoEl.addEventListener('resize', updateRect);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateRect);
      observer.observe(containerEl);
    } else {
      window.addEventListener('resize', updateRect);
    }

    return () => {
      videoEl.removeEventListener('loadedmetadata', updateRect);
      videoEl.removeEventListener('resize', updateRect);
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', updateRect);
      }
    };
  }, [videoRef]);

  // 繪製當前幀骨架與所選關節量角器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rect.width <= 0 || rect.height <= 0 || frames.length === 0) {
      return;
    }

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 尋找距離 currentTime 最近的關鍵點幀
    const nearestFrame = frames.reduce((prev, curr) =>
      Math.abs(curr.t - currentTime) < Math.abs(prev.t - currentTime) ? curr : prev
    );

    const kpMap = new Map<string, { x: number; y: number }>();
    for (const kp of nearestFrame.keypoints) {
      if (kp.visibility !== undefined && kp.visibility < 0.2) continue;
      kpMap.set(kp.name, {
        x: kp.x * rect.width,
        y: kp.y * rect.height,
      });
    }

    // 1. 繪製基礎骨架連線
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(228, 228, 231, 0.55)';
    ctx.lineCap = 'round';
    for (const [fromName, toName] of SKELETON_EDGES) {
      const a = kpMap.get(fromName);
      const b = kpMap.get(toName);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // 2. 繪製各關鍵點圓點
    for (const pt of kpMap.values()) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250, 250, 250, 0.85)';
      ctx.fill();
    }

    // 3. 繪製當前選中關節的量角器弧線、角度數值與不合規紅色高亮
    const [parentPt, vertexPt, childPt] = resolveJointTriplet(kpMap, selectedJoint);
    if (!vertexPt) return;

    const accentColor = isCompliant ? '#10b981' : '#f43f5e';
    const accentFill = isCompliant
      ? 'rgba(16, 185, 129, 0.16)'
      : 'rgba(244, 63, 94, 0.20)';

    if (!isCompliant) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(vertexPt.x, vertexPt.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = accentFill;
      ctx.fill();
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = accentColor;
      ctx.stroke();
      ctx.restore();
    }

    if (parentPt && childPt) {
      // 高亮該關節兩條夾角骨骼臂
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(parentPt.x, parentPt.y);
      ctx.lineTo(vertexPt.x, vertexPt.y);
      ctx.lineTo(childPt.x, childPt.y);
      ctx.lineWidth = 2.75;
      ctx.strokeStyle = accentColor;
      ctx.stroke();

      // 量角器夾角扇形弧線
      const ang1 = Math.atan2(parentPt.y - vertexPt.y, parentPt.x - vertexPt.x);
      const ang2 = Math.atan2(childPt.y - vertexPt.y, childPt.x - vertexPt.x);
      let diff = ang2 - ang1;
      while (diff <= -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      const radius = 16;
      ctx.beginPath();
      ctx.moveTo(vertexPt.x, vertexPt.y);
      ctx.arc(
        vertexPt.x,
        vertexPt.y,
        radius,
        ang1,
        ang1 + diff,
        diff < 0
      );
      ctx.closePath();
      ctx.fillStyle = accentFill;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(
        vertexPt.x,
        vertexPt.y,
        radius,
        ang1,
        ang1 + diff,
        diff < 0
      );
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = accentColor;
      ctx.stroke();
      ctx.restore();
    }

    // 關節中心點與角度標籤
    ctx.beginPath();
    ctx.arc(vertexPt.x, vertexPt.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    const labelText = isRelativeFeature(selectedJoint)
      ? `${Number(actualAngle.toFixed(2))} rel`
      : `${actualAngle}°`;
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    const textWidth = ctx.measureText(labelText).width;
    const labelX = Math.min(rect.width - textWidth - 14, Math.max(6, vertexPt.x + 10));
    const labelY = Math.max(18, Math.min(rect.height - 8, vertexPt.y - 10));

    ctx.fillStyle = 'rgba(9, 9, 11, 0.82)';
    ctx.fillRect(labelX - 4, labelY - 11, textWidth + 8, 15);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(labelX - 4, labelY - 11, textWidth + 8, 15);
    ctx.fillStyle = accentColor;
    ctx.fillText(labelText, labelX, labelY);
  }, [rect, frames, currentTime, selectedJoint, actualAngle, isCompliant]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
      className="pointer-events-none absolute z-[5]"
    />
  );
};
