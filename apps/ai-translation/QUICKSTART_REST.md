# Quick Start: REST API

## 1. Install Dependencies

```bash
cd apps/ai-translation
pip install -e .
```

## 2. Configure Environment

Copy `.env.example` to `.env` and set your configuration:

```bash
cp .env.example .env
```

Edit `.env` with:
```env
HF_TOKEN=your_huggingface_token
REST_HOST=0.0.0.0
REST_PORT=8000
```

## 3. Run the Server

```bash
ai-translation-serve
```

The server will start on `http://localhost:8000`

## 4. Test the API

### Using curl
```bash
curl -X POST http://localhost:8000/v1/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "你好，这是一个测试",
    "source_language": "zh",
    "target_language": "id"
  }'
```

### Using Python
```python
import requests

response = requests.post(
    "http://localhost:8000/v1/translate",
    json={
        "text": "你好，这是一个测试",
        "source_language": "zh",
        "target_language": "id",
        "emotion_tags": ["formal"],
        "voice_tags": ["professional"]
    }
)
print(response.json())
```

### Using the example client
```bash
python examples/rest_client.py
```

## 5. View API Documentation

- **Swagger UI** (interactive): http://localhost:8000/docs
- **ReDoc** (read-only): http://localhost:8000/redoc

## API Endpoints

### POST /v1/translate
Translate text from one language to another.

**Request:**
```json
{
  "text": "Text to translate",
  "source_language": "zh",
  "target_language": "id",
  "emotion_tags": ["formal"],
  "voice_tags": ["professional"]
}
```

**Response:**
```json
{
  "translated_text": "Teks yang diterjemahkan",
  "source_language": "zh",
  "target_language": "id",
  "model": "Qwen/Qwen2.5-7B-Instruct"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Environment Variables

| Name | Default | Description |
|------|---------|-------------|
| `REST_HOST` | `0.0.0.0` | Server bind address |
| `REST_PORT` | `8000` | Server port |
| `HF_TOKEN` | - | Hugging Face API token |
| `MODEL_NAME` | - | HF model ID to use |
| `MODEL_PATH` | - | Local path to model checkpoint |

## What's Different from gRPC?

- ✅ Standard HTTP/REST instead of gRPC binary protocol
- ✅ JSON request/response instead of protobuf
- ✅ Auto-generated interactive API docs
- ✅ Works with any HTTP client (browsers, curl, postman, etc.)
- ✅ No code generation needed for clients
- ✅ Easier debugging with standard tools

## Next Steps

- See [MIGRATION_GRPC_TO_REST.md](./MIGRATION_GRPC_TO_REST.md) for detailed migration info
- Check [examples/rest_client.py](./examples/rest_client.py) for more usage examples
