import { describe, it, expect } from 'vitest';
import { fixWebmDuration } from '../webmDurationFix';
import { mapMediaStreamErrorToMessage } from '../../../features/recorder/hooks/useMediaStream';
import { getExtensionFromMimeType } from '../../../features/recorder/hooks/useMediaRecorder';

describe('Phase 4: WebM EBML duration patcher & media stream helpers', () => {
  it('injects Float64 Duration (0x4489) into a MediaRecorder-like WebM Info segment and preserves Cluster payload', async () => {
    // 模擬 Chrome MediaRecorder 輸出的精簡 EBML WebM 結構：
    // 1. EBML Header: ID 1A 45 DF A3, Size 84 (4 bytes), Body: 42 86 81 01
    // 2. Segment: ID 18 53 80 67, Size 01 FF FF FF FF FF FF FF (unknown length)
    // 3. Info: ID 15 49 A9 66, Size 87 (7 bytes), Body: TimecodeScale (2A D7 B1 83 0F 42 40 = 1,000,000)
    // 4. Cluster: ID 1F 43 B6 75, Size 84, Body: E7 81 00 AA
    const sampleWebm = new Uint8Array([
      0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x01,
      0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      0x15, 0x49, 0xa9, 0x66, 0x87, 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40,
      0x1f, 0x43, 0xb6, 0x75, 0x84, 0xe7, 0x81, 0x00, 0xaa,
    ]);

    const rawBlob = new Blob([sampleWebm], { type: 'video/webm' });
    const patchedBlob = await fixWebmDuration(rawBlob, 3.5);

    // 注入 11 bytes Duration 元素 + Info Size 由 1 byte 擴展為 4 bytes (+3 bytes) = +14 bytes
    expect(patchedBlob.size).toBe(sampleWebm.byteLength + 14);

    const patchedBytes = new Uint8Array(await patchedBlob.arrayBuffer());
    // 搜尋 Duration ID (0x44, 0x89, 0x88) 並驗證緊隨其後的 Float64 為 3500.0 (ms)
    let durationValue = -1;
    for (let i = 0; i < patchedBytes.length - 10; i += 1) {
      if (
        patchedBytes[i] === 0x44 &&
        patchedBytes[i + 1] === 0x89 &&
        patchedBytes[i + 2] === 0x88
      ) {
        const view = new DataView(
          patchedBytes.buffer,
          patchedBytes.byteOffset + i + 3,
          8
        );
        durationValue = view.getFloat64(0, false);
        break;
      }
    }
    expect(durationValue).toBeCloseTo(3500, 3);

    // 確認尾端 Cluster 資料完整保留
    expect(Array.from(patchedBytes.slice(-8))).toEqual([
      0x1f, 0x43, 0xb6, 0x75, 0x84, 0xe7, 0x81, 0x00, 0xaa,
    ].slice(-8));
  });

  it('returns non-WebM blobs unchanged', async () => {
    const mp4Bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const mp4Blob = new Blob([mp4Bytes], { type: 'video/mp4' });
    const result = await fixWebmDuration(mp4Blob, 4.2);
    expect(result.size).toBe(mp4Blob.size);
  });

  it('maps getUserMedia error names to Chinese messages', () => {
    expect(mapMediaStreamErrorToMessage({ name: 'NotAllowedError' })).toContain(
      '攝影機權限已被拒絕'
    );
    expect(mapMediaStreamErrorToMessage({ name: 'NotFoundError' })).toContain(
      '找不到可用的攝影機裝置'
    );
    expect(mapMediaStreamErrorToMessage({ name: 'NotReadableError' })).toContain(
      '攝影機正被其他應用程式佔用'
    );
    expect(
      mapMediaStreamErrorToMessage({ name: 'OverconstrainedError' })
    ).toContain('不支援所請求的解析度或鏡頭方向');
  });

  it('determines file extension from mimeType', () => {
    expect(getExtensionFromMimeType('video/mp4;codecs=avc1')).toBe('mp4');
    expect(getExtensionFromMimeType('video/webm;codecs=vp9')).toBe('webm');
  });
});
