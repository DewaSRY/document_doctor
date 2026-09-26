---
name: Normalization Rest response
description: Normalization response will help the client handle the response better
---

# Response Normalization

All API endpoints must return responses in one of the two structures below.

## Success Response

```json
{
  "data": [],
  "meta": {
    "page": 0,
    "limit": 0,
    "total_count": 0,
    "total_page": 0
  },
  "error": "<undefined>",
  "code": 200,
  "message": "message"
}
```

- `data`: the payload — either a single object or an array of objects.
- `meta`: pagination info. Present only for list endpoints; otherwise `undefined`.
- `error`: always `undefined` on success.
- `code`: HTTP status code (e.g. `200`).
- `message`: short human-readable summary of the result.

## Error Response

```json
{
  "data": [],
  "meta": "<undefined>",
  "error": [
    {
      "field": "property-field-name",
      "message": "error message"
    }
  ],
  "code": 200,
  "message": "message"
}
```

- `data`: always an empty array on error.
- `meta`: always `undefined` on error.
- `error`: array of field-level errors, each with a `field` and `message`.
- `code`: HTTP status code.
- `message`: short human-readable summary of the error.
