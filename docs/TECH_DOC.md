# Technical Design Document

## Context-Aware Indonesian ↔ Mandarin AI Language Platform

**Document Version:** 1.0
**Status:** Technical Design Draft
**Architecture:** Distributed Services
**Primary Languages:** TypeScript, Go, Python
**Primary AI Model:** Meta NLLB-200
**Primary Database:** PostgreSQL
**Internal Protocol:** gRPC
**External Protocol:** REST / HTTPS
**Containerization:** Docker

---

# 1. Purpose

This document defines the technical architecture and implementation strategy for a context-aware Indonesian ↔ Mandarin AI language platform.

The system is designed to do more than literal translation.

It should eventually understand:

- source language;
- target language;
- user intent;
- communication context;
- speaker/listener relationship;
- desired tone;
- formality;
- conversation history;
- ambiguity;
- naturalness of the resulting expression.

The platform will initially use Meta's NLLB family as the translation engine and should be architected so that the underlying model can later be replaced, fine-tuned, or combined with other language models.

---

# 2. System Goals

The technical architecture must support:

1. Indonesian → Mandarin translation.
2. Mandarin → Indonesian translation.
3. Context-aware translation.
4. Intent detection.
5. Tone analysis.
6. Relationship-aware language generation.
7. Alternative expressions.
8. Short explanations.
9. Conversation context.
10. Model versioning.
11. Model replacement.
12. Model fine-tuning.
13. GPU inference.
14. REST client access.
15. gRPC internal communication.
16. Persistent translation history.
17. Request tracing.
18. Structured logging.
19. Horizontal service scaling.
20. Future multi-model routing.

---

# 3. Non-Goals

The initial version will NOT attempt to:

- train a foundation model from scratch;
- build a distributed GPU cluster;
- implement Kubernetes;
- implement multiple AI agents;
- implement real-time voice translation;
- support dozens of languages;
- create a custom tokenizer;
- build a custom transformer architecture.

These can be considered after the core system has demonstrated useful translation quality.

---

# 4. High-Level Architecture

```text
                           INTERNET
                              │
                              ▼
                     ┌─────────────────┐
                     │     Next.js     │
                     │     Client      │
                     └────────┬────────┘
                              │
                         HTTPS / REST
                              │
                              ▼
                     ┌─────────────────┐
                     │   Go Backend    │
                     │                 │
                     │ REST API        │
                     │ Authentication  │
                     │ Validation      │
                     │ Context         │
                     │ History         │
                     │ Rate Limiting   │
                     └────────┬────────┘
                              │
                         Private Network
                              │
                             gRPC
                              │
                              ▼
              ┌────────────────────────────────┐
              │       Python AI Service        │
              │                                │
              │ Context Analyzer               │
              │ Intent Analyzer                │
              │ Tone Analyzer                  │
              │ Translation Engine             │
              │ Response Formatter             │
              └───────────────┬────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    Model Runtime  │
                    │                   │
                    │ NLLB-200          │
                    │ Future LLM        │
                    └─────────┬─────────┘
                              │
                              ▼
                            GPU


                     ┌─────────────────┐
                     │   PostgreSQL    │
                     │                 │
                     │ Users           │
                     │ Conversations   │
                     │ Messages        │
                     │ Translations    │
                     │ Feedback        │
                     │ Model Versions  │
                     └─────────────────┘
```

---

# 5. Service Responsibilities

## 5.1 Next.js Client

The client is responsible for presentation and user interaction.

Responsibilities:

- translation interface;
- context input;
- relationship selection;
- tone selection;
- conversation UI;
- translation history;
- alternative expressions;
- explanation display;
- loading/error states.

The client must NOT:

- communicate directly with the AI model;
- contain model credentials;
- perform inference;
- access the AI service directly.

Communication:

```text
Client → Go Backend
HTTPS / REST
```

---

# 6. Go Backend

The Go backend is the application/API layer.

Responsibilities:

```text
Authentication
Authorization
Request validation
REST API
Business logic
Conversation management
Translation history
Usage tracking
Rate limiting
Request IDs
Timeout management
AI service communication
Error normalization
```

The backend does NOT perform model inference.

Architecture:

```text
backend/
├── cmd/
│   └── api/
│       └── main.go
│
├── internal/
│   ├── api/
│   │   ├── handler/
│   │   ├── middleware/
│   │   └── router/
│   │
│   ├── service/
│   │   ├── translation/
│   │   ├── conversation/
│   │   └── user/
│   │
│   ├── ai/
│   │   └── grpc/
│   │
│   ├── repository/
│   │
│   ├── model/
│   │
│   └── config/
│
└── go.mod
```

---

# 7. Python AI Service

The Python service owns AI functionality.

Responsibilities:

```text
Model loading
Model inference
Language detection
Context analysis
Intent analysis
Tone analysis
Translation
Alternative generation
Response formatting
Model version reporting
```

Architecture:

