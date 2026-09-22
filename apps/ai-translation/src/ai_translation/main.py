
from ai_translation.domain.translation.nllb_model import NLLBModel
from ai_translation.domain.translation.translator import Translator

model = NLLBModel()
translator = Translator(model=model)


def main():
    text = "Hello, how are you?"
    source_language = "en"
    target_language = "fr"

    translated_text = translator.translate(
        text=text,
        source_language="en",
        target_language="id",
    )

    print(translated_text)

if __name__ == "__main__":
    main()