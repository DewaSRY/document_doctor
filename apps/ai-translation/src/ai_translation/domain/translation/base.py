
from abc import ABC, abstractmethod

from .dto import TranslationParams


class BaseTranslator(ABC):
    @abstractmethod
    def translate(self, translation_params: TranslationParams) -> str:
        pass

    @abstractmethod
    def translate_batch(self, params_list: list[TranslationParams]) -> list[str]:
        pass
