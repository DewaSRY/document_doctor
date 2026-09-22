# Product Requirements Document

## Context-Aware Indonesian ↔ Mandarin Language Assistant

**Version:** 2.0
**Status:** Draft
**Product Type:** AI Language Assistant / Distributed AI System

---

# 1. Product Overview

The Context-Aware Indonesian ↔ Mandarin Language Assistant is an AI-powered language system designed to help users communicate naturally between Bahasa Indonesia and Mandarin Chinese.

The system goes beyond literal translation.

It analyzes:

- the meaning of the user's message;
- the communication context;
- the user's intent;
- the relationship between speakers;
- the desired tone;
- the level of formality;
- potential ambiguity;
- naturalness of the resulting expression.

The system then generates a context-appropriate translation and may provide alternative expressions and an explanation of why a particular wording fits the situation.

The primary architecture consists of:

```text
Client
   │
   │ REST / HTTP
   ▼
Backend API
   │
   │ gRPC
   ▼
AI Language Service
   │
   ▼
AI Model
```

The Client communicates exclusively with the Backend API.

The Backend communicates with the AI Language Service through gRPC.

The AI Language Service owns AI inference and language-related intelligence.

---

# 2. Problem Statement

Traditional translation systems primarily solve:

```text
Language A → Language B
```

However, literal translation does not always produce language that is appropriate for the situation.

For example, the same Indonesian sentence may need different Mandarin expressions depending on whether the user is speaking to:

- a close friend;
- a coworker;
- a manager;
- a customer;
- a senior person;
- a stranger.

Therefore, the system should not only ask:

> "What does this sentence mean?"

It should also understand:

> "What is the user trying to communicate, to whom, in what situation, and how should it sound?"

---

# 3. Product Vision

Build a language assistant that helps users communicate **naturally and appropriately**, rather than merely converting words from one language into another.

The system should eventually be capable of transforming:

```text
Meaning + Context + Relationship + Intent
                ↓
      Natural Expression
```

rather than simply:

```text
Words
 ↓
Words in another language
```

---

# 4. Goals

## 4.1 Primary Goals

The system must:

1. Translate Indonesian → Mandarin.
2. Translate Mandarin → Indonesian.
3. Understand the user's communication intent.
4. Analyze available contextual information.
5. Consider speaker/listener relationships.
6. Support different communication tones.
7. Generate natural target-language expressions.
8. Provide alternative expressions when useful.
9. Explain important differences between alternatives.
10. Distinguish literal meaning from natural expression.
11. Expose a REST API to clients.
12. Use gRPC for Backend → AI Service communication.
13. Support model replacement without changing the client.
14. Support future model fine-tuning.
15. Provide structured logging and request tracing.

---

# 5. Core Product Principle

The primary output should not be:

> "The grammatically correct translation."

It should be:

> "The expression that best communicates the user's intended meaning in the provided context."

For example:

```text
Source:
"Bisa kirim ini hari ini?"

Context:
Speaking to a manager.
Professional relationship.
Requesting a document.
```

The system should consider:

```text
Intent:
Request

Relationship:
Employee → Manager

Tone:
Professional / Respectful

Purpose:
Requesting something to be sent today
```

Then produce an appropriate Mandarin expression.

---

# 6. Target Users

## Primary User

Indonesian speakers who communicate with Mandarin speakers.

Use cases include:

- workplace communication;
- messaging;
- business communication;
- travel;
- education;
- daily conversations;
- customer communication.

## Secondary User

Mandarin speakers who need to communicate naturally in Indonesian.

---

# 7. Supported Languages

Initial:

```text
Indonesian
id

Simplified Mandarin
zh-CN
```

Supported directions:

```text
Indonesian → Mandarin
Mandarin → Indonesian
```

Future:

```text
Traditional Chinese
English
Japanese
Korean
```

The architecture should allow additional languages without major structural changes.

---

# 8. Core AI Capabilities

