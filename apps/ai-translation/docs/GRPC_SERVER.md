# gRPC Translation Server — As Implemented (and What's Left)

## Who this doc is for

Assumes you're comfortable with Python and have seen a `.proto` file before, but
haven't necessarily wired up a real gRPC server in this codebase yet. This doc
is verified against source, not aspirational: it separates what already exists
from what you still have to build. Read the "Rough edges" callout before you
start writing code — two of them will bite you on your first run if you don't
know about them going in.

---

## Section 1 — Architecture at a Glance

There is **no composition root yet**. `main.py` is a standalone demo script
that calls the domain translator directly — it never touches gRPC at all
(`src/ai_translation/main.py:11-30`). Building the server means creating that
composition root from scratch.

| Concern | Owner (file) | Status |
|---|---|---|
| Proto contract | `proto/translation/v1/translation.proto` | ✅ Defined |
| Codegen pipeline | `Makefile:54-60` (`make gen-proto`) | ✅ Working |
| Generated stubs | `src/ai_translation/infrastructure/grpc/translation/v1/translation_pb2*.py` | ✅ Generated, ⚠️ has a broken import (see rough edges) |
| Domain translation logic | `src/ai_translation/domain/translation/nllb_translator.py:50-74` | ✅ Implemented |
| Servicer (proto ↔ domain adapter) | — | ❌ Missing |
| Server bootstrap (`grpc.server`, `add_insecure_port`, `start`/`wait_for_termination`) | — | ❌ Missing |
| Entry point wiring `pyproject.toml` → server | `pyproject.toml:20-21` | ⚠️ Points at the demo script, not a server |
| `bootstrap/`, `infrastructure/ai/`, `infrastructure/grpc/__init__.py` | all present | ❌ All empty placeholders |

The module layout (`bootstrap/`, `infrastructure/`, `domain/`) suggests an
intended composition-root pattern — infra adapters wired to domain logic in
`bootstrap/` — but nothing has been written into it yet.

---

## Section 2 — What's Already Implemented

### The proto contract

`proto/translation/v1/translation.proto:1-27` defines one RPC:

```protobuf
service TranslationService {
  rpc Translate(TranslateRequest) returns (TranslateResponse);
}
```

`TranslateRequest` carries `text`, `source_language`, `target_language`,
`emotion_tags`, `voice_tags`. `TranslateResponse` carries `translated_text`,
`source_language`, `target_language`, `model`.

### Codegen

