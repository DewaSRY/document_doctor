
from ai_translation.domain.translation import (
    get_translator, 
    TranslationParams, 
    get_language_name, 
    get_voice_name, 
    get_emotion_name, 
    remove_unique_codes
)

def main():
    text = """
        Dengan ini saya ingin menyampaikan keberatan terhadap keputusan yang telah anda ambil 
    """

    source_language = "id" 
    target_language = "zh" 

    voice_tag = "professional"
    translated_text = get_translator().translate(
        translation_params=TranslationParams(
            text=remove_unique_codes(text),
            source_language=get_language_name(source_language),
            target_language=get_language_name(target_language),
            emotions_tags=[get_emotion_name("formal")], 
            voice_tags=[get_voice_name("professional")],
        )
    )

    print(translated_text)

if __name__ == "__main__":
    main()