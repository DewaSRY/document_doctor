# AI Context-Aware Translation Service

## 1. Product Overview

Build an AI-powered translation service that translates text from a source language into a requested target language while preserving the **meaning, context, tone, and intended style** of the original content.

The service will use **Meta's No Language Left Behind (NLLB)** family of multilingual translation models as the initial translation engine.

The system is designed primarily as an **internal server-to-server translation service**, rather than a consumer-facing translation application.

Other backend services will communicate with the translation service through **gRPC** over a secured connection.

---

# 2. Problem Statement

Traditional translation APIs generally focus on translating the literal content of a sentence.

However, application-generated content often requires additional context to produce an appropriate translation.

For example, the same word may need different translations depending on whether it represents:

- A product name
- A business process
- A notification
- A user interface label
- A technical term
- A person's name
- A status
- An action
- A formal business message

The translation service should therefore accept contextual information and semantic tags alongside the text.

Instead of:

```text
Translate:
"Pending"
```

The service should be able to receive:

```text
Text:
"Pending"

Context:
"Status displayed when a purchase request has been submitted but has not yet been approved."

Tag:
"status"
```

This allows the translation engine and surrounding logic to produce a translation appropriate for the application's intended meaning.

---

# 3. Goals

## Primary Goals

1. Provide a centralized translation service for multiple backend applications.
2. Support multilingual text translation.
3. Use NLLB as the initial translation model.
4. Preserve the semantic meaning of the original text.
5. Support contextual translation.
6. Support translation tags that describe the intended usage of the text.
7. Preserve the requested tone/style where applicable.
8. Provide a strongly typed gRPC API for server-to-server communication.
9. Secure communication between services.
10. Make the translation engine replaceable without requiring changes to consuming services.
11. Provide predictable error handling and observability.
12. Support batch translation for multiple text items.

---

# 4. Non-Goals

The initial version will not focus on:

- Real-time voice translation.
- Speech-to-text.
- Text-to-speech.
- Human translation workflows.
- Translation marketplace functionality.
- Public anonymous API access.
- Training a new translation model from scratch.
- Building a general-purpose chatbot.
- Automatically rewriting content beyond the requested translation.

The service should translate content rather than become a general AI writing assistant.

---

# 5. Target Users

The primary users are **backend services**, not individual end users.

Example consumers:

```text
Notification Service
        |
        v
Translation Service
        |
        v
NLLB Translation Model
```

Other potential consumers:

```text
Product Service
Notification Service
Email Service
CMS
Customer Service
Reporting Service
        |
        v
Translation Service
```

---

# 6. Core Translation Request

Each translation request should contain more than just text.

### Required information

```text
source_language
target_language
text
```

### Optional contextual information

```text
context
tags
tone
domain
```

Conceptually:

```json
{
  "source_language": "en",
  "target_language": "id",
  "text": "Your request has been approved.",
  "context": "Notification sent to a user after an approval workflow is completed.",
  "tags": ["notification", "approval", "business"],
  "tone": "professional"
}
```

---

# 7. Context

Context provides additional semantic information that can help the translation engine determine the intended meaning.

### Example

```text
Text:
"Order"

Context:
"An order created by a customer to purchase products."
```

versus:

```text
Text:
"Order"

Context:
"A command instructing someone to perform an action."
```

The translation service should use the supplied context to determine the appropriate translation.

### Context Requirements

Context should:

- Be optional.
- Be limited in size.
- Be written in a language understood by the translation pipeline.
- Describe the intended meaning or usage.
- Never override the actual source text.

---

# 8. Tags

Tags provide structured semantic metadata.

Example:

```json
{
  "tags": ["notification", "system-message", "formal"]
}
```

Potential tags:

```text
ui
button
notification
email
error
success
warning
status
product
technical
business
formal
casual
marketing
legal
```

Tags should be treated as metadata rather than text that needs to be translated.

---

# 9. Tone and Style

The request may optionally specify the desired communication style.

Supported initial values could include:

```text
formal
professional
neutral
casual
friendly
technical
```

Example:

```json
{
  "text": "Your payment could not be processed.",
  "tone": "professional"
}
```

The translation should preserve the requested tone where the target language supports the distinction.

---

# 10. Translation Pipeline

The initial architecture should separate the API layer from the translation engine.

