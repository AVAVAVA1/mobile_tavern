"""PNG chunk 结构解析。

PNG 格式：8 字节签名 → [4 字节长度][4 字节类型][data][4 字节 CRC]...
"""
import struct
import zlib
from dataclasses import dataclass


@dataclass
class PNGChunk:
    type: str
    data: bytes


def _decode_text(b: bytes) -> str:
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        return b.decode("latin-1", "replace")


def parse_png_chunks(buffer: bytes) -> list[PNGChunk]:
    chunks: list[PNGChunk] = []
    offset = 8
    n = len(buffer)

    while offset + 8 <= n:
        data_length = int.from_bytes(buffer[offset:offset + 4], "big")
        offset += 4
        ctype = buffer[offset:offset + 4].decode("ascii", "replace")
        offset += 4
        chunk_data = buffer[offset:offset + data_length]
        offset += data_length
        offset += 4  # CRC
        chunks.append(PNGChunk(ctype, chunk_data))

    return chunks


def read_text_chunk(chunk_data: bytes) -> tuple[str, str]:
    """从 tEXt chunk 中提取 keyword\\0text。"""
    null_idx = chunk_data.find(0)
    if null_idx == -1:
        null_idx = len(chunk_data)
    keyword = _decode_text(chunk_data[:null_idx])
    text = _decode_text(chunk_data[null_idx + 1:])
    return keyword, text


def create_text_chunk(key: str, value: str) -> bytes:
    """构造一个 tEXt chunk（含 CRC32），用于写入角色卡。"""
    key_b = key.encode("utf-8")
    value_b = value.encode("utf-8")
    data = key_b + b"\x00" + value_b
    chunk_type = b"tEXt"
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)


def inject_text_chunk(png_bytes: bytes, key: str, value: str) -> bytes:
    """把 tEXt chunk 注入到 IHDR 之后（保持 PNG 合法）。"""
    chunk = create_text_chunk(key, value)
    insert_pos = 33  # 8 签名 + IHDR(4 len + 4 type + 13 data + 4 crc)
    offset = 8
    n = len(png_bytes)
    while offset + 8 <= n:
        length = int.from_bytes(png_bytes[offset:offset + 4], "big")
        ctype = png_bytes[offset + 4:offset + 8].decode("ascii", "replace")
        next_offset = offset + 12 + length
        if ctype == "IHDR":
            insert_pos = next_offset
            break
        offset = next_offset
    return png_bytes[:insert_pos] + chunk + png_bytes[insert_pos:]
