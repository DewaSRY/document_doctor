

from .constant import LANGUAGES
from .nllb_model import NLLBModel
from .dto import TranslationParams
from typing import Sequence

class Translator:
    def __init__(self, model: NLLBModel):
        self.model = model

    def translate(
        self,
        translation_params: TranslationParams
    ) -> str:
        return self.model.translate(translation_params)