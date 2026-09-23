import grpc

from ai_translation.domain.translation import (
    get_translator,
    TranslationParams,
    get_language_name,
    get_emotion_name,
    get_voice_name
)

from . import translation_pb2, translation_pb2_grpc


class TranslationServicer(translation_pb2_grpc.TranslationServiceServicer):
    def Translate(self, request, context):
        try:
            params = TranslationParams(
                text=request.text,
                source_language=get_language_name(request.source_language),
                target_language=get_language_name(request.target_language),
                emotions_tags=[get_emotion_name(tag) for tag in request.emotion_tags],
                voice_tags=[get_voice_name(tag) for tag in request.voice_tags],
            )

            translated_text = get_translator().translate(translation_params=params)

            return translation_pb2.TranslateResponse(
                translated_text=translated_text,
                source_language=request.source_language,
                target_language=request.target_language,
                model=get_translator().model.name_or_path,
            )
        except Exception as exc:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return translation_pb2.TranslateResponse()