The AI Language Service should eventually provide the following capabilities.

## 8.1 Translation

Convert meaning between:

```text
Indonesian ↔ Mandarin
```

---

## 8.2 Context Understanding

Analyze available context such as:

```text
Situation
Relationship
Purpose
Conversation history
Formality
User preference
```

---

## 8.3 Intent Detection

Identify what the user is trying to accomplish.

Examples:

```text
Request
Question
Apology
Invitation
Complaint
Suggestion
Warning
Negotiation
Greeting
Confirmation
Refusal
Persuasion
```

---

## 8.4 Tone Analysis

Possible tones:

```text
Casual
Friendly
Neutral
Professional
Formal
Respectful
Warm
Direct
Soft
Apologetic
Persuasive
```

---

## 8.5 Naturalness Optimization

The system should prefer natural expressions over literal translations when the context requires it.

Conceptually:

```text
Literal Translation
        ↓
Naturalness Analysis
        ↓
Context Adjustment
        ↓
Final Expression
```

---

## 8.6 Alternative Expressions

The AI may provide multiple valid expressions.

Example:

```json
{
  "alternatives": [
    {
      "text": "...",
      "tone": "casual"
    },
    {
      "text": "...",
      "tone": "professional"
    },
    {
      "text": "...",
      "tone": "formal"
    }
  ]
}
```

Alternatives should only be provided when they offer meaningful differences.

---

## 8.7 Explanation

The system should explain important wording choices.

Example:

```text
Why this wording?

This version uses a softer expression because the
listener is the user's manager. A more direct expression
would be grammatically correct but could sound less polite
in this context.
```

Explanations should be concise by default.

---

# 9. User Experience

The basic interface should contain:

```text
┌──────────────────────────────────────────────┐
│ Indonesian                                   │
│                                              │
│ Bisa kirim laporan ini hari ini?             │
│                                              │
└──────────────────────────────────────────────┘

Context
┌──────────────────────────────────────────────┐
│ I'm asking my manager about a report.        │
└──────────────────────────────────────────────┘

Relationship
[ Manager ▼ ]

Tone
[ Professional ▼ ]

             [ Generate ]
```

Result:

```text
Mandarin

您今天可以把这份报告发给我吗？

Tone:
Professional / Respectful

Why:
This wording is appropriate when making a request
to a manager without sounding overly direct.

Other options:

Casual:
...

More formal:
...
```

---

# 10. Context Input

Context should be optional.

Minimum request:

```json
{
  "text": "Saya mau tanya soal laporan ini.",
  "source_language": "id",
  "target_language": "zh-CN"
}
```

Context-enhanced request:

```json
{
  "text": "Saya mau tanya soal laporan ini.",
  "source_language": "id",
  "target_language": "zh-CN",

  "context": {
    "situation": "work",
    "relationship": "employee_to_manager",
    "tone": "professional",
    "purpose": "asking about a report"
  }
}
```

The AI must distinguish:

```text
User-provided context
```

from:

```text
AI-inferred context
```

The system should not present an inference as a confirmed fact.

---

# 11. Conversation Context

Future versions may support conversation history.

Example:

```text
User:
Can you send me the report?

Manager:
Which report?

User:
The financial one.
```

The AI should use conversation context when translating:

```text
"The financial one."
```

instead of treating it as an isolated sentence.

The API should therefore eventually support:

```json
{
  "conversation": [
    {
      "role": "user",
      "text": "..."
    },
    {
      "role": "assistant",
      "text": "..."
    }
  ],
  "text": "..."
}
```

---

# 12. Backend Architecture

Recommended technology:

```text
Go
Gin / net/http
PostgreSQL
gRPC client
Protocol Buffers
```

Responsibilities:

- REST API;
- authentication;
- authorization;
- request validation;
- user management;
- translation history;
- context management;
- usage tracking;
- rate limiting;
- request IDs;
- AI service communication;
- timeout management;
- error handling.

The Backend should NOT perform AI inference.

