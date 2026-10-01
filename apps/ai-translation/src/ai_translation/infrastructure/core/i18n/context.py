import json
from contextvars import ContextVar
from pathlib import Path
from typing import Any

MESSAGES_DIR = Path(__file__).parent / "messages"
DEFAULT_LOCALE = "en"

current_locale: ContextVar[str] = ContextVar("locale", default=DEFAULT_LOCALE)


def _load_all() -> dict[str, dict[str, Any]]:
    catalogs: dict[str, dict[str, Any]] = {}
    for lang_dir in MESSAGES_DIR.iterdir():
        if not lang_dir.is_dir():
            continue
        catalogs[lang_dir.name] = {
            f.stem: json.loads(f.read_text(encoding="utf-8"))
            for f in lang_dir.glob("*.json")
        }
    return catalogs


CATALOGS = _load_all()
SUPPORTED_LOCALES = set(CATALOGS)

def _lookup(catalog: dict[str, Any], key: str) -> str | None:
    node: Any = catalog
    for part in key.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, str) else None


def t(key: str, locale: str | None = None, **params: Any) -> str:
    """t('feature.translate.success') or t('feature.welcome', name='Budi')"""
    locale = locale or current_locale.get()
    text = (
        _lookup(CATALOGS.get(locale, {}), key)
        or _lookup(CATALOGS.get(DEFAULT_LOCALE, {}), key)  # fallback
        or key  
    )
    try:
        return text.format(**params)
    except (KeyError, IndexError):
        return text


def parse_accept_language(header: str | None) -> str:
    if not header:
        return DEFAULT_LOCALE
    candidates = []
    for part in header.split(","):
        lang, _, q = part.strip().partition(";q=")
        try:
            weight = float(q) if q else 1.0
        except ValueError:
            weight = 0.0
        candidates.append((lang.split("-")[0].lower(), weight))
    for lang, _w in sorted(candidates, key=lambda c: c[1], reverse=True):
        if lang in SUPPORTED_LOCALES:
            return lang
    return DEFAULT_LOCALE