```text
                    ┌─────────────────────┐
                    │   Consumer Service  │
                    └──────────┬──────────┘
                               │
                             gRPC
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Translation Service │
                    │                     │
                    │  Authentication     │
                    │  Validation         │
                    │  Context Processing │
                    │  Translation Logic  │
                    │  Logging            │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Translation Engine  │
                    │                     │
                    │       NLLB          │
                    └──────────┬──────────┘
                               │
                               ▼
                         Translation
```

The translation engine should be abstracted behind an internal interface so that NLLB can later be replaced by another model.

For example:

```text
TranslationService
        |
        v
TranslationEngine
        |
        +---- NLLBEngine
        |
        +---- FutureEngine
```

---

# 11. gRPC API

The service should expose a protobuf-defined gRPC API.

### Example RPC

```protobuf
service TranslationService {
  rpc Translate(TranslateRequest) returns (TranslateResponse);
  rpc TranslateBatch(TranslateBatchRequest) returns (TranslateBatchResponse);
}
```

### TranslateRequest

Conceptually:

```protobuf
message TranslateRequest {
  string source_language = 1;
  string target_language = 2;
  string text = 3;

  string context = 4;

  repeated string tags = 5;

  string tone = 6;

  string domain = 7;
}
```

### TranslateResponse

```protobuf
message TranslateResponse {
  string translated_text = 1;

  string source_language = 2;
  string target_language = 3;

  string model = 4;
}
```

The exact protobuf schema should be finalized during technical design.

---

# 12. Batch Translation

The service should support multiple translation requests in one gRPC call.

Example:

```json
{
  "items": [
    {
      "text": "Request approved",
      "context": "Approval workflow notification",
      "tags": ["notification", "approval"]
    },
    {
      "text": "Request rejected",
      "context": "Approval workflow notification",
      "tags": ["notification", "rejection"]
    }
  ]
}
```

This reduces network overhead for services that need to translate multiple strings simultaneously.

The API should preserve item ordering so consumers can reliably associate responses with their original requests.

---

# 13. Server-to-Server Security

Communication between services must be authenticated and encrypted.

The preferred initial approach is:

### TLS / mTLS

Use TLS to encrypt communication between services.

For stronger service identity, use **mutual TLS (mTLS)** so both the client and translation service authenticate each other.

```text
Client Service
     │
     │ mTLS
     ▼
Translation Service
```

The system should not rely only on network-level security.

Additional controls should include:

- Service authentication
- Certificate validation
- Authorization
- Request validation
- Request size limits
- Rate limiting
- Timeout/deadline enforcement
- Audit logging

---

# 14. Service Authorization

Authentication answers:

> "Who is calling the translation service?"

Authorization answers:

> "Is this service allowed to call it?"

The translation service should maintain an allowlist or service identity policy.

Example:

```text
notification-service → allowed
email-service         → allowed
unknown-service       → denied
```

Authorization should be enforced before processing the translation request.

---

# 15. gRPC Reliability

Every request should have a deadline/timeout.

Example:

```text
Client timeout:
5 seconds
```

The service should return structured gRPC status codes.

Examples:

```text
INVALID_ARGUMENT
UNAUTHENTICATED
PERMISSION_DENIED
DEADLINE_EXCEEDED
RESOURCE_EXHAUSTED
UNAVAILABLE
INTERNAL
```

Consumers should be able to distinguish:

```text
Bad request
Authentication failure
Authorization failure
Model failure
Temporary service failure
Timeout
```

---

# 16. Validation

The service should validate:

### Required fields

```text
source_language
target_language
text
```

### Validation examples

- Source language must be supported.
- Target language must be supported.
- Source and target languages should be valid language identifiers.
- Text must not exceed the configured maximum length.
- Context must not exceed the configured maximum length.
- Tags must have a maximum count.
- Unsupported tone values must be rejected.
- Empty translation requests must be rejected.

---

# 17. Language Support

NLLB will be the initial source of supported languages.

The API should not hard-code model-specific behavior into consuming services.

Instead, the translation service should expose a capability endpoint/RPC.

Example:

```protobuf
rpc GetSupportedLanguages(...)
    returns (SupportedLanguagesResponse);
```

This allows clients to discover supported language codes.

---

# 18. Translation Quality

