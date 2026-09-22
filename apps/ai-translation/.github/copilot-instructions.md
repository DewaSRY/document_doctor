# Copilot Instructions — ai-translation

This file guides AI coding agents (GitHub Copilot) working in this repository.

## Project Summary

`ai-translation` is the Python **AI Language Service** for a context-aware
Indonesian ↔ Mandarin translation platform. It sits behind a Go backend and is
reached only via gRPC (internal/private network). See:

- [../README.md](../README.md) — service overview
- [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) — internal design
- [../docs/API.md](../docs/API.md) — gRPC contract
- [../../../docs/PRD.md](../../../docs/PRD.md) — product requirements (monorepo-wide)
- [../../../docs/TECH_DOC.md](../../../docs/TECH_DOC.md) — technical design (monorepo-wide)

## What This Service Must Do

<!-- TODO: fill in — restate the core responsibilities in a way an agent should
respect when generating code (context analysis, intent detection, tone
analysis, translation via NLLB-200, response formatting). -->

## What This Service Must NOT Do

- Do not add direct client-facing REST/HTTP endpoints — only the Go backend talks to clients.
- Do not embed authentication/authorization logic — that belongs to the Go backend.
- Do not hardcode model credentials or secrets in source files.
<!-- TODO: add more constraints as they become clear. -->

## Tech Stack

- Language: Python >= 3.12
- Dependency/venv manager: [uv](https://docs.astral.sh/uv/)
- Internal protocol: gRPC
- Primary model: Meta NLLB-200 (see TECH_DOC.md)

## Development Commands

Use the [Makefile](../Makefile) rather than raw commands when possible:

```bash
make install     # create venv & install deps
make test         # run tests
make lint         # lint code
make format       # format code
```

<!-- TODO: confirm/update these targets as the Makefile evolves. -->

## Coding Conventions

<!-- TODO: fill in — naming conventions, typing requirements, formatter/linter used,
directory layout for new modules. -->

## Testing Expectations

<!-- TODO: fill in — where tests live, what must be covered before a change is
considered done. -->

## Things to Double-Check Before Finishing a Task

- [ ] Code has type hints where the rest of the codebase uses them.
- [ ] No secrets or credentials committed.
- [ ] New/changed behavior has tests.
- [ ] `make lint` and `make test` pass.
- [ ] Relevant docs (`README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `CHANGELOG.md`) updated.