---

# 13. AI Service Architecture

Recommended technology:

```text
Python
grpcio
PyTorch
Transformers
PEFT
```

Architecture:

```text
gRPC Handler
      │
      ▼
Language Application
      │
      ├── Context Analyzer
      │
      ├── Intent Analyzer
      │
      ├── Translation Engine
      │
      ├── Tone Analyzer
      │
      └── Response Formatter
             │
             ▼
          AI Model
```

The initial implementation may combine these capabilities into one model.

The architecture should nevertheless keep the logical responsibilities separated so they can later be optimized independently.

---

# 14. Service Communication

## Client → Backend

Protocol:

```text
REST / HTTP
```

Example:

```http
POST /api/v1/language/translate
```

---

## Backend → AI Service

Protocol:

```text
gRPC
```

Example:

```text
AnalyzeAndTranslate()
```

The client must never directly communicate with the AI service.

---

# 15. gRPC Contract

File:

```text
proto/language/v1/language.proto
```

Example:

```protobuf
syntax = "proto3";

package language.v1;

option go_package = "translator/gen/language/v1";

service LanguageService {
  rpc AnalyzeAndTranslate(TranslateRequest)
      returns (TranslateResponse);

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
  string tone = 3;
  string purpose = 4;
}

message Message {
  string role = 1;
  string text = 2;
}

message TranslateResponse {
  string translation = 1;

  string detected_intent = 2;

  string detected_tone = 3;

  string explanation = 4;

  repeated TranslationAlternative alternatives = 5;

  string model_version = 6;
}

message TranslationAlternative {
  string text = 1;
  string tone = 2;
  string explanation = 3;
}

message HealthRequest {}

message HealthResponse {
  string status = 1;
  string model_version = 2;
}
```

The `.proto` file is the contract between the Backend and AI Service.

---

# 16. REST API

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
    "explanation": "The wording uses a polite request suitable for communicating with a manager.",
    "alternatives": [
      {
        "text": "...",
        "tone": "neutral"
      }
    ],
    "model_version": "language-v1"
  }
}
```

---

# 17. API Response Design

The Backend should expose a stable API contract independent of the underlying model.

The client should not need to know whether the AI service uses:

```text
Qwen
Llama
NLLB
mBART
custom model
```

The AI implementation can change while the public API remains stable.

---

# 18. Translation Intelligence Pipeline

The conceptual AI pipeline is:

```text
                 User Input
                     │
                     ▼
              Language Detection
                     │
                     ▼
             Context Understanding
                     │
                     ▼
                Intent Analysis
                     │
                     ▼
             Relationship Analysis
                     │
                     ▼
                Tone Selection
                     │
                     ▼
                Translation
                     │
                     ▼
              Naturalness Review
                     │
                     ▼
             Alternative Generation
                     │
                     ▼
                 Explanation
                     │
                     ▼
               Structured Output
```

This represents the logical processing pipeline, not necessarily separate model calls.

---

# 19. AI Model Strategy

The project should NOT initially train a foundation model from scratch.

Initial strategy:

```text
Existing multilingual model
          +
Project-specific dataset
          ↓
Fine-tuned model
```

Potential techniques:

```text
LoRA
QLoRA
Supervised Fine-Tuning
```

The exact model should be selected after baseline experiments.

---

# 20. Training Dataset

The training dataset must contain contextual information.

Instead of:

```json
{
  "source": "...",
  "target": "..."
}
```

prefer:

```json
{
  "source": "Bisa kirim laporan ini hari ini?",
  "source_language": "id",
  "target_language": "zh-CN",

  "context": {
    "situation": "work",
    "relationship": "employee_to_manager",
    "purpose": "requesting a report",
    "tone": "professional"
  },

  "target": "您今天可以把这份报告发给我吗？"
}
```

---

# 21. Dataset Categories

The dataset should contain examples covering:

### Relationship

```text
friend
coworker
manager
employee
customer
client
teacher
student
stranger
family
```

### Situation

```text
work
school
business
travel
shopping
customer service
personal
online messaging
```

### Tone

```text
casual
friendly
neutral
professional
formal
respectful
soft
direct
warm
apologetic
persuasive
```

### Intent

```text
request
question
apology
refusal
complaint
invitation
suggestion
confirmation
negotiation
warning
```

---

# 22. Dataset Quality

Each training example should ideally pass:

```text
Language validation
       ↓
