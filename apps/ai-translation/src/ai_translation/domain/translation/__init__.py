from .nllb_translator import NLLBModel
from .dto import TranslationParams
from .utils import (
    get_language_name,
    get_emotion_name,
    get_voice_name,
    remove_unique_codes
)

translator = NLLBModel()
