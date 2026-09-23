from dotenv import load_dotenv

from ai_translation.domain.translation import (
    TranslationParams,
    get_emotion_name,
    get_language_name,
    get_translator,
    get_voice_name,
    remove_unique_codes,
)


def main():
    load_dotenv()

    text = """
        Dengan ini saya ingin menyampaikan keberatan terhadap keputusan yang telah anda ambil 
    """

    source_language = "id"
    target_language = "en"
    emotion_tag = "formal"
    voice_tag = "professional"

    translated_text = get_translator().translate(
        translation_params=TranslationParams(
            text=remove_unique_codes(text),
            source_language=get_language_name(source_language),
            target_language=get_language_name(target_language),
            emotions_tags=[get_emotion_name(emotion_tag)],
            voice_tags=[get_voice_name(voice_tag)],
        )
    )

    print(translated_text)


if __name__ == "__main__":
    main()
