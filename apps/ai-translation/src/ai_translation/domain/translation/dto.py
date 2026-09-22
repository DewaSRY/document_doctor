from dataclasses import dataclass


@dataclass
class TranslationParams:
    text: str
    source_language: str
    target_language: str
    emotions_tags: list[str] | None = None
    voice_tags: list[str] | None = None


@dataclass(frozen=True)
class TranslationContext:
    title: str | None = None
    surrounding_text: str | None = None
    domain: str | None = None


@dataclass(frozen=True)
class TranslationRequest:
    text: str
    source_language: str
    target_language: str

    context: TranslationContext | None = None

    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class TranslationResult:
    translated_text: str
    source_language: str
    target_language: str
    provider: str
    model: str