Translation quality validation
       ↓
Context consistency
       ↓
Duplicate detection
       ↓
Quality scoring
       ↓
Human review
```

High-quality contextual examples are more valuable than simply maximizing dataset size.

---

# 23. Model Evaluation

Evaluation should measure more than literal translation accuracy.

Metrics may include:

```text
BLEU
chrF
COMET
```

Additionally evaluate:

```text
Context appropriateness
Tone appropriateness
Intent preservation
Naturalness
Alternative quality
Explanation quality
```

A benchmark should contain separate categories.

Example:

```text
1,000 test cases

300 general translation
200 workplace
150 casual
100 formal
100 ambiguous
100 context-sensitive
50 difficult expressions
```

The exact distribution can evolve based on observed usage.

---

# 24. Important Evaluation Principle

A grammatically correct translation should not automatically receive a high evaluation if it changes the intended communication style.

For example:

```text
Correct meaning
+
Wrong social context
=
Poor contextual translation
```

Therefore, evaluation must measure:

```text
Meaning preservation
+
Context preservation
+
Naturalness
```

---

# 25. Translation Alternatives

The model may return:

```json
{
  "translation": "...",
  "alternatives": [
    {
      "text": "...",
      "tone": "casual"
    },
    {
      "text": "...",
      "tone": "formal"
    }
  ]
}
```

Alternatives should not simply be paraphrases with no meaningful difference.

Each alternative should have a clear reason for existing.

---

# 26. Ambiguity Handling

If context is insufficient, the AI should not confidently invent context.

Example:

```text
User:
"Kamu sudah selesai?"
```

Possible interpretations depend on context.

The system may respond with:

```text
Translation:
你完成了吗？

Context note:
This is neutral. If you're speaking to a close friend,
a more casual expression may be appropriate.
```

If the distinction materially affects the result, the UI may allow the user to specify context.

---

# 27. "How Should This Sound?" Feature

A primary product feature should be the ability to ask:

> "How should I say this?"

Example:

```text
User:
I need to tell my manager that I can't finish
the task today and need more time.
```

The AI should identify:

```text
Intent:
Requesting additional time

Relationship:
Employee → Manager

Desired communication:
Professional
Respectful
Responsible
```

Then generate an appropriate expression.

This differs from ordinary translation because the source may be a **meaning or situation**, rather than a fully formed sentence.

---

# 28. Rewrite Mode

The system should eventually support:

```text
Translate
Rewrite
Make more formal
Make more casual
Make more polite
Make more natural
Make it sound professional
Explain this expression
```

Example:

```text
Original:
"Send this to me today."

Rewrite:
"Could you please send this to me today?"
```

Then translate the appropriate version into Mandarin.

---

# 29. Conversation Mode

Future versions should support:

```text
Conversation
    │
    ├── Message history
    ├── Speaker identity
    ├── Relationship
    ├── Context
    └── User preferences
```

This allows the AI to maintain context across multiple messages.

---

# 30. Backend Data Model

Potential tables:

```text
users

translations

translation_contexts

translation_alternatives

model_versions

usage_records
```

Example:

```text
translations

id
user_id
request_id
source_language
target_language
source_text
translation
intent
tone
model_version
latency_ms
created_at
```

---

# 31. Model Versioning

Every generated response should identify its model version.

Example:

```text
language-v1
language-v1.1
language-v2
```

This enables comparison between model versions and makes historical results reproducible.

---

# 32. Request Lifecycle

```text
User
 │
 ▼
