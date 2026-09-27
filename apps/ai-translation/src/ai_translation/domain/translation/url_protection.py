import re
from collections.abc import Callable
from dataclasses import dataclass, replace

from .dto import TranslationParams

# URLs and e-mail addresses; trailing punctuation belongs to the sentence, not the URL.
URL_PATTERN = re.compile(
    r"(?:https?://|ftp://|www\.)[^\s<>\"']*[^\s<>\"'.,;:!?)\]}]"
    r"|[\w.+-]+@[\w-]+(?:\.[\w-]+)+"
)

_HAS_LETTER = re.compile(r"[^\W\d_]")
_ANY_BRACKET_NUMBER = re.compile(r"\[\s*\d+\s*\]")


@dataclass
class _ProtectedText:
    text: str
    urls: dict[int, str]


def _protect(text: str) -> _ProtectedText:
    """Replace every URL with a numbered placeholder like '[1]'."""
    taken = {int(number) for number in re.findall(r"\[(\d+)\]", text)}
    urls: dict[int, str] = {}

    def substitute(match: re.Match) -> str:
        number = len(urls) + 1
        while number in taken or number in urls:
            number += 1
        urls[number] = match.group(0)
        return f"[{number}]"

    return _ProtectedText(URL_PATTERN.sub(substitute, text), urls)


def _restore(translated: str, protected: _ProtectedText) -> str:
    """Put the original URLs back, tolerating placeholders the model mangled."""
    missing: list[str] = []
    for number, url in protected.urls.items():
        restored, count = re.subn(rf"\[\s*{number}\s*\]", lambda _: url, translated, count=1)
        if not count:
            # e.g. 'URL 1', '__URL_1__'
            restored, count = re.subn(
                rf"_*URL[\s_]*{number}\b_*", lambda _: url, translated, count=1, flags=re.I
            )
        if count:
            translated = restored
        else:
            missing.append(url)

    # A single lost placeholder that came back renumbered (e.g. '[16]').
    if len(missing) == 1:
        known = set(_ANY_BRACKET_NUMBER.findall(protected.text))
        extras = [token for token in _ANY_BRACKET_NUMBER.findall(translated) if token not in known]
        if len(extras) == 1:
            translated = translated.replace(extras[0], missing.pop(), 1)

    # Never lose a URL, even when the model dropped it entirely.
    if missing:
        translated = f"{translated} {' '.join(missing)}"
    return translated


def translate_protecting_urls(
    params_list: list[TranslationParams],
    translate_batch: Callable[[list[TranslationParams]], list[str]],
) -> list[str]:
    """
    Translate with URLs kept out of the model's reach, so links are never altered.

    Texts that are nothing but URLs are returned unchanged without calling the model.
    """
    protected = [_protect(params.text) for params in params_list]
    to_translate = [
        index for index, item in enumerate(protected) if _HAS_LETTER.search(item.text)
    ]

    translated = translate_batch(
        [replace(params_list[index], text=protected[index].text) for index in to_translate]
    ) if to_translate else []

    results = [params.text for params in params_list]
    for index, text in zip(to_translate, translated):
        results[index] = _restore(text, protected[index])
    return results
