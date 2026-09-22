
from dataclasses import dataclass

@dataclass
class TranslationParams:
    text: str
    source_language: str
    target_language: str
    emotions_tags: list[str] | None = None
    voice_tags: list[str] | None = None
