import yaml
from pathlib import Path
from typing import Any, Dict

_LOCALES: Dict[str, Dict[str, Any]] = {}
_BASE_PATH = Path(__file__).parent / "locales"

class Translator:
    def load(self):
        for loc_dir in _BASE_PATH.iterdir():
            if loc_dir.is_dir():
                for yml in loc_dir.glob("*.yml"):
                    data = yaml.safe_load(yml.read_text(encoding="utf-8")) or {}
                    _LOCALES.setdefault(loc_dir.name, {}).update(data)

    def t(self, key: str, locale: str = "en", **kwargs) -> str:
        parts = key.split('.')
        cur: Any = _LOCALES.get(locale, {})
        for p in parts:
            if isinstance(cur, dict):
                cur = cur.get(p)
            else:
                cur = None
                break
        if cur is None:
            return key
        if isinstance(cur, str):
            try:
                return cur.format(**kwargs)
            except Exception:
                return cur
        return str(cur)

translator = Translator()
translator.load()
