import os
import click
from dotenv import load_dotenv

from ai_translation.domain.translation import (
    TranslationParams,
    get_emotion_name,
    get_language_name,
    get_translator,
    get_voice_name,
)


@click.group()
def cli():
    """AI Translation Service CLI"""
    load_dotenv()


@cli.command()
@click.option("--source", default="zh", help="Source language code")
@click.option("--target", default="id", help="Target language code")
@click.option("--emotion", default="formal", help="Emotion tag")
@click.option("--voice", default="professional", help="Voice tag")
@click.option("--text", default=None, help="Text to translate")
def translate(source: str, target: str, emotion: str, voice: str, text: str | None):
    """Translate text using the Qwen translator"""
    if text is None:
        text = """
  印尼人民在此宣誓捍卫印尼的独立。有关领土变更、战争及其他相关事宜，均以严肃态度处理，并在短时间内完成。这是于1945年8月17日，在雅加达举行的声明。由印尼共和国总统苏哈托/荷西·阿塔主持。
        """

    translated_text = get_translator().translate(
        translation_params=TranslationParams(
            text=text,
            source_language=get_language_name(source),
            target_language=get_language_name(target),
            emotions_tags=[get_emotion_name(emotion)],
            voice_tags=[get_voice_name(voice)],
        )
    )

    click.echo(translated_text)


@cli.command()
@click.option("--host", default="0.0.0.0", help="Server host")
@click.option("--port", default=8000, type=int, help="Server port")
def server(host: str, port: int):
    """Run the REST API server"""
    os.environ["REST_HOST"] = host
    os.environ["REST_PORT"] = str(port)

    from ai_translation.bootstrap.server import main as run_server
    run_server()


def main() -> None:
    """Main entry point"""
    cli()


if __name__ == "__main__":
    main()
