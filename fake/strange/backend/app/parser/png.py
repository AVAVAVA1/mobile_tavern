"""PNG chunk 结构解析。

PNG 格式：8 字节签名 → [4 字节长度][4 字节类型][data][4 字节 CRC]...
"""
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