`make gen-proto` (`Makefile:54-60`) runs `grpc_tools.protoc` against the proto
file and writes generated code into
`src/ai_translation/infrastructure/grpc/translation/v1/`. This has already
been run — `translation_pb2.py` and `translation_pb2_grpc.py` are checked in.
`TranslationServiceServicer` (the base class you'll subclass) and
`add_TranslationServiceServicer_to_server` (the wiring function) both exist in
`translation_pb2_grpc.py:44-65`.

### Domain translation logic

`NLLBModel.translate()` (`nllb_translator.py:50-74`) takes a
`TranslationParams` and returns a translated string, built via a chat-template
prompt to a causal LM (currently `Qwen/Qwen2.5-1.5B-Instruct`, despite the
class being named `NLLBModel` — worth knowing so the name doesn't mislead you
about what model actually runs). A ready-to-use instance is exported as
`translator` from `domain/translation/__init__.py:10`.

---

## Rough Edges (read before you build on top of this)

1. **The generated import will fail as-is.** `translation_pb2_grpc.py:6` does
   `from translation.v1 import translation_pb2`. That's a bare top-level
   `translation.v1` package — but the real package path is
   `ai_translation.infrastructure.grpc.translation.v1`, and there's no
   `__init__.py` in either `translation/` or `translation/v1/` to make it a
   proper subpackage in the first place. `protoc` generates imports relative
   to the proto's own package name, not your Python package tree, so this
   mismatch is expected output, not a one-off bug — you'll hit it again every
   time you re-run `make gen-proto`. Fix it once, permanently, in step 1 below.

2. **`translator = NLLBModel()` runs at import time**
   (`domain/translation/__init__.py:10`). Just importing
   `ai_translation.domain.translation` loads the full model onto
   GPU/MPS/CPU. Once your servicer imports this module, constructing the
   server process becomes slow and loads a multi-GB model even for a health
   check or a unit test that never calls `Translate`. You'll want this
   lazy-loaded or constructed explicitly in your bootstrap step, not as a
   module-level side effect.

3. **`dto.py` has two generations of DTOs that don't talk to each other.**
   `TranslationParams` (`dto.py:4-10`) is what `NLLBModel.translate()` actually
   takes today. `TranslationContext`, `TranslationRequest`, and
   `TranslationResult` (`dto.py:14-38`) are fully defined but currently
   unused anywhere in the codebase — they look like they were meant as the
   mapping layer between proto messages and the domain, but nothing wires
   them up yet. Decide whether your servicer maps proto → `TranslationParams`
   directly, or finishes wiring these newer DTOs — don't let both paths grow independently.

---

## Section 3 — Next Steps to Stand Up the Server

1. **Fix the generated-code import.** Add empty `__init__.py` files to
   `infrastructure/grpc/translation/` and `infrastructure/grpc/translation/v1/`
   so it's a real package, and change the import in `translation_pb2_grpc.py`
   from `from translation.v1 import translation_pb2` to a relative import
   `from . import translation_pb2`. Since this file is regenerated, add a
   small `sed` post-processing step to the `gen-proto` Makefile target so the
   fix survives regeneration, e.g.:
   ```makefile
   gen-proto: ## Generate gRPC code from proto files
   	$(PYTHON) -m grpc_tools.protoc \
   		-I$(PROTO_DIR) \
   		--python_out=$(GRPC_OUT) \
   		--grpc_python_out=$(GRPC_OUT) \
   		$(PROTO_FILE)
   	touch $(GRPC_OUT)/translation/__init__.py $(GRPC_OUT)/translation/v1/__init__.py
   	sed -i '' 's/from translation.v1 import/from . import/' $(GRPC_OUT)/translation/v1/translation_pb2_grpc.py
   ```

2. **Write the servicer.** New file, e.g.
   `src/ai_translation/infrastructure/grpc/translation/v1/servicer.py`,
   subclassing `TranslationServiceServicer` and implementing `Translate`:
   unpack the proto `TranslateRequest`, build a `TranslationParams`, call
   `translator.translate(...)`, and return a `TranslateResponse`. Wrap the
   call in try/except and map failures to `context.set_code(grpc.StatusCode.INTERNAL)`
   / `context.set_details(...)` rather than letting exceptions propagate raw.

3. **Write the server bootstrap.** New file, e.g.
   `src/ai_translation/bootstrap/server.py`, with a `serve()` function:
   ```python
   from concurrent import futures
   import grpc
   from ai_translation.infrastructure.grpc.translation.v1 import translation_pb2_grpc
   from ai_translation.infrastructure.grpc.translation.v1.servicer import TranslationServicer

   def serve(port: str = "50051"):
       server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
       translation_pb2_grpc.add_TranslationServiceServicer_to_server(TranslationServicer(), server)
       server.add_insecure_port(f"[::]:{port}")
       server.start()
       server.wait_for_termination()
   ```
   This is the composition root the module layout was clearly set up for but
   never got.

4. **Load the model lazily inside the servicer/bootstrap**, not at
   `domain/translation/__init__.py` import time — construct or fetch
   `NLLBModel` when `serve()` runs, so importing the package for tests doesn't
   force a model load.

5. **Rewire the entry point.** Either repoint
   `pyproject.toml:21` (`ai-translation = "ai_translation:main"`) at
   `ai_translation.bootstrap.server:serve`, or add a second script (e.g.
   `ai-translation-serve`) so the existing demo in `main.py` still works
   standalone.

6. **Add a `serve` Makefile target** (`uv run python -m ai_translation.bootstrap.server` or via the new script) so `make serve` mirrors the existing `make run`.

7. **Optional but standard for production gRPC:** add `grpc_health.v1` (health
   checking) and `grpc_reflection.v1alpha` (server reflection) so tools like
   `grpcurl` can introspect the service without needing the `.proto` file
   on hand.

8. **Test it end-to-end.** Once `serve()` runs, hit it with `grpcurl -plaintext
   -proto proto/translation/v1/translation.proto localhost:50051
   translation.v1.TranslationService/Translate -d '{"text": "...",
   "source_language": "id", "target_language": "zh"}'`, or write a small
   Python client using `TranslationServiceStub` (already generated,
   `translation_pb2_grpc.py:28-41`) against a locally running server.

---

## Final Reference Table

| RPC | Endpoint | Proto | Codegen | Servicer | Bootstrap |
|---|---|---|---|---|---|
| Translate | `translation.v1.TranslationService/Translate` | ✅ | ✅ | ❌ | ❌ |
