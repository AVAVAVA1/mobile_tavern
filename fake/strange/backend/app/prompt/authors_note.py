"""Author's Note 注入。"""
from typing import List


def inject_author_note(history: List[dict], note: str, depth: int) -> List[dict]:
    if not note.strip():
        return history

    result = list(history)
    insert_idx = max(0, len(result) - depth)
    result.insert(insert_idx, {"role": "system", "content": f"[Author's Note]\n{note}"})
    return result
