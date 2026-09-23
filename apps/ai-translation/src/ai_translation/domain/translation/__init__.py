from .qwen_translator import QwenTranslatorModel

from .dto import TranslationParams
from .utils import (
    get_language_name,
    get_emotion_name,
    get_voice_name,
)

_translator: QwenTranslatorModel | None = None


def get_translator() -> QwenTranslatorModel:
    global _translator
    if _translator is None:
        _translator = QwenTranslatorModel()
    return _translator
