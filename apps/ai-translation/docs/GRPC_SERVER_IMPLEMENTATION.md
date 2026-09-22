# gRPC Server Implementation Guide

This is the hands-on companion to [`GRPC_SERVER.md`](./GRPC_SERVER.md) (which
documents current state and rough edges). Follow these steps in order — each
one builds on the last, and each ends with a way to verify it worked before
you move on.

By the end you'll have: a fixed codegen pipeline, a servicer that adapts
proto messages to the domain translator, a server bootstrap, a lazy-loaded
model (so importing the domain package doesn't force a multi-GB model load),
and a `make serve` target you can run and hit with `grpcurl`.

---

## Step 1 — Fix the generated-code import

`translation_pb2_grpc.py` currently does `from translation.v1 import
translation_pb2`, which doesn't resolve under the real package path
(`ai_translation.infrastructure.grpc.translation.v1`). Fix this once in the
Makefile so it survives every future `make gen-proto`.

Edit `Makefile`:

```makefile
.PHONY: gen-proto
gen-proto: ## Generate gRPC code from proto files
	$(PYTHON) -m grpc_tools.protoc \
		-I$(PROTO_DIR) \
		--python_out=$(GRPC_OUT) \
		--grpc_python_out=$(GRPC_OUT) \
		$(PROTO_FILE)
	touch $(GRPC_OUT)/translation/__init__.py $(GRPC_OUT)/translation/v1/__init__.py
	sed -i '' 's/from translation.v1 import/from . import/' $(GRPC_OUT)/translation/v1/translation_pb2_grpc.py
```

Regenerate and verify:

```bash
make clean-proto && make gen-proto
uv run python -c "from ai_translation.infrastructure.grpc.translation.v1 import translation_pb2_grpc; print('ok')"
```

If that prints `ok` with no `ImportError`, the fix worked.

---

## Step 2 — Make the model lazy-loaded

Right now `domain/translation/__init__.py:10` runs `translator = NLLBModel()`
at import time, so *anything* that imports `ai_translation.domain.translation`
(including just to reach `get_language_name`) loads the full model. Fix that
before wiring the servicer, or the server (and every test that imports it)
pays that cost unconditionally.

Edit `src/ai_translation/domain/translation/__init__.py`:

```python
from .nllb_translator import NLLBModel
from .dto import TranslationParams
from .utils import (
    get_language_name,
    get_emotion_name,
    get_voice_name,
    remove_unique_codes,
)

_translator: NLLBModel | None = None


def get_translator() -> NLLBModel:
    global _translator
    if _translator is None:
        _translator = NLLBModel()
    return _translator
```

This replaces the module-level `translator` instance with a cached getter.
`main.py` will need one small update to match (`translator.translate(...)` →
`get_translator().translate(...)`) — make that edit now so the existing demo
script keeps working:

```python
from ai_translation.domain.translation import (
    get_translator,
    TranslationParams,
    get_language_name,
    get_voice_name,
    get_emotion_name,
    remove_unique_codes,
)


def main():
    ...
    translated_text = get_translator().translate(
        translation_params=TranslationParams(...)
    )
```

---

## Step 3 — Write the servicer

New file: `src/ai_translation/infrastructure/grpc/translation/v1/servicer.py`

```python
import grpc

from ai_translation.domain.translation import (
    get_translator,
    TranslationParams,
    get_language_name,
    get_emotion_name,
    get_voice_name,
    remove_unique_codes,
)
from . import translation_pb2, translation_pb2_grpc


class TranslationServicer(translation_pb2_grpc.TranslationServiceServicer):
    def Translate(self, request, context):
        try:
            params = TranslationParams(
                text=remove_unique_codes(request.text),
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
```

Note the field-name mismatch this bridges: the proto uses `emotion_tags`
(singular "emotion"), but `TranslationParams` uses `emotions_tags` (plural
"emotions") — that's an existing naming inconsistency in the domain layer,
not a typo introduced here. Also note `NLLBModel` doesn't currently expose a
name for `model=` (it stores `model_name` only as a constructor default, not
an attribute) — you'll need to either store `self.model_name` in
`NLLBModel.__init__` or hardcode the response's `model` field for now.

---

## Step 4 — Write the server bootstrap

New file: `src/ai_translation/bootstrap/server.py`

```python
import os
from concurrent import futures

import grpc

from ai_translation.infrastructure.grpc.translation.v1 import translation_pb2_grpc
from ai_translation.infrastructure.grpc.translation.v1.servicer import (
    TranslationServicer,
)


def serve() -> None:
    port = os.environ.get("GRPC_PORT", "50051")

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    translation_pb2_grpc.add_TranslationServiceServicer_to_server(
        TranslationServicer(), server
    )
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    print(f"gRPC server listening on port {port}")
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
```

This is the composition root: it's the one place that imports the servicer,
the generated stubs, and (transitively, on first RPC) the model.

---

## Step 5 — Wire up an entry point

Add a second script in `pyproject.toml` rather than replacing the existing
demo one, so `make run` still works unchanged:

```toml
[project.scripts]
ai-translation = "ai_translation:main"
ai-translation-serve = "ai_translation.bootstrap.server:serve"
```

Re-sync so `uv` picks up the new script:

```bash
uv sync
```

---

## Step 6 — Add a Makefile target

```makefile
.PHONY: serve
serve: ## Run the gRPC server
	uv run ai-translation-serve
```

---

## Step 7 — Run it and verify

```bash
make serve
```

In another terminal, using [`grpcurl`](https://github.com/fullstorydev/grpcurl):

```bash
grpcurl -plaintext -proto proto/translation/v1/translation.proto \
  -d '{"text": "Selamat pagi", "source_language": "id", "target_language": "en"}' \
  localhost:50051 translation.v1.TranslationService/Translate
```

You should get back a JSON response with `translatedText`, `sourceLanguage`,
`targetLanguage`, and `model`. The first call will be slow — that's the
lazy-loaded model downloading/initializing on first use; later calls reuse
the cached instance from `get_translator()`.

If you don't want to install `grpcurl`, a quick Python client works too,
using the already-generated `TranslationServiceStub`:

```python
import grpc
from ai_translation.infrastructure.grpc.translation.v1 import (
    translation_pb2,
    translation_pb2_grpc,
)

channel = grpc.insecure_channel("localhost:50051")
stub = translation_pb2_grpc.TranslationServiceStub(channel)
response = stub.Translate(
    translation_pb2.TranslateRequest(
        text="Selamat pagi",
        source_language="id",
        target_language="en",
    )
)
print(response)
```

---

## Step 8 (optional) — Health check and reflection

Standard for any production gRPC service, so clients and load balancers can
introspect it without shipping the `.proto` file around.

Add to `pyproject.toml` dependencies:

```toml
dependencies = [
    ...
    "grpcio-health-checking>=1.84.0",
    "grpcio-reflection>=1.84.0",
]
```

Then in `bootstrap/server.py`:

```python
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

from ai_translation.infrastructure.grpc.translation.v1 import translation_pb2


def serve() -> None:
    ...
    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    health_servicer.set(
        "translation.v1.TranslationService", health_pb2.HealthCheckResponse.SERVING
    )

    service_names = (
        translation_pb2.DESCRIPTOR.services_by_name["TranslationService"].full_name,
        health_pb2.DESCRIPTOR.services_by_name["Health"].full_name,
        reflection.SERVICE_NAME,
    )
    reflection.enable_server_reflection(service_names, server)
    ...
```

---

## Step 9 (optional) — A unit test that doesn't load the model

Because the translator is now lazy (Step 2), you can test the servicer's
request/response mapping without ever loading the LM, by monkeypatching
`get_translator`:

```python
# tests/test_servicer.py
from unittest.mock import MagicMock, patch

from ai_translation.infrastructure.grpc.translation.v1 import translation_pb2
from ai_translation.infrastructure.grpc.translation.v1.servicer import (
    TranslationServicer,
)


def test_translate_maps_request_to_response():
    fake_translator = MagicMock()
    fake_translator.translate.return_value = "Good morning"
    fake_translator.model.name_or_path = "fake-model"

    with patch(
        "ai_translation.infrastructure.grpc.translation.v1.servicer.get_translator",
        return_value=fake_translator,
    ):
        servicer = TranslationServicer()
        request = translation_pb2.TranslateRequest(
            text="Selamat pagi", source_language="id", target_language="en"
        )
        response = servicer.Translate(request, context=MagicMock())

    assert response.translated_text == "Good morning"
    assert response.target_language == "en"
```

---

## Recap

| Step | File touched | Result |
|---|---|---|
| 1 | `Makefile` | Codegen produces importable stubs |
| 2 | `domain/translation/__init__.py`, `main.py` | Model loads lazily, not at import |
| 3 | `infrastructure/grpc/translation/v1/servicer.py` (new) | Proto ↔ domain adapter |
| 4 | `bootstrap/server.py` (new) | Composition root / `serve()` |
| 5 | `pyproject.toml` | `ai-translation-serve` entry point |
| 6 | `Makefile` | `make serve` |
| 7 | — | Verified with `grpcurl` / a Python client |
| 8 | `pyproject.toml`, `bootstrap/server.py` | Health check + reflection |
| 9 | `tests/test_servicer.py` (new) | Servicer tested without loading the model |
