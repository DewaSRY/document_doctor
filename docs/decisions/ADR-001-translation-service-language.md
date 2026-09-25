# ADR-001: Use Python for the Translation Service

## Status

Accepted

## Context

The application needs a machine translation service.

The translation service will use machine-learning models such as NLLB.
The project may also experiment with custom translation models in the
future.

The ML ecosystem and libraries required by the project are primarily
available in Python.

## Decision

The translation service will be implemented in Python.

## Alternatives Considered

### Go

Go is already used by the main backend, but the ML ecosystem required
for model loading, inference, training, and experimentation is less
suitable for this responsibility.

### Java

Java could implement the service, but Python provides a more direct
integration with the machine-learning ecosystem used by this project.

## Consequences

### Positive

- Easy integration with Hugging Face and PyTorch.
- Easier experimentation with translation models.
- Training and inference can use the same ecosystem.

### Negative

- The system now uses multiple programming languages.
- The team needs to maintain a Python service in addition to the main
  backend.

## Related

- Translation Service
- NLLB
