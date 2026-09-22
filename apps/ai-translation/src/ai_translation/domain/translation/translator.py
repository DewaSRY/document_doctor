

from .constant import LANGUAGES
from .model import NLLBModel



class Translator:
    def __init__(self, model: NLLBModel):
        self.model = model

    def translate(
        self,
        text: str,
        source_language: str,
        target_language: str,
    ) -> str:

        source_code = LANGUAGES[source_language]
        target_code = LANGUAGES[target_language]

        return self.model.translate(
            text=text,
            source_language=source_code,
            target_language=target_code,
        )