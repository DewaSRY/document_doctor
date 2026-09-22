import re

LANGUAGES = {
    "en": "English",
    "id": "Indonesian",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
}


def get_language_name(language_code: str) -> str:
    return LANGUAGES.get(language_code, "Unknown")


EMOTIONS = {
    "neutral": "Neutral",
    "happy": "Happy",
    "sad": "Sad",
    "angry": "Angry",
    "fearful": "Fearful",
    "surprised": "Surprised",
    "disgusted": "Disgusted",
    "excited": "Excited",
    "calm": "Calm",
    "confused": "Confused",
    "serious": "Serious",
}


def get_emotion_name(emotion_code: str) -> str:
    return EMOTIONS.get(emotion_code, "Unknown")


VOICES = {
    "professional": "Professional",
    "casual": "Casual",
    "friendly": "Friendly",
    "formal": "Formal",
    "empathetic": "Empathetic",
    "confident": "Confident",
    "enthusiastic": "Enthusiastic",
    "calm": "Calm",
    "serious": "Serious",
    "persuasive": "Persuasive",
    "energetic": "Energetic",
    "reassuring": "Reassuring",
    "urgent": "Urgent",
    "instructional": "Instructional",
    "conversational": "Conversational",
}


def get_voice_name(voice_code: str) -> str:
    return VOICES.get(voice_code, "Unknown")


def remove_unique_codes(text: str) -> str:
    """
    Remove special/unique codes while preserving letters, numbers,
    whitespace, and punctuation.
    """

    return re.sub(
        r"[^a-zA-Z0-9\s.,!?;:'\"()\[\]{}\-–—/]",
        "",
        text,
    )
