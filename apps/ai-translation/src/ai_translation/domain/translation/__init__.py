from .qwan_translator import QwanTranslatorModel
from .nllb_translator import NllbTranslatorModel

from .dto import TranslationParams
from .utils import (
    get_language_name,
    get_emotion_name,
    get_voice_name,
    remove_unique_codes,
)

_translator: NllbTranslatorModel | None = None


def get_translator() -> NllbTranslatorModel:
    global _translator
    if _translator is None:
        _translator = NllbTranslatorModel()
    return _translator
