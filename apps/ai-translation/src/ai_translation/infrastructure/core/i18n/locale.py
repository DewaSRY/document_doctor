from fastapi import Request

SUPPORTED_LOCALES = {"en", "id"}
DEFAULT_LOCALE = "en"


def get_locale(request: Request) -> str:
    # 1. Explicit query parameter
    lang = request.query_params.get("lang")

    if lang:
        locale = lang.split("-")[0].lower()

        if locale in SUPPORTED_LOCALES:
            return locale

    return DEFAULT_LOCALE