// PNG chunk 结构工具
// PNG 文件格式: 8-byte signature → [4-byte length][4-byte type][data][4-byte CRC]...

const textDecoder = new TextDecoder();

export interface PNGChunk {
  type: string;
  data: Uint8Array;
}

/**
 * 解析 PNG 文件的全部 chunk
 */
export function parsePNGChunks(buffer: ArrayBuffer): PNGChunk[] {
  const bytes = new Uint8Array(buffer);
  const chunks: PNGChunk[] = [];

  // 跳过 8-byte PNG signature
  let offset = 8;

  while (offset < bytes.length) {
    // 4-byte data length (big-endian)
    const dataLength =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    offset += 4;

    // 4-byte chunk type
    const type = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    offset += 4;

    // chunk data
    const data = bytes.slice(offset, offset + dataLength);
    offset += dataLength;

    // 4-byte CRC (skip)
    offset += 4;

    chunks.push({ type, data });
  }

  return chunks;
}

/**
 * 从 tEXt chunk 中提取 key=value 文本
 * 使用 TextDecoder 而非 String.fromCharCode(...)，避免大数组展开爆调用栈
 */
export function readTextChunk(data: Uint8Array): {
  keyword: string;
  text: string;
} {
  // tEXt chunk: keyword\0text
  let nullIndex = data.indexOf(0);
  if (nullIndex === -1) nullIndex = data.length;

  const keyword = textDecoder.decode(data.slice(0, nullIndex));
  const text = textDecoder.decode(data.slice(nullIndex + 1));

  return { keyword, text };
}

// Base64 字符 → 6-bit 值
const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64CharToVal(ch: string): number {
  if (ch === "+") return 62;
  if (ch === "/") return 63;
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65; // A-Z
  if (code >= 97 && code <= 122) return code - 71; // a-z
  if (code >= 48 && code <= 57) return code + 4; // 0-9
  return -1;
}

/**
 * Base64 解码 —— 纯 JS 实现，不依赖 atob/Buffer
 * 处理大文本时不会爆调用栈
 */
export function decodeBase64(str: string): string {
  const clean = str.replace(/\s/g, "");
  const len = clean.length;
  if (clean.endsWith("=")) {
    // 移除 padding，Uint8Array 长度通过计算得出
  }

  const outputLen = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(outputLen);
  let outIdx = 0;

  for (let i = 0; i < len; i += 4) {
    const v0 = base64CharToVal(clean[i]);
    const v1 = base64CharToVal(clean[i + 1]);
    const v2 = clean[i + 2] === "=" ? -1 : base64CharToVal(clean[i + 2]);
    const v3 = clean[i + 3] === "=" ? -1 : base64CharToVal(clean[i + 3]);

    const chunk = (v0 << 18) | (v1 << 12) | ((v2 & 63) << 6) | (v3 & 63);

    bytes[outIdx++] = (chunk >> 16) & 0xff;
    if (v2 !== -1) bytes[outIdx++] = (chunk >> 8) & 0xff;
    if (v3 !== -1) bytes[outIdx++] = chunk & 0xff;
  }

  return textDecoder.decode(bytes.slice(0, outIdx));
}
