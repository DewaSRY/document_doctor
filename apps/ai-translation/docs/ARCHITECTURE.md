# Architecture

Technical design notes for the `ai-translation` service.

> This service implements the "Python AI Service" node described in the
> platform [Technical Design Document](../../../docs/TECH_DOC.md). This file
> covers implementation details specific to this codebase.

## Position in the System

```text
Go Backend
   │
   │ gRPC
   ▼
ai-translation (this service)
   │
   ▼
Model Runtime (NLLB-200 / future LLM)
```

## Current code strcuture

```bash
/apps/ai-translation
│
├── pyproject.toml
├── README.md
├── Dockerfile
├── Makefile
│
├── proto/
│   └── translation/
│       └── v1/
│           └── translation.proto
│
├── src/
│   └── ai_translation/
│       │
│       ├── main.py
│       │
│       ├── bootstrap/
│       │   ├── __init__.py
│       │   ├── container.py
│       │   ├── config.py
│       │   └── logging.py
│       │
│       ├── domain/
│       │   └── translation/
│       │       ├── __init__.py
│       │       ├── models.py
│       │       ├── errors.py
│       │       └── service.py
│       │
│       ├── app/
│       │   └── translation/
│       │       ├── __init__.py
│       │       ├── translate.py
│       │       └── ports.py
│       │
│       ├── infrastructure/
│       │   │
│       │   ├── ai/
│       │   │   ├── __init__.py
│       │   │   ├── openai_provider.py
│       │   │   ├── prompt_builder.py
│       │   │   └── response_parser.py
│       │   │
│       │   └── grpc/
│       │       ├── __init__.py
│       │       ├── server.py
│       │       ├── translation_service.py
│       │       └── generated/
│       │           ├── translation_pb2.py
│       │           └── translation_pb2_grpc.py
│       │
│       └── shared/
│           ├── __init__.py
│           └── ...
│
└── tests/
    ├── unit/
    │   ├── domain/
    │   ├── application/
    │   └── infrastructure/
    │
    └── integration/
        └── grpc/
```

## Modules

<!-- TODO: fill in — describe the internal modules/packages and their responsibilities, e.g.
- context_analyzer/  — extracts conversation context and relationship info
- intent_analyzer/   — classifies user intent
- tone_analyzer/     — determines desired tone/formality
- translation_engine/ — wraps the model runtime (NLLB-200)
- response_formatter/ — builds the final response payload
-->

## Data Flow

<!-- TODO: fill in — step-by-step request lifecycle from gRPC request to response. -->

## External Dependencies

<!-- TODO: fill in — model runtime, database access (if any), other services called. -->

## Model Versioning & Replacement Strategy

<!-- TODO: fill in — how models are loaded, versioned, and swapped without client changes. -->

## Observability

<!-- TODO: fill in — logging format, tracing/request IDs, metrics. -->

## Key Design Decisions

<!-- TODO: fill in — notable decisions and trade-offs (ADR-style), e.g.
- Decision:
- Reasoning:
- Alternatives considered:
-->
