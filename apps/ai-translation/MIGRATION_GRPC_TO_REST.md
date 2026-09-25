# Migration from gRPC to FastAPI REST API

This document describes the changes made to migrate the AI Translation service from gRPC to a REST API built with FastAPI.

## What Changed

### Dependencies
- **Removed**: `grpcio`, `grpcio-tools`, `protobuf`
- **Added**: `fastapi`, `uvicorn`, `pydantic`

### Server Configuration
- **Old**: gRPC server on port 50051 (configured via `GRPC_PORT`)
- **New**: FastAPI/Uvicorn server on port 8000 (configured via `REST_PORT` and `REST_HOST`)

### File Structure
```
src/ai_translation/
├── bootstrap/
│   └── server.py          # New: FastAPI server (replaced gRPC implementation)
├── infrastructure/
│   ├── grpc/              # Old: gRPC definitions (can be removed)
│   └── rest/              # New: REST API schemas
│       ├── __init__.py
│       └── schemas.py     # Pydantic models for request/response
└── domain/
    └── translation/       # Unchanged: Core translation logic
```

## API Endpoints

### POST /v1/translate
Translates text from source language to target language.

**Request Body** (JSON):
```json
{
  "text": "Text to translate",
  "source_language": "zh",
  "target_language": "id",
  "emotion_tags": ["formal"],
  "voice_tags": ["professional"]
}
```

**Response** (JSON):
```json
{
  "translated_text": "Translated text",
  "source_language": "zh",
  "target_language": "id",
  "model": "Model name used"
}
```

**Status Codes**:
- `200`: Successful translation
- `500`: Internal server error (includes error message in response)

### GET /health
Health check endpoint.

**Response** (JSON):
```json
{
  "status": "ok"
}
```

## Running the Server

### Using command line
```bash
ai-translation-serve
```

### Using uvicorn directly
```bash
uvicorn ai_translation.bootstrap.server:create_app --host 0.0.0.0 --port 8000
```

### Using Python
```python
from ai_translation.bootstrap.server import create_app, main
import uvicorn

app = create_app()
uvicorn.run(app, host="0.0.0.0", port=8000)
```

## Environment Variables

| Variable | Old | New | Default | Description |
|----------|-----|-----|---------|-------------|
| `GRPC_PORT` | ✓ | ✗ | 50051 | Removed |
| `REST_HOST` | ✗ | ✓ | 0.0.0.0 | Server bind address |
| `REST_PORT` | ✗ | ✓ | 8000 | Server port |
| `HF_TOKEN` | ✓ | ✓ | - | Hugging Face token |
| `MODEL_NAME` | ✓ | ✓ | - | Model name/ID |
| `MODEL_PATH` | ✓ | ✓ | - | Local model path |

## Testing

### Using curl
```bash
curl -X POST http://localhost:8000/v1/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "你好",
    "source_language": "zh",
    "target_language": "id"
  }'
```

### Using Python requests
```python
import requests

response = requests.post(
    "http://localhost:8000/v1/translate",
    json={
        "text": "你好",
        "source_language": "zh",
        "target_language": "id",
    }
)
print(response.json())
```

### Using the example client
```bash
python examples/rest_client.py
```

## Interactive API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Core Logic Unchanged

The translation logic itself remains unchanged:
- Translation parameters are validated and mapped in the same way
- The `get_translator()` function is still used
- Language/emotion/voice tag conversion functions work the same way
- Error handling follows the same pattern

## Benefits of REST API

1. **HTTP/1.1 Standard**: Works with any HTTP client
2. **Auto Documentation**: Built-in API docs via Swagger/ReDoc
3. **Browser Testing**: Can test directly from browser
4. **Easy Integration**: Works with web frameworks, mobile apps, etc.
5. **Simpler Development**: No protobuf compilation needed
6. **Standard Formats**: Uses JSON instead of protobuf binary format

## Cleanup (Optional)

Once you've verified everything works, you can optionally remove the old gRPC files:
```bash
rm -rf src/ai_translation/infrastructure/grpc/
```

But keep them for now in case you need to reference the old implementation.
