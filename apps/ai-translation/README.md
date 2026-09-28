## Translation Document

## Document Translation Strategy

Document translation should not send an entire document to the translation model as a single request.

The document should first be analyzed and divided into smaller, meaningful translation units. The preferred boundaries are based on the document structure, such as:

- paragraphs
- headings
- list items
- table cells
- captions
- other logical text blocks

The system should avoid arbitrary character-based splitting when possible because splitting in the middle of a sentence or logical section can reduce translation quality.

### Translation Units

A document is represented as a collection of ordered translation units.

```text
Document
  ├── Segment 1
  ├── Segment 2
  ├── Segment 3
  ├── ...
  └── Segment N
```

Each segment should retain enough metadata to reconstruct the translated document, such as:

- segment ID
- original text
- segment type
- document order
- page information when applicable
- formatting information when applicable

### Chunking vs Batching

Chunking and batching are separate concepts.

**Chunking** determines how a document is divided into logical translation units.

**Batching** determines how many translation units are processed by the model during one inference operation.

For example:

```text
PDF
 ↓
Extract structure
 ↓
Create translation segments
 ↓
Group segments into batches
 ↓
Translation model
 ↓
Translated segments
 ↓
Reconstruct document
```

The implementation should optimize these decisions based on:

- translation quality
- model context limitations
- inference latency
- memory usage
- infrastructure cost

The system should not introduce a fixed chunk size without measuring its effect on translation quality and runtime performance.
