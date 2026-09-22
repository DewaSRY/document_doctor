# AI Translation Service — MVP PRD

## 1. Product Overview

Build a standalone AI translation service that allows backend services to translate text into a requested target language.

The service will use **Meta's No Language Left Behind (NLLB)** as the initial translation engine.

Backend services will communicate with the translation service through **gRPC** using secure server-to-server communication.

The translation request can include:

- Source language
- Target language
- Text
- Context
- Tags
- Tone

The purpose of the MVP is to validate that the system can provide **secure, context-aware translation as a reusable internal service**.

---

# 2. MVP Objective

The MVP should prove the following end-to-end workflow:

```text
┌──────────────────────┐
│ Consumer Backend     │
│                      │
│ Notification Service │
└──────────┬───────────┘
           │
           │ gRPC + TLS
           ▼
┌──────────────────────┐
│ Translation Service  │
│                      │
│ Authentication       │
│ Validation           │
│ Translation Logic    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ NLLB Translation     │
│ Model                │
└──────────┬───────────┘
           │
           ▼
      Translation
```

A consumer should be able to send a request such as:

```json
{
  "source_language": "en",
  "target_language": "id",
  "text": "Your material request has been approved.",
  "context": "A notification informing an employee that their material request passed the approval workflow.",
  "tags": ["notification", "material-request", "approval"],
  "tone": "professional"
}
```

and receive:

```json
{
  "translated_text": "...",
  "source_language": "en",
  "target_language": "id",
  "model": "nllb"
}
```

---

# 3. Goals

The MVP must:

1. Provide a working translation API.
2. Use NLLB for translation.
3. Expose the API through gRPC.
4. Support server-to-server authentication.
5. Encrypt communication between services.
6. Validate translation requests.
7. Support contextual translation.
8. Support semantic tags.
9. Support basic tone/style instructions.
10. Return structured errors.
11. Provide basic logging.
12. Provide basic health checks.
13. Keep the translation engine independent from the gRPC layer.

---

# 4. Non-Goals

The following are explicitly outside the MVP:

- Translation caching
- Translation history
- Translation glossary management
- User-facing translation UI
- Speech-to-text
- Text-to-speech
- Voice translation
- Automatic language detection
- Fine-tuning NLLB
- Multiple translation models
- Model routing
- Batch translation
- Translation quality scoring
- Translation feedback system
- Advanced analytics
- Translation management dashboard
- OpenTelemetry
- Automatic context generation
- Multi-region deployment

These can be added after the MVP has validated the core architecture.

---

# 5. Primary Use Case

## Context-Aware Notification Translation

A backend service needs to translate a notification before sending it to a user.

Example:

```text
Consumer Service
      |
      | Translate notification
      |
      ▼
Translation Service
      |
      | NLLB
      |
      ▼
Translated notification
```

The consumer provides additional context because short application strings can be ambiguous.

Example:

```text
Text:
"Approved"

Context:
"Status shown after a manager approves an employee's material request."

Tags:
["status", "material-request", "approval"]

Tone:
"professional"
```

---

# 6. MVP Functional Requirements

## FR-01 — Translate Text

The service must provide a gRPC method for translating text.

Example:

```protobuf
rpc Translate(TranslateRequest)
    returns (TranslateResponse);
```

---

## FR-02 — Source Language

The request must specify the source language.

Example:

```text
en
```

The service must validate that the language is supported by the configured NLLB model.

---

## FR-03 — Target Language

The request must specify the desired target language.

Example:

```text
id
```

The service must validate that the target language is supported.

---

## FR-04 — Translation Text

The request must contain the text that needs to be translated.

Example:

```text
Your request has been approved.
```

The service must reject an empty text value.

---

## FR-05 — Context

The request may contain additional context.

Example:

```text
A notification sent after a manager approves an employee's request.
```

Context should be used to improve the interpretation of ambiguous text.

Context must not replace the source text.

---

## FR-06 — Tags

The request may contain semantic tags.

Example:

```json
["notification", "approval", "material-request"]
```

Tags should provide additional information about how the text is used.

Tags themselves should not be translated.

---

## FR-07 — Tone

The request may specify a basic tone.

Initial supported values:

```text
neutral
professional
formal
casual
friendly
```

If no tone is specified:

```text
neutral
```

should be assumed.

---

## FR-08 — Translation Engine

The MVP must use NLLB as the translation engine.

The application should isolate NLLB behind an internal interface.

Conceptually:

```text
TranslationService
       |
       ▼
TranslationEngine
       |
       ▼
NLLBEngine
```

This prevents the gRPC API from becoming coupled to NLLB-specific implementation details.

---

# 7. Proposed gRPC API

## TranslateRequest

```protobuf
message TranslateRequest {
  string source_language = 1;
  string target_language = 2;
  string text = 3;

  string context = 4;

  repeated string tags = 5;

  string tone = 6;
}
```

---

## TranslateResponse

```protobuf
message TranslateResponse {
  string translated_text = 1;

  string source_language = 2;
  string target_language = 3;

  string model = 4;
}
```

---

# 8. Example Protobuf Definition

```protobuf
syntax = "proto3";

package translation.v1;

service TranslationService {
  rpc Translate(TranslateRequest)
      returns (TranslateResponse);
}

message TranslateRequest {
  string source_language = 1;
  string target_language = 2;
  string text = 3;

  string context = 4;

  repeated string tags = 5;

  string tone = 6;
}

message TranslateResponse {
  string translated_text = 1;

  string source_language = 2;
  string target_language = 3;

  string model = 4;
}
```

The exact protobuf package/versioning convention can be finalized during implementation.

---

# 9. Security

Security is a core MVP requirement because the service is intended for server-to-server communication.

## 9.1 TLS

All gRPC communication must use TLS.

```text
Consumer
   │
   │ HTTPS/TLS equivalent for gRPC
   ▼
Translation Service
```

Plaintext production communication must not be allowed.

---

## 9.2 Service Authentication

The translation service must verify that the calling service is authorized to communicate with it.

For the MVP, service authentication can use one of:

- mTLS
- Signed service credentials
- Internal service token

The preferred production architecture is **mTLS**, because it provides both encryption and service identity.

---

## 9.3 Authorization

Authentication alone is insufficient.

The service must also determine whether the authenticated service is allowed to call the translation API.

Example:

```text
notification-service → allowed

unknown-service → denied
```

---

# 10. Request Validation

The service must validate:

### Required fields

```text
source_language
target_language
text
```

### Optional fields

```text
context
tags
tone
```

### Validation rules

The MVP must reject:

- Empty source language
- Empty target language
- Empty text
- Unsupported language
- Unsupported tone
- Text exceeding the configured maximum length
- Context exceeding the configured maximum length
- Excessive number of tags

---

# 11. Error Handling

The service must use standard gRPC status codes.

Examples:

| Situation              | gRPC status         |
| ---------------------- | ------------------- |
| Invalid request        | `INVALID_ARGUMENT`  |
| Missing authentication | `UNAUTHENTICATED`   |
| Unauthorized service   | `PERMISSION_DENIED` |
| Request timeout        | `DEADLINE_EXCEEDED` |
| Service unavailable    | `UNAVAILABLE`       |
| Internal model failure | `INTERNAL`          |

Example:

```text
INVALID_ARGUMENT:
target language "xyz" is not supported
```

The API should not expose internal stack traces or infrastructure details.

---

# 12. Request Timeout

Every translation request must have a deadline.

Example MVP configuration:

```text
Request timeout: 10 seconds
```

The exact timeout should be configurable through env