Translation quality should be evaluated based on more than literal correctness.

The system should consider:

### Semantic accuracy

Does the translation preserve the original meaning?

### Context accuracy

Does the translation reflect the supplied context?

### Terminology consistency

Are application-specific terms translated consistently?

### Tone preservation

Does the target text maintain the requested communication style?

### Fluency

Does the result sound natural in the target language?

### Formatting preservation

The system should preserve relevant:

- Numbers
- URLs
- Placeholders
- Variables
- Markdown
- Line breaks
- Product identifiers

For example:

```text
Hello {{user_name}}, your order #{{order_id}} has been approved.
```

should preserve:

```text
{{user_name}}
{{order_id}}
```

---

# 19. Terminology Management

A future version should support a terminology/glossary mechanism.

Example:

```json
{
  "term": "Material Request",
  "translation": "Permintaan Material"
}
```

This is important for business applications where certain terms have standardized translations.

Glossary rules should take precedence over generic model translations when explicitly configured.

---

# 20. Caching

Repeated translations should be cacheable.

A cache key could be derived from:

```text
source language
target language
text
context
tags
tone
domain
model version
```

Example:

```text
SHA256(
  source_language +
  target_language +
  text +
  context +
  tags +
  tone +
  domain +
  model_version
)
```

Caching can reduce:

- Model inference cost
- CPU/GPU usage
- Response latency

However, caching should only be enabled where the request data is safe to cache.

---

# 21. Observability

The service should provide structured observability.

### Metrics

Track:

```text
translation_requests_total
translation_requests_failed
translation_latency
translation_model_latency
translation_batch_size
translation_cache_hit_rate
translation_cache_miss_rate
translation_tokens_processed
```

### Logging

Logs should include:

```text
request_id
caller_service
source_language
target_language
model_version
duration
status
```

Sensitive user content should not automatically be logged.

The service should avoid logging raw translated text unless explicitly required for debugging and permitted by the data policy.

---

# 22. Request Tracing

Every request should have a correlation/request ID.

Example:

```text
notification-service
       |
       | request-id: abc123
       ▼
translation-service
       |
       | request-id: abc123
       ▼
NLLB
```

This allows a translation request to be traced across services.

If the infrastructure supports OpenTelemetry, distributed tracing should be considered.

---

# 23. Error Handling

Errors should be structured and actionable.

Example:

```text
INVALID_ARGUMENT
source language "xx" is not supported
```

or:

```text
RESOURCE_EXHAUSTED
translation request exceeds maximum allowed text length
```

Internal model errors should not expose implementation details or sensitive infrastructure information to consumers.

---

# 24. Performance Requirements

Initial targets:

| Metric               |       Target |
| -------------------- | -----------: |
| gRPC overhead        |      < 50 ms |
| Service availability |      ≥ 99.9% |
| Request timeout      |    5 seconds |
| Maximum text size    | Configurable |
| Batch request size   | Configurable |
| Concurrent requests  | Configurable |
| Cache hit response   |     < 100 ms |

Actual translation latency will depend heavily on model size, hardware, batching, and deployment architecture, so model inference performance should be benchmarked before finalizing strict SLAs.

---

# 25. Deployment Architecture

The translation service should be independently deployable.

Example:

```text
                    ┌───────────────────┐
                    │   Application A   │
                    └─────────┬─────────┘
                              │
                              │ gRPC / mTLS
                              ▼
                    ┌───────────────────┐
                    │ Translation API   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Translation Engine│
                    │       NLLB        │
                    └───────────────────┘
```

The model should ideally be loaded once and reused across requests rather than loaded for every request.

---

# 26. Model Abstraction

The API must not expose NLLB-specific implementation details.

Consumers should request:

```text
Translate(...)
```

rather than:

```text
TranslateUsingNLLB(...)
```

This allows the system to evolve from:

```text
NLLB
```

to:

```text
NLLB
  ↓
Fine-tuned NLLB
  ↓
Another multilingual model
  ↓
Model ensemble / routing
```

without requiring changes to consuming applications.

---

# 27. Security Requirements

The service must:

- Encrypt service-to-service communication.
- Authenticate clients.
- Authorize clients.
- Validate all incoming requests.
- Enforce request size limits.
- Enforce timeouts.
- Prevent unauthorized access to the model.
- Avoid exposing internal infrastructure errors.
- Avoid logging sensitive translation content by default.
- Rotate credentials/certificates.
- Support audit logging.
- Apply rate/concurrency limits.
- Protect against denial-of-service through oversized or excessive requests.

