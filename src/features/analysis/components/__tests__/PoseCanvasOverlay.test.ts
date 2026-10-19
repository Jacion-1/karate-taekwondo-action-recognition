import { describe, it, expect } from 'vitest';
import { computeContainedVideoRect } from '../PoseCanvasOverlay';

describe('computeContainedVideoRect (object-contain video alignment)', () => {
  it('fills container when video aspect ratio matches 16:9 container', () => {
    const rect = computeContainedVideoRect(640, 360, 1280, 720);
    expect(rect).toEqual({
      left: 0,
      top: 0,
      width: 640,
      height: 360,
    });
  });

  it('computes centered pillarbox rect for vertical 9:16 mobile video inside 16:9 container', () => {
    // 16:9 container: 640 x 360; 9:16 vertical phone video: 720 x 1280 (aspect = 0.5625)
    // Displayed height = 360, displayed width = 360 * 0.5625 = 202.5, left = (640 - 202.5) / 2 = 218.75
    const rect = computeContainedVideoRect(640, 360, 720, 1280);
    expect(rect.top).toBe(0);
    expect(rect.height).toBe(360);
    expect(rect.width).toBeCloseTo(202.5, 3);
    expect(rect.left).toBeCloseTo(218.75, 3);
  });

  it('computes centered letterbox rect for ultra-wide 21:9 video inside 16:9 container', () => {
    const rect = computeContainedVideoRect(640, 360, 2100, 900);
    expect(rect.left).toBe(0);
    expect(rect.width).toBe(640);
    expect(rect.height).toBeCloseTo(274.2857, 3);
    expect(rect.top).toBeCloseTo((360 - 274.2857) / 2, 3);
  });
});
