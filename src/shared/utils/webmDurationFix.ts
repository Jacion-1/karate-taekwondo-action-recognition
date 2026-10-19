/**
 * 修補 Chrome MediaRecorder 產生的 WebM 檔案缺少 EBML Info.Duration (0x4489) 的問題。
 *
 * Chrome MediaRecorder 以串流方式寫出 WebM 時，Segment 為未知長度 (0x01FFFFFFFFFFFFFF)，
 * 且 Info 區段 (0x1549A966) 內未寫入 Duration (0x4489)，導致 <video> 載入後
 * video.duration === Infinity 且無法正常拖曳時間軸 (seek)。
 *
 * 本函式僅讀取並解析開頭 8 KB 標頭區段，於 Info 區段內注入或覆寫 Float64 Duration (毫秒)，
 * 並以 Blob.slice 零拷貝拼接剩餘的叢集資料 (Cluster)。若輸入非 WebM 或結構不符則原樣回傳。
 */

const EBML_ID = 0x1a45dfa3;
const SEGMENT_ID = 0x18538067;
const INFO_ID = 0x1549a966;
const TIMECODE_SCALE_ID = 0x2ad7b1;
const DURATION_ID = 0x4489;

interface VintResult {
  /** 含前導位元的原始數值（常用於 Element ID） */
  raw: number;
  /** 去除前導長度位元後的資料長度（常用於 Element Size），若為全 1 未知長度則為 -1 */
  value: number;
  /** 此 VINT 佔用的位元組數 (1~8) */
  byteLength: number;
}

function readVint(bytes: Uint8Array, offset: number): VintResult | null {
  if (offset >= bytes.length) return null;
  const first = bytes[offset];
  if (first === 0) return null;

  let byteLength = 1;
  let mask = 0x80;
  while (byteLength <= 8 && (first & mask) === 0) {
    byteLength += 1;
    mask >>= 1;
  }
  if (byteLength > 8 || offset + byteLength > bytes.length) {
    return null;
  }

  let raw = first;
  let value = first & (mask - 1);
  let allOnes = value === mask - 1;

  for (let i = 1; i < byteLength; i += 1) {
    const b = bytes[offset + i];
    raw = raw * 256 + b;
    value = value * 256 + b;
    if (b !== 0xff) {
      allOnes = false;
    }
  }

  return {
    raw,
    value: allOnes ? -1 : value,
    byteLength,
  };
}

/**
 * 將資料長度編碼為 4-byte EBML VINT（上限 256 MB，足以容納 Info 區段）
 */
function encodeVint4(size: number): Uint8Array {
  const v = (0x10000000 | (size & 0x0fffffff)) >>> 0;
  return new Uint8Array([
    (v >>> 24) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 8) & 0xff,
    v & 0xff,
  ]);
}

function encodeDurationElement(durationUnits: number): Uint8Array {
  // Duration ID = 0x4489, Size = 0x88 (8 bytes Float64)
  const buf = new ArrayBuffer(11);
  const bytes = new Uint8Array(buf);
  bytes[0] = 0x44;
  bytes[1] = 0x89;
  bytes[2] = 0x88;
  const view = new DataView(buf, 3, 8);
  view.setFloat64(0, durationUnits, false);
  return bytes;
}

function readUintBE(bytes: Uint8Array, offset: number, length: number): number {
  let val = 0;
  for (let i = 0; i < length; i += 1) {
    val = val * 256 + bytes[offset + i];
  }
  return val;
}