Next.js
 │
 │ REST
 ▼
Go Backend
 │
 ├── Authenticate
 ├── Validate
 ├── Load context
 ├── Generate request ID
 │
 │ gRPC
 ▼
Python AI Service
 │
 ├── Analyze context
 ├── Analyze intent
 ├── Determine tone
 ├── Generate translation
 ├── Evaluate naturalness
 └── Generate alternatives
 │
 ▼
Go Backend
 │
 ├── Save result
 ├── Record usage
 └── Return response
 │
 ▼
Next.js
 │
 ▼
User
```

---

# 33. Security

The AI Service must remain private.

```text
Internet
   │
   ▼
Backend
   │
   │ Private Network
   ▼
AI Service
```

The Backend owns:

- authentication;
- authorization;
- rate limiting;
- user identity;
- API access control.

The AI service should not be directly exposed to end users.

---

# 34. Docker Architecture

Development environment:

```text
┌───────────────────────────────────────┐
│             Docker Network            │
│                                       │
│  ┌─────────┐      ┌──────────┐       │
│  │ Client  │─────►│ Backend  │       │
│  └─────────┘ REST └────┬─────┘       │
│                        │              │
│                       gRPC            │
│                        │              │
│                  ┌─────▼──────┐       │
│                  │ AI Service │       │
│                  └────────────┘       │
│                                       │
│                  ┌────────────┐       │
│                  │ PostgreSQL │       │
│                  └────────────┘       │
└───────────────────────────────────────┘
```

---

# 35. Repository Structure

```text
translator-platform/
│
├── client/
│   └── nextjs/
│
├── backend/
│   └── go/
│       ├── cmd/
│       ├── internal/
│       │   ├── api/
│       │   ├── service/
│       │   ├── grpc/
│       │   ├── repository/
│       │   └── config/
│       └── go.mod
│
├── ai-service/
│   └── python/
│       ├── app/
│       │   ├── grpc/
│       │   ├── context/
│       │   ├── inference/
│       │   ├── model/
│       │   └── config/
│       ├── tests/
│       └── pyproject.toml
│
├── proto/
│   └── language/
│       └── v1/
│           └── language.proto
│
├── training/
│   ├── data/
│   ├── configs/
│   ├── scripts/
│   └── evaluation/
│
├── infrastructure/
│   └── docker/
│
├── docker-compose.yml
└── README.md
```

---

# 36. Development Strategy

The system must be built incrementally.

## Phase 1 — Architecture

Build:

```text
Next.js
   ↓ REST
Go
   ↓ gRPC
Python
```

The AI service returns a mock response.

Success criteria:

The complete request successfully travels through all three services.

---

## Phase 2 — Context

Add:

```text
Context
Intent
Relationship
Tone
```

The mock AI service returns structured responses.

---

## Phase 3 — Real Model

Replace the mock implementation with an existing multilingual model.

Success criteria:

Real Indonesian ↔ Mandarin translation works through the complete architecture.

---

## Phase 4 — AI Evaluation

Create the benchmark dataset and measure:

```text
translation quality
context appropriateness
tone appropriateness
naturalness
latency
```

---

## Phase 5 — Fine-Tuning

Create the contextual training dataset.

Perform:

```text
Base Model
    ↓
Fine-tuning
    ↓
Fine-tuned Model
```

Compare model versions using the same evaluation dataset.

---

## Phase 6 — Production Hardening

Add:

```text
Authentication
Rate limiting
Timeouts
Retries
Request IDs
Structured logs
Metrics
Health checks
Tracing
Model versioning
```

---

# 37. Observability

Every request should contain:

```text
request_id
user_id
service
model_version
latency
status
```

Example:

```text
[01K8ABC123]

Backend:
REST request received

Backend:
Calling AI service

AI:
Context analysis started

AI:
Inference completed: 1.82s

Backend:
Translation saved

