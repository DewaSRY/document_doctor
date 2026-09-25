from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    text: str = Field(..., description="Text to translate")
    source_language: str = Field(..., description="Source language code (e.g., 'zh', 'id')")
    target_language: str = Field(..., description="Target language code (e.g., 'id', 'zh')")
    emotion_tags: list[str] | None = Field(default=None, description="Emotion tags (e.g., 'formal', 'casual')")
    voice_tags: list[str] | None = Field(default=None, description="Voice tags (e.g., 'professional', 'friendly')")


class TranslateResponse(BaseModel):
    translated_text: str = Field(..., description="Translated text")
    source_language: str = Field(..., description="Source language code")
    target_language: str = Field(..., description="Target language code")
    model: str = Field(..., description="Model name used for translation")


class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    detail: str | None = Field(default=None, description="Additional error details")