export async function fixWebmDuration(
  blob: Blob,
  durationSeconds: number
): Promise<Blob> {
  if (
    !blob ||
    blob.size < 16 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return blob;
  }

  try {
    const headerSliceSize = Math.min(blob.size, 8192);
    const headerBuffer = await blob.slice(0, headerSliceSize).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);

    // 1. 驗證頂層 EBML Header (0x1A45DFA3)
    const ebmlId = readVint(bytes, 0);
    if (!ebmlId || ebmlId.raw !== EBML_ID) {
      return blob;
    }
    const ebmlSize = readVint(bytes, ebmlId.byteLength);
    if (!ebmlSize || ebmlSize.value < 0) {
      return blob;
    }

    let cursor = ebmlId.byteLength + ebmlSize.byteLength + ebmlSize.value;

    // 2. 尋找 Segment (0x18538067)
    const segmentId = readVint(bytes, cursor);
    if (!segmentId || segmentId.raw !== SEGMENT_ID) {
      return blob;
    }
    const segmentSize = readVint(bytes, cursor + segmentId.byteLength);
    if (!segmentSize) {
      return blob;
    }
    cursor += segmentId.byteLength + segmentSize.byteLength;

    // 3. 在 Segment 前段尋找 Info (0x1549A966)
    let infoStart = -1;
    let infoContentStart = -1;
    let infoContentEnd = -1;

    while (cursor < bytes.length) {
      const elId = readVint(bytes, cursor);
      if (!elId) break;
      const elSize = readVint(bytes, cursor + elId.byteLength);
      if (!elSize || elSize.value < 0) break;

      const contentStart = cursor + elId.byteLength + elSize.byteLength;
      const contentEnd = contentStart + elSize.value;
      if (contentEnd > bytes.length) break;

      if (elId.raw === INFO_ID) {
        infoStart = cursor;
        infoContentStart = contentStart;
        infoContentEnd = contentEnd;
        break;
      }
      cursor = contentEnd;
    }

    if (infoStart < 0 || infoContentStart < 0 || infoContentEnd < 0) {
      return blob;
    }

    // 4. 解析 Info 內部子元素，保留除舊 Duration 以外的元素並讀取 TimecodeScale
    let timecodeScale = 1_000_000; // 預設 1,000,000 ns = 1 ms
    const keptChunks: Uint8Array[] = [];
    let infoCursor = infoContentStart;

    while (infoCursor < infoContentEnd) {
      const childId = readVint(bytes, infoCursor);
      if (!childId) break;
      const childSize = readVint(bytes, infoCursor + childId.byteLength);
      if (!childSize || childSize.value < 0) break;

      const childValueStart =
        infoCursor + childId.byteLength + childSize.byteLength;
      const childEnd = childValueStart + childSize.value;
      if (childEnd > infoContentEnd) break;

      if (childId.raw === TIMECODE_SCALE_ID && childSize.value <= 8) {
        const parsedScale = readUintBE(bytes, childValueStart, childSize.value);
        if (parsedScale > 0) {
          timecodeScale = parsedScale;
        }
        keptChunks.push(bytes.subarray(infoCursor, childEnd));
      } else if (childId.raw === DURATION_ID) {
        // 略過既有的 Duration，稍後統一寫入新的 Float64 Duration
      } else {
        keptChunks.push(bytes.subarray(infoCursor, childEnd));
      }

      infoCursor = childEnd;
    }

    // 以 TimecodeScale 換算 Duration 單位（當 TimecodeScale = 1,000,000 時即為毫秒）
    const durationNs = durationSeconds * 1_000_000_000;
    const durationUnits = durationNs / timecodeScale;
    const durationElement = encodeDurationElement(durationUnits);
    keptChunks.push(durationElement);

    const newInfoBodyLength = keptChunks.reduce(
      (sum, part) => sum + part.byteLength,
      0
    );
    const infoIdBytes = new Uint8Array([0x15, 0x49, 0xa9, 0x66]);
    const infoSizeBytes = encodeVint4(newInfoBodyLength);

    return new Blob(
      [
        bytes.subarray(0, infoStart),
        infoIdBytes,
        infoSizeBytes,
        ...keptChunks,
        blob.slice(infoContentEnd),
      ],
      { type: blob.type || 'video/webm' }
    );
  } catch {
    return blob;
  }
}