Backend:
REST response: 200
```

Future observability:

```text
OpenTelemetry
Prometheus
Grafana
```

---

# 38. Performance

The system should measure:

```text
REST latency
gRPC latency
model inference latency
token generation speed
GPU memory
CPU usage
memory usage
requests per second
```

Model inference latency should be tracked separately from network/service latency.

---

# 39. Error Handling

The system must distinguish:

```text
Invalid user input
Unsupported language
Missing context
AI service unavailable
AI service timeout
Model unavailable
Model inference failure
Database failure
```

Example:

```json
{
  "error": {
    "code": "AI_SERVICE_TIMEOUT",
    "message": "The language service did not respond within the configured timeout."
  }
}
```

---

# 40. MVP Definition of Done

The MVP is complete when:

- [ ] Client supports Indonesian ↔ Mandarin translation.
- [ ] Client communicates with Backend using REST.
- [ ] Backend communicates with AI Service using gRPC.
- [ ] Protocol Buffers define the internal contract.
- [ ] AI Service supports contextual translation requests.
- [ ] AI Service can return translation + tone + intent.
- [ ] AI Service can return alternatives.
- [ ] Context is optional.
- [ ] PostgreSQL stores translation history.
- [ ] Request IDs are propagated across services.
- [ ] AI service has a health check.
- [ ] Backend implements AI timeout handling.
- [ ] All services run with Docker Compose.
- [ ] Automated tests cover the primary request path.
- [ ] A real multilingual model can replace the mock translator.

---

# 41. Future Features

Potential future capabilities:

```text
Conversation memory
Voice input
Text-to-speech
Speech-to-speech translation
Image translation
Document translation
Personal tone preferences
Domain-specific terminology
Custom dictionaries
User corrections
Feedback-based improvement
Model routing
Multiple AI models
Offline inference
```

A possible future model architecture:

```text
                    Language Gateway
                           │
                           ▼
                   Model Router
                     /       \
                    /         \
                   ▼           ▼
             General Model   Specialized Model
                   │           │
                   └─────┬─────┘
                         ▼
                     Response
```

---

# 42. Final Product Architecture

```text
                           USER
                             │
                             ▼
                    ┌─────────────────┐
                    │     Next.js     │
                    │     Client      │
                    └────────┬────────┘
                             │
                         REST / HTTP
                             │
                             ▼
                    ┌─────────────────┐
                    │   Go Backend    │
                    │                 │
                    │ REST API        │
                    │ Authentication  │
                    │ Context         │
                    │ History         │
                    │ Rate Limiting   │
                    └────────┬────────┘
                             │
                            gRPC
                             │
                             ▼
              ┌────────────────────────────┐
              │     Python AI Service      │
              │                            │
              │ Context Understanding     │
              │ Intent Analysis            │
              │ Tone Analysis              │
              │ Translation                │
              │ Naturalness                │
              │ Alternatives                │
              │ Explanation                 │
              └─────────────┬──────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   AI Model    │
                    │               │
                    │ Multilingual  │
                    │ Fine-tuned    │
                    │ Model         │
                    └───────────────┘

                    ┌───────────────┐
                    │  PostgreSQL   │
                    │               │
                    │ Users         │
                    │ History       │
                    │ Usage         │
                    │ Model versions│
                    └───────────────┘
```

---

# 43. Product Definition

The product should ultimately be understood as:

> **A context-aware Indonesian ↔ Mandarin language assistant that helps users express their intended meaning naturally by considering context, intent, relationship, and tone—not merely translating words between languages.**

The fundamental architecture remains:

```text
Client
  │
  │ REST
  ▼
Backend
  │
  │ gRPC
  ▼
AI Language Service
  │
  ▼
AI Model
```

while the intelligence evolves from:

```text
Translation
```

into:

```text
Understand
   ↓
Interpret
   ↓
Translate
   ↓
Adapt
   ↓
Suggest
   ↓
Explain
```

This architecture should allow the AI model to evolve independently while keeping the client-facing application stable.
