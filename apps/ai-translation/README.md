# ai-translation

Python AI Language Service for the Context-Aware Indonesian ↔ Mandarin Language Assistant.

> See the platform-wide [PRD](../../docs/PRD.md) and [Technical Design Document](../../docs/TECH_DOC.md) for full product/system context. This README covers only this service.

## What This Service Does

<!-- TODO: fill in — one or two sentences describing this service's responsibility
within the platform (e.g. "Owns AI inference and language intelligence: context
analysis, intent detection, tone analysis, translation, and response formatting.
Exposes a gRPC API consumed by the Go backend."). -->

## Status

<!-- TODO: fill in — e.g. Draft / Alpha / In Development -->

## Responsibilities

<!-- TODO: fill in — list what this service owns, e.g.
- Context analysis
- Intent detection
- Tone analysis
- Translation engine (NLLB-200)
- Response formatting
-->

## Non-Responsibilities

<!-- TODO: fill in — what this service explicitly does NOT do, e.g.
- No direct client access (client talks to Go backend only)
- No authentication/authorization (handled by Go backend)
-->

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## API

See [docs/API.md](docs/API.md).

## Requirements

- Python >= 3.12 (see [.python-version](.python-version))
- [uv](https://docs.astral.sh/uv/) for dependency and virtual environment management

## Getting Started

```bash
# install dependencies and create the virtual environment
make install

# activate the virtual environment (must be run with `source`)
source .venv/bin/activate

# ...do your work...

# deactivate the virtual environment
deactivate
```

See the [Makefile](Makefile) for all available development commands (`make help`).

## Project Structure

```text
src/ai_translation/   # application source code
tests/                # test suite
docs/                 # service-specific documentation
```

<!-- TODO: fill in / expand as the project grows -->

## Configuration

This service reads configuration from environment variables. Copy [.env.example](.env.example)
to `.env` and fill in the values — it is loaded automatically at startup via `python-dotenv`.

| Variable    | Required | Default | Description                                                                                                                                     |
| ----------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `HF_TOKEN`  | No       | —       | Hugging Face Hub read token. Avoids rate limits/warnings when downloading model weights. [Get a token](https://huggingface.co/settings/tokens). |
| `GRPC_PORT` | No       | `50051` | Port the gRPC server binds to (`make serve`).                                                                                                   |

## Testing

```bash
make test
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
