# Runtime AI Layer — As Implemented

## Who this doc is for

You're comfortable with Python and have at least seen gRPC and Hugging Face
`transformers`. You don't need to have served a model in production before. The
doc covers two things:

1. **What the runtime AI layer in `ai-translation` actually does today**: how a
   model gets loaded, how a request becomes a prompt, how the prompt becomes
   tokens and then text, and how that is exposed over gRPC.
2. **What it takes to make that layer production-ready.** Each section ends with
   a "Making it production-ready" block, and the
   [Production Blueprint](#section-11--production-blueprint) section puts them
   together into one target design.

Section 0 is a primer on serving models at runtime. Skip it if you already know
why "load once, infer many" matters and why `model.generate()` doesn't scale
with threads.

> **This is checked against the source, not an ideal design.** Everything below
> was checked line by line against the code at commit `adf31ba`. Where the code
> and its intent disagree, the doc says so. Read closely before building on top of
> it, because behavior you might assume (the server starts, Mandarin input
> works, the model cache persists across container runs) **does not hold today**.
> The two blockers are called out in
> [Section 1](#section-1--architecture-at-a-glance).

---

## Section 0 — Background Primer: Serving a Model at Runtime

"Runtime AI layer" means the code that holds a model in memory inside a
long-running process and answers requests with it. There are several ways to put
a model behind an API:

| Approach | Where the model lives | Load cost paid | Concurrency model | Typical use |
| --- | --- | --- | --- | --- |
| **Load per request** | Loaded inside the handler | Every request (seconds to minutes) | N/A, unusably slow | Never in production |
| **In-process, long-lived** (this service) | Loaded once in the server process, reused | Once per process | One model instance shared by worker threads | Small/medium models, 1 GPU, modest QPS |
| **Dedicated inference server** (vLLM, TGI, Triton) | A separate optimized server; your service is a thin client | Once per inference server | Continuous batching, KV-cache paging | High QPS, larger models, multi-GPU |
| **Hosted model API** (Claude, etc.) | Provider's infrastructure | Never (for you) | Provider-managed, rate-limited | When you don't need to own weights |

`ai-translation` uses the second approach. A gRPC server process keeps one
`transformers` model in memory and calls `model.generate()` for each request.

The core API is Hugging Face `transformers`:

- `AutoTokenizer.from_pretrained(name)` / `AutoModelFor*.from_pretrained(name)`
  resolve `name` either as a local directory or a Hub model id. Hub ids are
  downloaded to `HF_HOME` on first use.
- `tokenizer.apply_chat_template(messages)` turns a list of
  `{"role", "content"}` dicts into the exact prompt string the instruct model was
  trained on.
- `model.generate(**inputs, max_new_tokens=…)` runs autoregressive decoding and
  returns token ids.

### Gotchas that surprise newcomers

1. **Loading is the expensive part, not inference.** Loading a 1.5B-parameter
   model means downloading about 3 GB (first time) and moving it onto the
   device, which takes seconds to minutes. Generating one translation takes
   milliseconds to seconds. The whole design of the layer follows from this:
   load once and keep the instance. This is why
   [Section 2](#section-2--model-lifecycle-get_translator) exists.
2. **Threads don't give you parallel inference.** `model.generate()` is
   compute-bound and runs on one device. A `ThreadPoolExecutor(max_workers=10)`
   lets 10 requests *enter* the handler at once. They then compete for the same
   GPU/CPU, and any mutable state on the shared instance becomes a race.
   Throughput comes from **batching**, not from threads. See
   [Section 8](#section-8--server-bootstrap--concurrency-bootstrapserverpy).
3. **A causal LM gives back your prompt along with the answer.** For
   decoder-only models like Qwen, `generate()` returns the *prompt tokens
   followed by* the new tokens. You have to slice off the prompt before decoding.
   Also, the prompt says "Output ONLY the translated text", but that is a
   request, not a guarantee. See
   [Section 3](#section-3--the-qwen-inference-engine-qwentranslatormodel).

---

## Section 1 — Architecture at a Glance

The **composition root** is `serve()` in
[bootstrap/server.py:13-26](../src/ai_translation/bootstrap/server.py#L13-L26).
It builds a `grpc.server`, registers `TranslationServicer`, binds a port, and
blocks. It holds no AI logic itself. The model is not even touched at startup.
The first `Translate` RPC triggers the load through `get_translator()`.

> **⚠️ Blocker #1: the server cannot start at HEAD.**
> [domain/translation/__init__.py:1](../src/ai_translation/domain/translation/__init__.py#L1)
> does `from .qwan_translator import QwanTranslatorModel`, but the class in that
> file is named **`QwenTranslatorModel`** (with an **e**)
> ([qwan_translator.py:10](../src/ai_translation/domain/translation/qwan_translator.py#L10)).
> Verified:
>
> ```text
> $ python -c "import ai_translation.bootstrap.server"
> ImportError: cannot import name 'QwanTranslatorModel' from
> 'ai_translation.domain.translation.qwan_translator'. Did you mean: 'QwenTranslatorModel'?
> ```
>
> Every entry point (`make serve`, `make run`, the Docker `CMD`) imports this
> package, so all of them crash on startup. The filename `qwan_translator.py`
> keeps the typo. The class name was corrected but the import was not. Fix the
> import and the type hints on lines 12 and 15. Keep the filename in mind when
> grepping.

> **⚠️ Blocker #2: Mandarin input is erased before it reaches the model.**
> See [Section 5](#section-5--input-normalization-utilspy). For an
> Indonesian ↔ Mandarin product, this makes the `zh → *` direction produce
> garbage.

| Concern | Owner (file) | Analogy |
| --- | --- | --- |
| Process startup, port binding, thread pool | [bootstrap/server.py](../src/ai_translation/bootstrap/server.py) | The building manager: opens the doors, doesn't do the work |
| Wire contract | [proto/translation/v1/translation.proto](../proto/translation/v1/translation.proto) | The menu the Go backend orders from |
| Proto ↔ domain adapter, error mapping | [infrastructure/grpc/translation/v1/servicer.py](../src/ai_translation/infrastructure/grpc/translation/v1/servicer.py) | The waiter: takes the order, translates it for the kitchen |
| Input normalization (codes → names, text cleanup) | [domain/translation/utils.py](../src/ai_translation/domain/translation/utils.py) | The prep cook, currently over-trimming |
| Model lifecycle (lazy singleton) | [domain/translation/\_\_init\_\_.py:12-19](../src/ai_translation/domain/translation/__init__.py#L12-L19) | The key to the one oven everyone shares |
| Active inference engine (Qwen, causal LM) | [domain/translation/qwan_translator.py](../src/ai_translation/domain/translation/qwan_translator.py) | The oven |
| Alternative engine (NLLB, seq2seq), **not wired** | [domain/translation/nllb_translator.py](../src/ai_translation/domain/translation/nllb_translator.py) | A second oven that's plugged in but never used |
| Request/response data shapes | [domain/translation/dto.py](../src/ai_translation/domain/translation/dto.py) | Order tickets, in two generations |
| Provider abstraction | [infrastructure/ai/\_\_init\_\_.py](../src/ai_translation/infrastructure/ai/__init__.py) | An empty room reserved for it |
| Runtime config, image, model cache | [Dockerfile](../Dockerfile), [Makefile](../Makefile), [.env.example](../.env.example) | The building's utilities |

The layout follows a hexagonal/clean-architecture shape: `bootstrap/` wires,
`infrastructure/` adapts to the outside world (gRPC, AI providers), and
`domain/` holds the logic. The benefit is testability. The servicer can be
tested with a fake translator and no GPU. The consequence to notice: **the model
engines currently live in `domain/`**, and they import `torch` and
`transformers` directly. The empty `infrastructure/ai/` package is where they
should go. That move is what makes swapping Qwen ↔ NLLB ↔ a hosted API a config
change instead of a code change
([Section 11](#section-11--production-blueprint)).

---

## Section 2 — Model Lifecycle: `get_translator()`

### The problem

The model has to load **exactly once per process**, and it must *not* load as a
side effect of importing the package. Otherwise every unit test and every tool
that touches `ai_translation.domain.translation` would pay a multi-GB load.

### How it's implemented

A module-level cache with a lazy getter
([domain/translation/\_\_init\_\_.py:12-19](../src/ai_translation/domain/translation/__init__.py#L12-L19)):

```python
_translator: QwanTranslatorModel | None = None


def get_translator() -> QwanTranslatorModel:
    global _translator
    if _translator is None:
        _translator = QwanTranslatorModel()
    return _translator
```

The servicer calls it on every request
([servicer.py:26](../src/ai_translation/infrastructure/grpc/translation/v1/servicer.py#L26)),
and calls it **again** just to read the model name
([servicer.py:32](../src/ai_translation/infrastructure/grpc/translation/v1/servicer.py#L32)).
After the first call it is a cheap global lookup.

### Divergence from expectation: the model loads on the first request, not at startup

There's no comment explaining this choice. The earlier guide
([GRPC_SERVER_IMPLEMENTATION.md](./GRPC_SERVER_IMPLEMENTATION.md), Step 2) made
it lazy to keep *imports* cheap. The side effect is that *server startup* is
cheap too, and that has consequences:

- `serve()` prints `gRPC server listening on port 50051`
  ([server.py:25](../src/ai_translation/bootstrap/server.py#L25)) before any
  model exists. An orchestrator that treats "port open" as "ready" sends traffic
  immediately.
- The **first real user request** pays the full download plus load time and will
  likely exceed any sensible client deadline.
- A bad `MODEL_PATH`, a missing HF token, or an out-of-memory error surfaces as a
  failed RPC, not as a crashed container. The process keeps running, reports
  healthy, and fails every request.

### Rough edges

- **Not thread-safe.** The server runs 10 worker threads
  ([server.py:17](../src/ai_translation/bootstrap/server.py#L17)). If two
  requests arrive before the first load finishes, both see `_translator is None`
  and **both construct a model**, which means double the memory and a likely OOM
  on a small GPU. There's no lock.
- **Hard-wired to Qwen.** `NllbTranslatorModel` is imported on line 2 but no
  code path can ever select it.
- **Typo'd type name** (`QwanTranslatorModel`), which is Blocker #1 above.

### Making it production-ready

Load **eagerly at startup**, under a lock, and only report ready after a warm-up
inference succeeds:

```python
import threading

_translator: Translator | None = None
_lock = threading.Lock()


def get_translator() -> Translator:
    global _translator
    if _translator is None:
        with _lock:
            if _translator is None:  # double-checked locking
                _translator = build_translator(settings)  # picks Qwen/NLLB/... from config
    return _translator
```

Then call `get_translator()` plus a tiny warm-up translation inside `serve()`
**before** marking the health service `SERVING`
([Section 8](#section-8--server-bootstrap--concurrency-bootstrapserverpy)). A
bad model path then crashes the container at boot, where your orchestrator can
see it, instead of failing silently on every request.

---

## Section 3 — The Qwen Inference Engine (`QwenTranslatorModel`)

### The problem

Turn `(text, target language, style tags)` into a translation using a
general-purpose instruct LLM (`Qwen/Qwen2.5-1.5B-Instruct`). An LLM has no
built-in translation mode, so translation is expressed as a **prompt**.

### How it's implemented

**1. Resolve which weights to load**
([qwan_translator.py:22-29](../src/ai_translation/domain/translation/qwan_translator.py#L22-L29)).
Priority: constructor arg → `MODEL_PATH` → `QWEN_MODEL_NAME` → hard-coded
default.

```python
self.model_name = (
    model_name
    or os.getenv("MODEL_PATH")
    or os.getenv("QWEN_MODEL_NAME", "Qwen/Qwen2.5-1.5B-Instruct")
)
```

Using `or` means an **empty** `MODEL_PATH=""` (which the Dockerfile sets,
[Dockerfile:54](../Dockerfile#L54)) correctly falls through. That's important,
and NLLB gets it wrong ([Section 4](#section-4--the-nllb-engine-nllbtranslatormodel-not-wired)).

**2. Pick device and dtype**
([qwan_translator.py:52-68](../src/ai_translation/domain/translation/qwan_translator.py#L52-L68)):

| Device available | `device` | `dtype` |
| --- | --- | --- |
| NVIDIA GPU | `cuda` | `float16` |
| Apple Silicon | `mps` | `float16` |
| Neither | `cpu` | `float32` |

**3. Load once and freeze for inference**
([qwan_translator.py:38-48](../src/ai_translation/domain/translation/qwan_translator.py#L38-L48)):
`from_pretrained`, then `.to(device)`, then `.eval()`. `.eval()` disables
dropout. Together with `@torch.inference_mode()` on `translate()`
([line 131](../src/ai_translation/domain/translation/qwan_translator.py#L131)),
it also stops autograd from tracking tensors, which saves memory and time.

**4. Build the prompt**
([qwan_translator.py:70-129](../src/ai_translation/domain/translation/qwan_translator.py#L70-L129)).
Voice tags and emotion tags are merged into one style list. The system message
becomes:

```python
system_prompt = (
    f"You are a professional translator. "
    f"Translate the user's text into "
    f"{translation_params.target_language}. "
    f"{style_instruction} "
    "Preserve the original meaning and context. "
    "Do not explain the translation. "
    "Output ONLY the translated text."
)
```

The user's text goes in as the `user` message, and `apply_chat_template(...,
add_generation_prompt=True)` renders Qwen's chat format ending with the
assistant turn marker.

**5. Generate and strip the prompt**
([qwan_translator.py:146-181](../src/ai_translation/domain/translation/qwan_translator.py#L146-L181)):

```python
input_length = inputs["input_ids"].shape[1]
generated_tokens = outputs[0][input_length:]   # gotcha #3 from Section 0
translation = self.tokenizer.decode(generated_tokens, skip_special_tokens=True)
```

### Generation parameters

| Parameter | Default | What actually happens |
| --- | --- | --- |
| `max_new_tokens` | `256` | Hard cap on output length. Longer translations are **cut off mid-sentence with no error or flag**. |
| `do_sample` | `False` | Greedy decoding, deterministic for a given input. This is the right default for translation. |
| `temperature` | `0.2` | **Only applied when `do_sample=True`** (lines 164-165). With the default it's dead. The servicer never passes any of these three. |
| `truncation` (tokenizer) | `True` | No `max_length` given, so it truncates to `tokenizer.model_max_length`. See rough edges. |

> **If you're new to chat templates:** never hand-write
> `"<|im_start|>system…"` strings. `apply_chat_template` reads the template
> shipped with the tokenizer, so the same code works if you swap to a different
> instruct model. This is one of the better decisions in the file.

### Divergence from expectation

- **`source_language` is never used.** `TranslationParams.source_language` is
  populated by the servicer, but `_build_messages` only references
  `target_language`. The model has to guess the source language. That works
  most of the time for id/zh, but it breaks on short or ambiguous inputs
  ("OK", names, numbers).
- **"Unknown" goes straight into the prompt.** If a caller sends an unsupported
  code, the prompt literally says *"Translate the user's text into Unknown."*
  and the model will do *something*
  ([Section 5](#section-5--input-normalization-utilspy)).
- **Nothing checks the output.** If the model adds a preamble ("Here is the
  translation: …"), echoes the input, or returns an empty string, that goes
  straight back to the client.

### Rough edges

- **Truncation can cut off the instruction.** `truncation=True` removes tokens
  from the **end** of the rendered prompt, and the end is the user text plus the
  `assistant` generation marker. A very long input would lose its tail *and* the
  marker, so the model continues the user text instead of translating it. In
  practice, gRPC's default 4 MB message cap is hit before Qwen's context limit,
  but there is no deliberate input-length policy.
- **`print()` instead of logging**
  ([lines 34-36, 50](../src/ai_translation/domain/translation/qwan_translator.py#L34-L50)).
  These lines have no timestamps or levels and can't be routed. `PYTHONUNBUFFERED=1` in the
  Dockerfile at least makes them show up in `docker logs`.
- **`torch_dtype=` is the legacy kwarg name.** Recent `transformers` versions
  (installed: 5.17.0) prefer `dtype=`. Expect a deprecation warning. It still works.
- **Qwen's own `generation_config.json` sets sampling defaults** (`top_p`,
  `top_k`, `temperature`). Forcing `do_sample=False` overrides them but may log
  "these flags are ignored" warnings on every call.

### Making it production-ready

- **Put the source language in the prompt**, and reject unknown languages
  before they reach the model ([Section 7](#section-7--grpc-transport-adapter-servicerpy)).
- **Set an explicit input budget.** Count tokens *before* generating. Reject or
  **chunk** (split on sentences/paragraphs, translate each, join) anything over
  the budget. Set `max_new_tokens` relative to input length (e.g.
  `min(2 * input_tokens + 32, hard_cap)`) instead of a flat 256.
- **Detect truncation.** If the last generated token is not EOS, the output hit
  the cap. Return it with a flag, or fail with `RESOURCE_EXHAUSTED`. Don't
  silently return half a sentence.
- **Guard the output.** Strip common preambles and quotes. Reject empty output.
  Optionally check that the output's detected language matches the target and
  retry once if it doesn't.
- **Pin the model revision**
  (`from_pretrained(name, revision="<commit sha>")`) so a Hub update can't change
  behavior under you.

---

## Section 4 — The NLLB Engine (`NllbTranslatorModel`), Not Wired

### The problem

NLLB-200 is a **dedicated translation model** (seq2seq, encoder-decoder). It
doesn't need a prompt. You set the source-language code on the tokenizer and
force the first output token to be the target-language code. It's smaller,
faster, and more literal than an LLM, but it can't follow style instructions
(emotion/voice tags).

### How it's implemented

[nllb_translator.py](../src/ai_translation/domain/translation/nllb_translator.py)
maps language *names* to FLORES-200 codes (lines 10-19), sets
`tokenizer.src_lang` (line 65), and generates with
`forced_bos_token_id=<target code>` and 4-beam search (lines 72-77). It
decodes the whole output, with no prompt slicing, because encoder-decoder
models don't echo input (compare gotcha #3).

### Divergence from expectation

**Nothing ever calls it.** `get_translator()` always builds Qwen. The `.env`
checked into your local working copy sets `NLLB_MODEL_NAME`, which Qwen never
reads. Anyone who sets that variable thinking they switched engines is still
running Qwen.

### Rough edges (fix these before wiring it)

- **Emotion/voice tags are silently dropped.** NLLB has no way to use them.
- **`MODEL_PATH=""` breaks it.** It uses `os.environ.get("MODEL_PATH", …)`
  (line 26-28), which returns `""` when the variable is *set but empty*, and the
  Dockerfile sets exactly that ([Dockerfile:54](../Dockerfile#L54)). The result
  is `from_pretrained("")`, which fails. Qwen uses `or`, which handles this.
- **`MODEL_PATH` is shared between engines.** A Qwen checkpoint path given to
  NLLB (or the reverse) fails with a confusing architecture error.
- **Korean is missing from `LANG_CODE_MAP`**, although `utils.LANGUAGES`
  offers `ko`. Unmapped names pass through unchanged (line 53), so
  `"Korean"`/`"Unknown"` gets looked up as a token id and silently becomes the
  unknown token.
- **Thread-unsafe shared state.** `self.tokenizer.src_lang = src_code`
  (line 65) mutates the shared tokenizer. With 10 worker threads, request A (id)
  can have its source language overwritten by request B (zh) between line 65
  and line 67. Pass `src_lang` per call instead of mutating the tokenizer.
- `getattr(translation_params, "source_language", "eng_Latn")` (line 61): the
  default can never apply because the dataclass field always exists.

---

## Section 5 — Input Normalization (`utils.py`)

### The problem

Clients send short codes (`"id"`, `"zh"`, `"formal"`). The LLM prompt needs
human-readable names (`"Indonesian"`, `"Chinese"`). Input text may also contain
junk characters.

### How it's implemented

Three lookup tables with an `"Unknown"` fallback
([utils.py:3-58](../src/ai_translation/domain/translation/utils.py#L3-L58)),
plus a regex sanitizer
([utils.py:61-71](../src/ai_translation/domain/translation/utils.py#L61-L71)):

```python
return re.sub(
    r"[^a-zA-Z0-9\s.,!?;:'\"()\[\]{}\-–—/]",
    "",
    text,
)
```

| Table | Codes | Fallback |
| --- | --- | --- |
| `LANGUAGES` | `en id fr de es ja ko zh` | `"Unknown"` |
| `EMOTIONS` | `neutral happy sad angry fearful surprised disgusted excited calm confused serious` | `"Unknown"` |
| `VOICES` | `professional casual friendly formal empathetic confident enthusiastic calm serious persuasive energetic reassuring urgent instructional conversational` | `"Unknown"` |

### Divergence from expectation: `remove_unique_codes` is an ASCII allowlist

The docstring says it preserves *"letters, numbers, whitespace, and
punctuation"*. It actually preserves **ASCII** letters only. Verified:

```text
'你好，我想提出异议。'            -> ''
'Je suis très fâché — ça va?'   -> 'Je suis trs fch — a va?'
'Größe über München'            -> 'Gre ber Mnchen'
'Selamat pagi, Bu! 100%'        -> 'Selamat pagi, Bu! 100'
```

Consequences today:

- **Any Chinese, Japanese, or Korean source text becomes an empty string.** The model then
  "translates" nothing (or hallucinates). This is the `zh → id` direction of the
  core product.
- French/German/Spanish lose every accented letter.
- `%`, `@`, `#`, `&`, `+`, `=`, currency symbols, and emoji are removed, so
  prices, emails, and hashtags are corrupted.
- It's applied in both callers:
  [servicer.py:19](../src/ai_translation/infrastructure/grpc/translation/v1/servicer.py#L19)
  and [main.py:27](../src/ai_translation/main.py#L27).

### Rough edges

- **`"Unknown"` is a silent failure value.** An unsupported language (`"zh-CN"`,
  `"cn"`, `"EN"`) doesn't raise. It becomes `"Unknown"` and flows into the
  prompt. Codes are case-sensitive: `"EN"` is unknown.
- **`"formal"` is a voice, not an emotion.** The demo passes
  `get_emotion_name("formal")`
  ([main.py:22,31](../src/ai_translation/main.py#L22)), which returns
  `"Unknown"`. The prompt then asks for style *"Professional, Unknown"*.
- Unknown tags are *included* in the style list, not dropped.

### Making it production-ready

Replace the allowlist with a **denylist of what's actually harmful**: control
and zero-width characters, normalized with Unicode NFC. Then validate codes
strictly instead of falling back:

```python
import unicodedata

_CONTROL = {"Cc", "Cf"}  # control + format (zero-width, bidi overrides)


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    return "".join(
        ch for ch in text
        if ch in "\n\t" or unicodedata.category(ch) not in _CONTROL
    ).strip()


def require_language(code: str) -> str:
    try:
        return LANGUAGES[code.lower()]
    except KeyError:
        raise UnsupportedLanguageError(code)  # -> INVALID_ARGUMENT
```

---

## Section 6 — Data Contracts (`dto.py`)

### The problem

The domain needs its own request/response types so it doesn't depend on
generated protobuf classes.

### How it's implemented

There are two generations side by side in
[dto.py](../src/ai_translation/domain/translation/dto.py):

| Type | Lines | Mutable? | Used by |
| --- | --- | --- | --- |
| `TranslationParams` | [4-10](../src/ai_translation/domain/translation/dto.py#L4-L10) | yes | Both engines, servicer, `main.py` |
| `TranslationContext` | [13-17](../src/ai_translation/domain/translation/dto.py#L13-L17) | frozen | **nothing** |
| `TranslationRequest` | [20-28](../src/ai_translation/domain/translation/dto.py#L20-L28) | frozen | **nothing** |
| `TranslationResult` | [31-37](../src/ai_translation/domain/translation/dto.py#L31-L37) | frozen | **nothing** |

### Divergence from expectation

The unused generation is the **better** one. `TranslationRequest` carries
optional context (title, surrounding text, domain), which matters for a
"context-aware" assistant. `TranslationResult` carries `provider` and `model`,
so the engine reports what it ran instead of the servicer reaching into
`get_translator().model.name_or_path`
([servicer.py:32](../src/ai_translation/infrastructure/grpc/translation/v1/servicer.py#L32)).
Pick one generation. Don't let both grow.

### Rough edges

- `emotions_tags` (plural "emotions") in `TranslationParams` vs `emotion_tags`
  in the proto. The servicer bridges the names. Grep for both.

### Making it production-ready

Make the engine interface `translate(TranslationRequest) -> TranslationResult`,
frozen in and frozen out, and add the fields production needs: `finish_reason`
(`"stop"` / `"length"`), `input_tokens`, `output_tokens`, `latency_ms`. These
become your metrics ([Section 11](#section-11--production-blueprint)).

---

## Section 7 — gRPC Transport Adapter (`servicer.py`)

### The problem

Map a protobuf `TranslateRequest` to a domain call, and map the result (or
failure) back to a `TranslateResponse` plus a gRPC status code.

### How it's implemented

Everything happens in one `try` block
([servicer.py:16-37](../src/ai_translation/infrastructure/grpc/translation/v1/servicer.py#L16-L37)):
normalize the input, call `get_translator().translate()`, and echo the request's
language codes back with the model name. Any exception becomes:

```python
except Exception as exc:
    context.set_code(grpc.StatusCode.INTERNAL)
    context.set_details(str(exc))
    return translation_pb2.TranslateResponse()
```

> **If you're new to gRPC Python:** setting a non-OK code on `context` and
> returning an empty message is the standard way to fail a unary RPC. The client
> sees an `RpcError` with that code and details. It never sees the empty
> response. `context.abort(code, details)` does the same thing by raising.

### Divergence from expectation

- **Every failure is `INTERNAL`.** A client bug (unsupported language, empty
  text) and a server bug (CUDA OOM) look the same to the Go backend, so it
  can't decide whether to retry.
- **Nothing ever fails for bad input.** Empty text, unknown languages, and
  a 3 MB paste all go through to the model (see
  [Section 5](#section-5--input-normalization-utilspy)).
- **`str(exc)` is sent to the client.** Hugging Face and PyTorch exceptions
  include local file paths, model paths, and sometimes Hub URLs.

### Rough edges

- **No deadline or cancellation handling.** If the Go client times out and
  disconnects, `generate()` keeps running to completion and holds the device
  for a response nobody will read. Under load, this is how a slow server
  turns into a dead one.
- **No logging.** An exception is converted to a status and forgotten. There's
  no server-side stack trace anywhere.

### Making it production-ready

Map a small domain error taxonomy to status codes. Log the full exception
server-side and send a generic message to the client:

| Domain condition | gRPC status | Client should retry? |
| --- | --- | --- |
| Empty text, unsupported language/tag | `INVALID_ARGUMENT` | No |
| Input over token budget | `INVALID_ARGUMENT` (or `RESOURCE_EXHAUSTED`) | No, chunk it |
| Model not loaded yet / warming up | `UNAVAILABLE` | Yes, with backoff |
| Inference queue full | `RESOURCE_EXHAUSTED` | Yes, with backoff |
| Client deadline already passed | `DEADLINE_EXCEEDED` | Caller decides |
| Anything else (OOM, bug) | `INTERNAL` | Maybe once |

```python
def Translate(self, request, context):
    try:
        req = to_domain(request)                      # raises ValidationError
        if context.time_remaining() is not None and context.time_remaining() < MIN_BUDGET_S:
            context.abort(grpc.StatusCode.DEADLINE_EXCEEDED, "insufficient deadline")
        result = self._engine.translate(req)          # injected, not a global
        return to_proto(result)
    except ValidationError as e:
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(e))   # safe, user-facing
    except QueueFullError:
        context.abort(grpc.StatusCode.RESOURCE_EXHAUSTED, "server busy")
    except Exception:
        log.exception("translate failed", extra={"request_id": request_id(context)})
        context.abort(grpc.StatusCode.INTERNAL, "internal error")
```

Pass the engine into the servicer's constructor
(`TranslationServicer(engine)`) instead of calling the global
`get_translator()`. Tests then need no `patch()`.

---

## Section 8 — Server Bootstrap & Concurrency (`bootstrap/server.py`)

### The problem

Run a long-lived process that accepts concurrent RPCs, shares one model, and
starts and stops cleanly under an orchestrator (Docker, ECS, Kubernetes).

### How it's implemented

The whole file is 30 lines
([server.py:13-26](../src/ai_translation/bootstrap/server.py#L13-L26)):
`load_dotenv()`, a 10-thread pool, one servicer, an insecure port on all
interfaces, `start()`, then `wait_for_termination()`.

| Setting | Value | Source |
| --- | --- | --- |
| Worker threads | 10 | [server.py:17](../src/ai_translation/bootstrap/server.py#L17), hard-coded |
| Bind address | `[::]:$GRPC_PORT` (default 50051) | [server.py:15,22](../src/ai_translation/bootstrap/server.py#L15-L22) |
| Transport security | None (`add_insecure_port`) | [server.py:22](../src/ai_translation/bootstrap/server.py#L22) |
| Max message size | gRPC default (4 MB receive) | not set |
| Health service | None | — |
| Reflection | None | — |
| Signal handling | None | — |

### Divergence from expectation: no graceful shutdown

`docker stop` sends `SIGTERM` to PID 1, which here is the Python process
(`CMD ["ai-translation-serve"]`, exec form, [Dockerfile:100](../Dockerfile#L100)).
No handler is installed, so Python's default behavior applies: **the process
dies immediately and in-flight translations are dropped.** A rolling deploy
returns errors for whatever was mid-generation.

### Divergence from expectation: 10 threads ≠ 10× throughput

See gotcha #2. All 10 threads call `generate()` on the **same** model instance.
On CUDA they serialize on the device and contend for the GIL between kernel
launches. Latency for every request goes up and throughput stays roughly flat.
On MPS, concurrent use of one model from multiple threads is not a supported
pattern and can crash. Combined with no backpressure, a traffic spike queues
requests in memory until they all time out.

### Rough edges

- No health service means a load balancer can only do a TCP check, which
  passes before the model is loaded ([Section 2](#section-2--model-lifecycle-get_translator)).
- Insecure transport on `[::]` is acceptable **only** inside a private network
  behind the Go backend. It isn't enforced anywhere.

### Making it production-ready

```python
import signal, threading
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

SERVICE = "translation.v1.TranslationService"


def serve() -> None:
    settings = Settings()                                 # validated config, fail fast
    configure_logging(settings.log_level)

    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=settings.grpc_workers),
        maximum_concurrent_rpcs=settings.max_queued_rpcs,  # backpressure -> RESOURCE_EXHAUSTED
        interceptors=[RequestIdInterceptor(), MetricsInterceptor()],
        options=[("grpc.max_receive_message_length", settings.max_request_bytes)],
    )
    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    health_servicer.set(SERVICE, health_pb2.HealthCheckResponse.NOT_SERVING)

    engine = build_translator(settings)                   # eager load: crash here, not on request #1
    engine.warmup()                                       # one tiny translation
    add_TranslationServiceServicer_to_server(TranslationServicer(engine), server)

    server.add_insecure_port(f"[::]:{settings.grpc_port}")  # or add_secure_port + TLS creds
    server.start()
    health_servicer.set(SERVICE, health_pb2.HealthCheckResponse.SERVING)
    log.info("ready", extra={"model": engine.model_id, "device": engine.device})

    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    stop.wait()

    health_servicer.enter_graceful_shutdown()             # LB stops routing new traffic
    server.stop(grace=settings.shutdown_grace_s).wait()   # let in-flight generations finish
```

For the concurrency itself, pick one:

1. **Serialize explicitly** (simplest, right for one GPU at low QPS). Wrap
   `generate()` in a `threading.Semaphore(1)` (or N for N model replicas). Use
   `acquire(timeout=…)` and turn a timeout into `RESOURCE_EXHAUSTED`. Latency is
   predictable and nothing races.
2. **Micro-batching.** One background thread drains a queue, pads up to *B*
   requests into a single `generate()` call, and resolves each caller's future.
   This gives several times the throughput on a GPU but takes real work to get
   right (padding side, per-item `max_new_tokens`).
3. **Move inference out of process.** Run vLLM or TGI and make this service a
   thin gRPC → HTTP client. You get continuous batching and paged KV cache
   without writing them. This is the right answer once QPS or model size grows.

---

## Section 9 — Configuration, Image & Model Storage

### The problem

The same code must run on a laptop (MPS), in CI (CPU), and on a GPU host, with
the weights downloaded once and not on every deploy.

### How it's implemented

| Variable | Read by | Default | Notes |
| --- | --- | --- | --- |
| `GRPC_PORT` | [server.py:15](../src/ai_translation/bootstrap/server.py#L15) | `50051` | |
| `MODEL_PATH` | Qwen [L24](../src/ai_translation/domain/translation/qwan_translator.py#L24), NLLB [L27](../src/ai_translation/domain/translation/nllb_translator.py#L27) | Dockerfile: `""` | Shared by both engines |
| `QWEN_MODEL_NAME` | Qwen [L25-28](../src/ai_translation/domain/translation/qwan_translator.py#L25-L28) | `Qwen/Qwen2.5-1.5B-Instruct` | Also set in [Dockerfile:55](../Dockerfile#L55) |
| `NLLB_MODEL_NAME` | NLLB [L27](../src/ai_translation/domain/translation/nllb_translator.py#L27) | `facebook/nllb-200-distilled-600M` | Engine is never used |
| `MODEL_NAME` | **nothing** | — | Documented in [.env.example:11](../.env.example#L11) and [MODEL_STORAGE.md](./MODEL_STORAGE.md), but ignored |
| `HF_TOKEN` | `huggingface_hub`, implicitly | — | |
| `HF_HOME` | `huggingface_hub` | `/models/huggingface` ([Dockerfile:50](../Dockerfile#L50)) | |

The image is a two-stage `uv` build ([Dockerfile](../Dockerfile)) that runs as a
non-root `app` user, disables HF telemetry, and **deliberately does not bake
weights in** (comment at [Dockerfile:79-83](../Dockerfile#L79-L83)).

### Divergence from expectation: the model cache volume is mounted at the wrong path

`make docker-run` mounts the cache volume at `/app/.cache/huggingface`
([Makefile:91](../Makefile#L91)), but the image now sets
`HF_HOME=/models/huggingface` ([Dockerfile:50](../Dockerfile#L50)). The volume
is never written to. **Every container run downloads the ~3 GB again**, which is
the exact problem [MODEL_STORAGE.md](./MODEL_STORAGE.md) says was solved. That
doc predates the Dockerfile change and now cites a stale path.

### ⚠️ Your HF token ends up in the image

`.dockerignore` excludes `.venv` and `.git` but **not `.env`**
([.dockerignore](../.dockerignore)). `COPY . /app` ([Dockerfile:28](../Dockerfile#L28))
copies your local `.env`, including `HF_TOKEN`, into the builder stage. The
runtime stage then copies all of `/app` from the builder
([Dockerfile:76](../Dockerfile#L76)). Anyone who pulls `sdewa/ai-translation`
can read the token. Add `.env` (and `.cache`) to `.dockerignore` and rotate the
token if an image was ever pushed.

### Rough edges

- `TRANSFORMERS_CACHE` ([Dockerfile:51](../Dockerfile#L51)) is deprecated in
  favor of `HF_HOME`. It's harmless but misleading.
- `make gen-proto` uses `sed -i ''` ([Makefile:65](../Makefile#L65)), which is
  BSD/macOS syntax. On GNU sed (Linux CI, the Docker builder) it fails. Codegen
  only works on a Mac today.
- `requests` and `accelerate` are declared dependencies
  ([pyproject.toml:12,15](../pyproject.toml#L12-L15)) but nothing imports them.
  `accelerate` becomes useful if you adopt `device_map="auto"`.
- There's no `tests/` directory, although `make test` and the README reference one.

### Making it production-ready

- One typed `Settings` object (e.g. `pydantic-settings`) read **once** in
  `serve()` and passed down. No `os.getenv` inside the engines. Validate at boot:
  unknown engine name, missing path → crash immediately with a clear message.
- Separate variables per engine, or one `TRANSLATION_ENGINE=qwen|nllb` plus
  `MODEL_ID` / `MODEL_REVISION`.
- Pre-stage weights (S3 sync in an init container, a baked image, or a
  pre-populated volume), then run with `HF_HUB_OFFLINE=1` so production **never**
  depends on the Hub being reachable at boot.
- Fix the volume path, `.dockerignore`, and the `sed` portability.

---

## Section 10 — Cross-Feature Coupling

Things outside the AI layer that change its behavior. Know about them before
you refactor the other side.

- **The Go backend's deadline defines your latency budget.** Right now the
  server ignores deadlines ([Section 7](#section-7--grpc-transport-adapter-servicerpy)),
  so a short Go timeout does nothing but waste GPU. If you add queueing, the Go
  side needs retry-with-backoff on `UNAVAILABLE`/`RESOURCE_EXHAUSTED` or
  requests just fail.
- **Hugging Face Hub availability affects the first request.** With lazy loading
  and no offline mode, a Hub outage or rate limit (no `HF_TOKEN`) makes the
  first `Translate` call fail at runtime, not at deploy.
- **`load_dotenv()` ordering.** Both entry points call it at the top of the
  function ([server.py:14](../src/ai_translation/bootstrap/server.py#L14),
  [main.py:14](../src/ai_translation/main.py#L14)). The engines read env vars
  inside `__init__`, not at import time, so this works. If you move config reads
  to module level, `.env` will be silently ignored.
- **`make gen-proto` rewrites the generated imports.** The `sed` post-step
  ([Makefile:64-65](../Makefile#L64-L65)) changes `from translation.v1 import`
  to a relative import. If you regenerate without it (or on Linux, where it
  fails), the servicer's import breaks.
- **`docker-run --env-file .env`** ([Makefile:92](../Makefile#L92)) injects
  whatever is in your local `.env`, including `NLLB_MODEL_NAME`, which today
  does nothing.
- **The proto contract is shared with another service.** Changing
  `TranslateRequest` fields requires regenerating stubs in the Go backend too.
  Add fields; don't renumber them.

---

## Section 11 — Production Blueprint

This section pulls the "making it production-ready" blocks together into one
target design. The folder layout already exists. It just needs filling in.

```text
bootstrap/
  settings.py        # typed config, validated at boot
  logging.py         # JSON logs, request_id in every line
  server.py          # composition root: eager load, health, signals, interceptors
domain/translation/
  dto.py             # TranslationRequest / TranslationResult (one generation)
  errors.py          # ValidationError, UnsupportedLanguageError, QueueFullError, ...
  ports.py           # class Translator(Protocol): translate(req) -> result; warmup()
  normalize.py       # Unicode-safe cleanup + strict code validation
  service.py         # chunking, output guards, truncation detection. Engine-agnostic.
infrastructure/ai/
  hf_causal.py       # Qwen (from qwan_translator.py)
  hf_seq2seq.py      # NLLB (from nllb_translator.py)
  factory.py         # build_translator(settings) -> Translator
  limiter.py         # semaphore / batch queue around generate()
infrastructure/grpc/
  servicer.py        # thin: proto <-> DTO, error -> status code
  interceptors.py    # request id, metrics, access log
```

### The rules behind it

| Concern | Rule | Why |
| --- | --- | --- |
| **Model lifecycle** | Load eagerly at boot, once, under a lock. Warm up. Only then report `SERVING`. | Failures show up at deploy time, and no user pays the cold start. |
| **Provider abstraction** | Domain code depends on a `Translator` protocol. Engines live in `infrastructure/ai/`. | Swapping Qwen → NLLB → vLLM → hosted API is config, not code. Tests use a fake. |
| **Input contract** | Validate strictly and reject with `INVALID_ARGUMENT`. Unicode-safe normalization. Token budget. | Garbage in is the most common LLM failure, and it must never reach the model. |
| **Prompting** | Chat template, source *and* target language, style tags from an allowlist. | Deterministic, model-portable prompts. |
| **Decoding** | Greedy for translation. `max_new_tokens` scaled to input. Detect `finish_reason="length"`. | No silent truncation. |
| **Output contract** | Strip preambles, reject empty output, optionally check the output language. | "Output ONLY the translation" is a request, not a guarantee. |
| **Concurrency** | Bounded: semaphore or batch queue plus `maximum_concurrent_rpcs`. Shed load with `RESOURCE_EXHAUSTED`. | Keeps latency predictable instead of every request timing out together. |
| **Deadlines** | Check `context.time_remaining()` before generating. Stop generation on cancel (a `StoppingCriteria` that checks `context.is_active()`). | Don't burn GPU for callers who have left. |
| **Errors** | Domain error taxonomy → status codes. Log the stack trace server-side. Generic details to clients. | Clients can decide whether to retry, and internals don't leak. |
| **Observability** | Structured logs with `request_id` (from gRPC metadata). Metrics: request latency, queue wait, input/output tokens, tokens/sec, truncation rate, error rate by code, GPU memory. | You can't tune what you can't see. Tokens/sec is the key capacity metric. |
| **Lifecycle** | SIGTERM → health `NOT_SERVING` → `server.stop(grace)`. | Zero-error rolling deploys. |
| **Security** | TLS/mTLS or network isolation. No secrets in the image. Non-root (done). Size limits. | The service accepts arbitrary text from upstream. |
| **Model artifacts** | Pinned `revision`. Weights pre-staged. `HF_HUB_OFFLINE=1`. Model id and revision in every response and log line. | Reproducible behavior, and boot doesn't depend on the Hub. |
| **Quality** | A golden set of id↔zh sentences (with style tags), scored (chrF/COMET, or LLM-as-judge) on every model or prompt change. | Prompt and model changes are code changes and need regression tests. |
| **Testing** | Unit: servicer + service with a fake `Translator`. Integration: real tiny model on CPU in CI. Load: `ghz` against the gRPC endpoint. | Covers correctness, wiring, and capacity separately. |

### Production readiness checklist, today

| Item | Status | Where |
| --- | --- | --- |
| Server starts | ❌ ImportError | [\_\_init\_\_.py:1](../src/ai_translation/domain/translation/__init__.py#L1) |
| Non-Latin input preserved | ❌ Stripped | [utils.py:61-71](../src/ai_translation/domain/translation/utils.py#L61-L71) |
| Model loaded once per process | ⚠️ Yes, but racy and lazy | [\_\_init\_\_.py:15-19](../src/ai_translation/domain/translation/__init__.py#L15-L19) |
| `inference_mode` + `eval()` | ✅ | [qwan_translator.py:48,131](../src/ai_translation/domain/translation/qwan_translator.py#L48) |
| Device/dtype auto-selection | ✅ | [qwan_translator.py:52-68](../src/ai_translation/domain/translation/qwan_translator.py#L52-L68) |
| Chat template (not hand-rolled prompt) | ✅ | [qwan_translator.py:125](../src/ai_translation/domain/translation/qwan_translator.py#L125) |
| Prompt tokens stripped from output | ✅ | [qwan_translator.py:172-174](../src/ai_translation/domain/translation/qwan_translator.py#L172-L174) |
| Deterministic decoding | ✅ `do_sample=False` | [qwan_translator.py:138](../src/ai_translation/domain/translation/qwan_translator.py#L138) |
| Source language used | ❌ | [qwan_translator.py:98-106](../src/ai_translation/domain/translation/qwan_translator.py#L98-L106) |
| Input validation / token budget | ❌ | — |
| Truncation detection | ❌ | — |
| Output guards | ❌ | — |
| Error → status code mapping | ⚠️ All `INTERNAL`, details leaked | [servicer.py:34-37](../src/ai_translation/infrastructure/grpc/translation/v1/servicer.py#L34-L37) |
| Deadlines / cancellation | ❌ | — |
| Bounded concurrency / backpressure | ❌ | [server.py:17](../src/ai_translation/bootstrap/server.py#L17) |
| Health checks | ❌ | — |
| Graceful shutdown | ❌ | — |
| Structured logging / metrics | ❌ `print()` only | — |
| Non-root container | ✅ | [Dockerfile:60-66,90](../Dockerfile#L60-L66) |
| Secrets kept out of image | ❌ `.env` copied | [.dockerignore](../.dockerignore) |
| Model cache persists | ❌ Volume path mismatch | [Makefile:91](../Makefile#L91) vs [Dockerfile:50](../Dockerfile#L50) |
| Pinned model revision / offline mode | ❌ | — |
| Tests | ❌ No `tests/` | — |

---

## Section 12 — Peripheral Pieces (not part of the request path)

These pieces don't carry runtime AI logic. Knowing where they are keeps them from
being confused with the real flow.

- **[main.py](../src/ai_translation/main.py)** is a demo script with a hard-coded
  Indonesian sentence. It's run with `make run` / `ai-translation`. It shares the
  domain layer with the server, so it is also broken by Blocker #1 and passes
  the wrong tag (`"formal"` as an emotion, [main.py:22](../src/ai_translation/main.py#L22)).
  It's useful as a smoke test once fixed.
- **[translation_pb2.py / translation_pb2_grpc.py](../src/ai_translation/infrastructure/grpc/translation/v1/)**
  are generated. Never edit them by hand. `TranslationServiceStub`
  ([translation_pb2_grpc.py:32](../src/ai_translation/infrastructure/grpc/translation/v1/translation_pb2_grpc.py#L32))
  is the client you'd use in integration tests. The `TranslationService` class at
  line 77 is gRPC's experimental API and isn't used.
- **[infrastructure/ai/](../src/ai_translation/infrastructure/ai/)** and
  **[shared/](../src/ai_translation/shared/)** are empty packages, reserved for
  the provider layer (Section 11).
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** shows a planned tree
  (`container.py`, `openai_provider.py`, `ports.py`, …) that **does not exist**.
  Treat it as a plan. **[MODEL_STORAGE.md](./MODEL_STORAGE.md)** and
  **[GRPC_SERVER.md](./GRPC_SERVER.md)** describe earlier states (`NLLBModel`,
  `MODEL_NAME`, `/app/.cache/huggingface`, missing servicer) that have since
  changed.

---

## Summary — Data Flow

### Startup (today)

```text
docker run / make serve
  └─ ai-translation-serve → bootstrap.server:serve()
       ├─ import servicer → import domain.translation
       │    └─ ✗ ImportError: QwanTranslatorModel        ← stops here at HEAD
       ├─ load_dotenv()
       ├─ grpc.server(ThreadPoolExecutor(10))
       ├─ add_insecure_port([::]:50051); start()
       ├─ print("listening")                                  ← no model loaded yet
       └─ wait_for_termination()
```

### Happy path: first request (once Blocker #1 is fixed)

```text
Go backend ──Translate{text,"id","zh",tags}──▶ TranslationServicer.Translate
  1. remove_unique_codes(text)                 (ASCII-only filter)
  2. "id"→"Indonesian", "zh"→"Chinese", tags→names ("Unknown" if unmapped)
  3. get_translator()  → _translator is None → QwenTranslatorModel()
        resolve MODEL_PATH / QWEN_MODEL_NAME → pick device/dtype
        from_pretrained (download to HF_HOME if missing) → .to(device) → .eval()
  4. _build_messages: system prompt (target lang + style), user = text
  5. apply_chat_template → tokenize(truncation=True) → .to(device)
  6. model.generate(max_new_tokens=256, do_sample=False)
  7. slice off prompt tokens → decode → strip
  8. TranslateResponse{translated_text, "id", "zh", model=name_or_path}
◀─────────────────────────────────────────────
```

Later requests skip step 3's load and go straight to the cached instance.

### Error path

```text
any exception in steps 1–8 (OOM, bad MODEL_PATH, Hub unreachable, bug)
  → context.set_code(INTERNAL); context.set_details(str(exc))   ← raw message to client
  → return empty TranslateResponse
  → nothing logged server-side; process stays up and keeps accepting traffic

inputs that *should* fail but don't:
  empty text / Mandarin source (→ "" after filter) / unknown language (→ "Unknown")
  → reach the model → return OK with a meaningless translation
```

### Shutdown

```text
docker stop → SIGTERM → Python default handler → process exits immediately
  → in-flight generate() calls dropped; clients see UNAVAILABLE
```

---

## Final Reference Table

### RPCs

| Method | Endpoint | Purpose | Status |
| --- | --- | --- | --- |
| unary | `translation.v1.TranslationService/Translate` | Translate text with optional emotion/voice style | ✅ Implemented (blocked by ImportError at HEAD) |
| unary | `grpc.health.v1.Health/Check` | Readiness/liveness | ❌ Not registered |
| stream | `grpc.reflection.v1alpha.ServerReflection` | Introspection for `grpcurl` | ❌ Not registered |

### Proto fields → domain

| Proto field | Domain field | Transform |
| --- | --- | --- |
| `text` | `TranslationParams.text` | `remove_unique_codes` (ASCII-only) |
| `source_language` | `.source_language` | code → name, `"Unknown"` fallback; **unused by Qwen** |
| `target_language` | `.target_language` | code → name, `"Unknown"` fallback |
| `emotion_tags` | `.emotions_tags` | each → name, `"Unknown"` fallback |
| `voice_tags` | `.voice_tags` | each → name, `"Unknown"` fallback |
| → `model` | `get_translator().model.name_or_path` | Hub id or local path |

### Entry points & make targets

| Command | Runs | Notes |
| --- | --- | --- |
| `make serve` / `ai-translation-serve` | `bootstrap.server:serve` | The production entry point, also the Docker `CMD` |
| `make run` / `ai-translation` | `ai_translation:main` | Demo script, not a server |
| `make gen-proto` | `grpc_tools.protoc` + `sed` fix-up | macOS only (`sed -i ''`) |
| `make docker-build` / `docker-run` | Build / run `sdewa/ai-translation:latest` | Volume path mismatch, see Section 9 |
| `make test` | `pytest` | No tests exist |