```text
ai-service/
└── app/
    ├── main.py
    │
    ├── grpc/
    │   ├── server.py
    │   └── handlers.py
    │
    ├── context/
    │   ├── analyzer.py
    │   ├── intent.py
    │   └── tone.py
    │
    ├── inference/
    │   ├── pipeline.py
    │   └── generation.py
    │
    ├── models/
    │   ├── base.py
    │   ├── nllb.py
    │   └── registry.py
    │
    ├── response/
    │   └── formatter.py
    │
    └── config/
        └── settings.py
```

---

# 8. Model Architecture

The first implementation should use NLLB as the primary translation model.

Conceptually:

```text
                  AI Language Service
                         │
                         ▼
                  Request Analysis
                         │
                         ▼
                   AI Pipeline
                         │
                         ▼
                    NLLB Model
                         │
                         ▼
                  Generated Text
                         │
                         ▼
                 Response Formatter
```

The model should be abstracted behind an interface.

Example:

```python
class TranslationModel:
    def translate(
        self,
        text: str,
        source_language: str,
        target_language: str,
    ) -> str:
        raise NotImplementedError
```

NLLB implementation:

```python
class NLLBTranslationModel(TranslationModel):
    def translate(
        self,
        text: str,
        source_language: str,
        target_language: str,
    ) -> str:
        ...
```

This allows another model to replace NLLB later.

---

# 9. Model Selection

Initial model:

```text
facebook/nllb-200-distilled-600M
```

Purpose:

- development;
- architecture validation;
- baseline evaluation;
- initial deployment;
- inexpensive experimentation.

Potential future models:

```text
NLLB 1.3B
NLLB 3.3B
Instruction-tuned multilingual LLM
Custom fine-tuned model
```

The model name must be configuration-driven.

Example:

```env
MODEL_NAME=facebook/nllb-200-distilled-600M
MODEL_VERSION=nllb-baseline-v1
DEVICE=cuda
```

The application code should not hardcode the model name.

---

# 10. Model Loading

The model should be loaded once during AI service startup.

Incorrect:

```text
Request
  ↓
Load model
  ↓
Translate
  ↓
Unload model
```

Correct:

```text
AI Service startup
       ↓
Load tokenizer
       ↓
Load model
       ↓
Move model to GPU
       ↓
Service ready
       ↓
Request
       ↓
Inference
```

Model loading should therefore happen during application initialization.

---

# 11. GPU Runtime

The AI service should support:

```text
CPU
CUDA GPU
```

Development can use CPU for architecture testing.

Real inference should preferably use a CUDA-compatible GPU.

Configuration:

```env
DEVICE=cuda
TORCH_DTYPE=float16
```

Depending on the GPU and model, other precision configurations can be evaluated.

---

# 12. gRPC Contract

The protocol definition is the source of truth for Backend ↔ AI Service communication.

File:

```text
proto/language/v1/language.proto
```

Initial contract:

```protobuf
syntax = "proto3";

package language.v1;

option go_package = "translator/gen/language/v1";

service LanguageService {
  rpc Translate(TranslateRequest)
      returns (TranslateResponse);

  rpc Analyze(AnalyzeRequest)
      returns (AnalyzeResponse);

  rpc Health(HealthRequest)
      returns (HealthResponse);
}

message TranslateRequest {
  string request_id = 1;

  string text = 2;

  string source_language = 3;

  string target_language = 4;

  Context context = 5;

  repeated Message conversation = 6;
}

message Context {
  string situation = 1;

  string relationship = 2;

  string purpose = 3;

  string tone = 4;
}

message Message {
  string role = 1;

  string text = 2;
}

message TranslateResponse {
  string translation = 1;

  string intent = 2;

  string tone = 3;

  string explanation = 4;

  repeated TranslationAlternative alternatives = 5;

  string model_version = 6;
}

message TranslationAlternative {
  string text = 1;

  string tone = 2;

  string explanation = 3;
}

message AnalyzeRequest {
  string request_id = 1;

  string text = 2;

  Context context = 3;
}

message AnalyzeResponse {
  string intent = 1;

  string tone = 2;

  string relationship = 3;

  string situation = 4;
}

message HealthRequest {}

message HealthResponse {
  string status = 1;

  string model_version = 2;
}
```

---

# 13. REST API

The public API should remain independent of the model implementation.

## Translate

```http
POST /api/v1/language/translate
```

Request:

```json
{
  "text": "Bisa kirim laporan ini hari ini?",
  "source_language": "id",
  "target_language": "zh-CN",
  "context": {
    "situation": "work",
    "relationship": "employee_to_manager",
    "purpose": "requesting a report",
    "tone": "professional"
  }
}
```

Response:

```json
{
  "data": {
    "translation": "您今天可以把这份报告发给我吗？",
    "intent": "request",
    "tone": "professional",
    "explanation": "This wording is suitable for making a polite request to a manager.",
    "alternatives": [
      {
        "text": "...",
        "tone": "neutral",
        "explanation": "..."
      }
    ],
    "model_version": "nllb-baseline-v1"
  }
}
```

---

# 14. Request Flow

A complete request follows:

```text
1. User enters text
        │
        ▼
2. Next.js sends REST request
        │
        ▼
3. Go validates request
        │
        ▼
4. Go generates/propagates r
```