---

# 28. Privacy Considerations

Translation requests may contain sensitive business or user information.

Therefore:

1. Raw request content should not be logged by default.
2. Translation data should not be retained unnecessarily.
3. Cached translations should have a defined retention policy.
4. Access to translation logs should be restricted.
5. Production data should not automatically be used for model training.
6. Data retention policies should be configurable.

---

# 29. Functional Requirements

### FR-01 — Translate Text

The system must translate text from a supported source language to a supported target language.

### FR-02 — Context-Aware Translation

The system must accept optional contextual information.

### FR-03 — Tagged Translation

The system must accept semantic tags.

### FR-04 — Tone

The system should accept an optional tone/style.

### FR-05 — Batch Translation

The system must support translating multiple items in a single request.

### FR-06 — Language Discovery

The system should expose supported language information.

### FR-07 — Secure Communication

The system must support authenticated and encrypted service-to-service communication.

### FR-08 — gRPC

The service must expose its internal API through gRPC.

### FR-09 — Structured Errors

The service must return standardized gRPC errors.

### FR-10 — Observability

The service must expose metrics and structured logs.

---

# 30. Example Use Case

A notification service wants to send:

```text
Your Material Request has been approved.
```

It sends:

```json
{
  "source_language": "en",
  "target_language": "id",
  "text": "Your Material Request has been approved.",
  "context": "A notification informing an employee that their material request has successfully passed the approval workflow.",
  "tags": ["notification", "material-request", "approval"],
  "tone": "professional",
  "domain": "manufacturing"
}
```

The translation service processes:

```text
Request
   ↓
Authentication
   ↓
Authorization
   ↓
Validation
   ↓
Context Processing
   ↓
Glossary / Terminology
   ↓
NLLB Translation
   ↓
Post-processing
   ↓
Response
```

Response:

```json
{
  "translated_text": "...",
  "source_language": "en",
  "target_language": "id",
  "model": "nllb"
}
```

---

# 31. Acceptance Criteria

The MVP is considered complete when:

- [ ] A backend service can call the translation service through gRPC.
- [ ] Communication is encrypted.
- [ ] Unauthorized services are rejected.
- [ ] Supported source/target languages are validated.
- [ ] Text can be translated using NLLB.
- [ ] Context can be provided with a translation request.
- [ ] Tags can be provided with a translation request.
- [ ] Tone can be provided with a translation request.
- [ ] Batch translation is supported.
- [ ] Translation errors return appropriate gRPC status codes.
- [ ] Request deadlines are enforced.
- [ ] Structured logging is available.
- [ ] Metrics are available.
- [ ] Sensitive text is not logged by default.
- [ ] Model loading does not occur for every request.
- [ ] Translation engine implementation is separated from the gRPC API.
- [ ] The model can be replaced without changing consumer APIs.
- [ ] Automated tests cover validation, authentication, authorization, translation orchestration, and error handling.

---

# 32. Future Roadmap

### Phase 1 — MVP

```text
gRPC
+
mTLS
+
NLLB
+
Context
+
Tags
+
Tone
+
Basic observability
```

### Phase 2 — Production Optimization

```text
Caching
+
Batch inference
+
Glossary
+
OpenTelemetry
+
Horizontal scaling
+
Model performance optimization
```

### Phase 3 — Intelligence

```text
Domain-specific terminology
+
Translation quality evaluation
+
Fine-tuned models
+
Model routing
+
Language detection
+
Automatic context extraction
```

### Phase 4 — Platform

```text
Central translation platform
+
Multiple model providers
+
Translation management
+
Usage analytics
+
Per-service quotas
+
Translation history
+
Quality feedback loop
```

---

# 33. Key Design Principle

The most important architectural principle is:

> **Consumers should provide intent; the translation service should own translation intelligence.**

A consuming service should not need to know whether translation is performed by NLLB, a fine-tuned model, or another future model.

The consumer only needs to provide:

```text
What is the text?
What language is it currently in?
What language is required?
What does the text mean?
How is it being used?
What tone should it have?
```

The translation platform owns everything else.
