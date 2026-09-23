# Model Weight Storage & Caching — As Implemented

## Who This Doc Is For

Anyone deploying `ai-translation` to EC2 (or any container host) who has noticed the
model weights get re-downloaded from the Hugging Face Hub on every redeploy, and
anyone who wants to swap in a self-trained/fine-tuned checkpoint instead of the
stock Hub model.

This doc is verified against the current source (Dockerfile, Makefile, and
`nllb_translator.py` as of this writing) — not an idealized description. Read it
before changing deploy config, since the "why it re-downloads" section explains a
container-lifecycle detail that isn't obvious from the Dockerfile alone.

## Section 1 — Why the Model Re-Downloads Today

| Concern                                       | Owner                                                                                                                                                                      | What actually happens                                                                                                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where weights are cached inside the container | `HF_HOME=/app/.cache/huggingface` ([Dockerfile:33](../Dockerfile#L33))                                                                                                     | `transformers`/`huggingface_hub` download weights into this path on first use.                                                                                                     |
| What triggers a download                      | `AutoTokenizer.from_pretrained` / `AutoModelForCausalLM.from_pretrained` ([nllb_translator.py:29-32](../src/ai_translation/domain/translation/nllb_translator.py#L29-L32)) | Called lazily the first time `get_translator()` is invoked — not at container startup.                                                                                             |
| Container filesystem lifetime                 | `docker run --rm ...` ([Makefile:88](../Makefile#L88), prior to this change)                                                                                               | `--rm` deletes the container (and everything written under `/app/.cache/huggingface`) as soon as it stops. A redeploy is a **new container from the image**, so the cache is gone. |

Put together: the cache path is real and correctly set, but it lives **inside the
ephemeral container**, not on anything that survives a `docker rm` / redeploy. On
EC2 this means every `docker-build` + `docker-run` cycle (or ECS task
replacement, or `git pull` + restart if you run bare-metal) re-downloads the same
~3 GB of weights from the Hub.

> **Worth flagging:** the Dockerfile itself never mounts a volume at
> `HF_HOME` — it only sets the env var. Nothing in the image build/run path
> before this change persisted that directory anywhere.

## Section 2 — How Model Loading Actually Works

`NLLBModel.__init__` resolves which model to load in this order
([nllb_translator.py:9-20](../src/ai_translation/domain/translation/nllb_translator.py#L9-L20)):

```python
class NLLBModel:
    def __init__(
        self,
        model_name: str | None = None,
    ):
        if model_name is None:
            model_name = os.environ.get(
                "MODEL_PATH", os.environ.get("MODEL_NAME", "Qwen/Qwen2.5-1.5B-Instruct")
            )
```

| Env var         | Priority      | Purpose                                                                                                        |
| --------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| `MODEL_PATH`    | 1st (highest) | Local/mounted directory containing a `save_pretrained()`-style checkpoint — use this for a self-trained model. |
| `MODEL_NAME`    | 2nd           | Hugging Face Hub model id to download instead of the default.                                                  |
| _(neither set)_ | fallback      | `Qwen/Qwen2.5-1.5B-Instruct`, downloaded from the Hub each cold start.                                         |

`model_name` is resolved lazily inside `__init__`, not as a default parameter
value — this matters because `main.py`/`server.py` call `load_dotenv()` at the
start of `main()`/`serve()` ([main.py:13](../src/ai_translation/main.py#L13),
[server.py:12](../src/ai_translation/bootstrap/server.py#L12)), which happens
_after_ Python has already imported `nllb_translator.py`. A default-argument
expression would have been evaluated once at import time, before `.env` was
loaded, and would silently ignore your env vars — the lazy `if model_name is
None:` check inside the function body avoids that trap.

## Section 3 — Storage Options

Pick based on what you're optimizing for:

| Option                                | How                                                                                                                        | Survives redeploy?                                                              | Good for                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Named Docker volume** (implemented) | `-v ai-translation-model-cache:/app/.cache/huggingface` ([Makefile:88-90](../Makefile#L88-L90))                            | Yes, as long as the volume isn't removed and you stay on the same EC2 instance. | Quick fix for single-instance EC2 deploys.                               |
| **EBS-backed host directory**         | `-v /mnt/model-cache:/app/.cache/huggingface` where `/mnt/model-cache` is a mounted EBS volume                             | Yes, and portable if you snapshot/reattach the EBS volume to a new instance.    | EC2 deploys where the instance itself may be replaced (ASG, blue/green). |
| **S3 as the source of truth**         | Sync `s3://your-bucket/models/<name>` to a local dir on container start (init script/entrypoint), point `MODEL_PATH` at it | Yes, decoupled from any single instance/volume.                                 | Multi-instance deploys, or sharing one checkpoint across environments.   |
| **Bake weights into the image**       | `COPY` a local checkpoint dir into the image during `docker build`, set `MODEL_PATH` to that path                          | Yes, but grows image size and requires a rebuild to update weights.             | Immutable, fully offline deploys.                                        |

The named-volume change already applied to [Makefile](../Makefile) covers the
common single-EC2-instance case. For an EBS volume or S3 sync, only the mount
source changes — `MODEL_PATH`/`HF_HOME` destination stays the same.

## Section 4 — Bringing Your Own (Self-Trained) Model

To use a fine-tuned checkpoint instead of the Hub model:

1. Fine-tune and save it with `model.save_pretrained(path)` /
   `tokenizer.save_pretrained(path)` — this produces the standard
   `config.json`, `tokenizer.json`, and weight shard files `transformers`
   expects.
2. Put that directory somewhere persistent (the mounted volume/EBS/S3 sync
   path from Section 3).
3. Set `MODEL_PATH` (in `.env` or the container's environment) to that
   directory. It takes priority over `MODEL_NAME`
   ([nllb_translator.py:16-19](../src/ai_translation/domain/translation/nllb_translator.py#L16-L19)), so no code change is needed to switch between the
   stock model and your own.

> **Rough edge:** there's no validation that `MODEL_PATH` actually contains a
> valid checkpoint — an empty or wrong directory fails inside
> `AutoTokenizer.from_pretrained` with a generic Hugging Face error, not a
> project-specific one.

## Section 5 — Cross-Cutting: What Changed vs. Before

| File                                                                              | Before                              | After                                                                                           |
| --------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Dockerfile](../Dockerfile)                                                       | `HF_HOME` set, nothing mounts it    | unchanged — still just sets the path; persistence now comes from the run command, not the image |
| [Makefile](../Makefile#L86-L90)                                                   | `docker-run` had no volume/env-file | mounts `ai-translation-model-cache` at `HF_HOME` and passes `--env-file .env`                   |
| [nllb_translator.py](../src/ai_translation/domain/translation/nllb_translator.py) | hardcoded `model_name` default      | resolves `MODEL_PATH` → `MODEL_NAME` → hardcoded default, lazily                                |
| [.env.example](../.env.example)                                                   | no model vars                       | documents `MODEL_NAME` and `MODEL_PATH`                                                         |

## Reference: Environment Variables

| Variable     | Required | Default                      | Description                                                          |
| ------------ | -------- | ---------------------------- | -------------------------------------------------------------------- |
| `HF_TOKEN`   | No       | —                            | Hugging Face Hub read token, avoids rate limits on downloads.        |
| `MODEL_NAME` | No       | `Qwen/Qwen2.5-1.5B-Instruct` | Hub model id to load when `MODEL_PATH` is not set.                   |
| `MODEL_PATH` | No       | —                            | Local/mounted path to a checkpoint; overrides `MODEL_NAME` when set. |
| `GRPC_PORT`  | No       | `50051`                      | Port the gRPC server binds to.                                       |
