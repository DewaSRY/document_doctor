from dotenv import load_dotenv

from ai_translation.domain.translation import (
    TranslationParams,
    get_emotion_name,
    get_language_name,
    get_translator,
    get_voice_name,
)

"""
Kami bangsa Indonesia dengan ini menjatakan kemerdekaan Indonesia.Hal-hal jang mengenai pemindahan kekoeasaan d.l.l., 
diselenggarakan dengan tjara seksama dan dalam tempo jang sesingkat-singkatnja.Djakarta, hari 17 boelan 8 tahoen 
05Atas nama bangsa Indonesia,Soekarno/Hatta.


印尼人民在此宣誓捍卫印尼的独立。有关领土变更、战争及其他相关事宜，均以严肃态度处理，并在短时间内完成。这是于1945年8月17日，在雅加达举行的声明。由印尼共和国总统苏哈托/荷西·阿塔主持。

"""

def main():
    load_dotenv()

    text = """
  印尼人民在此宣誓捍卫印尼的独立。有关领土变更、战争及其他相关事宜，均以严肃态度处理，并在短时间内完成。这是于1945年8月17日，在雅加达举行的声明。由印尼共和国总统苏哈托/荷西·阿塔主持。

    """

    source_language = "zh"
    target_language = "id"

    # source_language = "id"
    # target_language = "zh"

    emotion_tag = "formal"
    voice_tag = "professional"

    translated_text = get_translator().translate(
        translation_params=TranslationParams(
            text=text,
            source_language=get_language_name(source_language),
            target_language=get_language_name(target_language),
            emotions_tags=[get_emotion_name(emotion_tag)],
            voice_tags=[get_voice_name(voice_tag)],

        )
    )

     

    print(translated_text)


if __name__ == "__main__":
    main()
