
from ai_translation.domain.translation import translator, TranslationParams

def main():
    text = "Hello, how are you?"
    source_language = "en"
    target_language = "id"

    translated_text = translator.translate(
        translation_params=TranslationParams(
            text=text,
            source_language=source_language,
            target_language=target_language,
            emotions_tags=["formal"]
        )
    )

    print(translated_text)

if __name__ == "__main__":
    main()