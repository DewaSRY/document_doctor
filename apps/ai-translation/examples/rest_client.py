#!/usr/bin/env python3
"""Example client for the AI Translation REST API."""

import requests
import json


def main():
    base_url = "http://localhost:8000"

    # Example 1: Simple translation
    print("=" * 60)
    print("Example 1: Simple Translation")
    print("=" * 60)

    translate_request = {
        "text": "印尼人民在此宣誓捍卫印尼的独立。",
        "source_language": "zh",
        "target_language": "id",
    }

    response = requests.post(
        f"{base_url}/v1/translate",
        json=translate_request,
        timeout=30,
    )

    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

    # Example 2: Translation with emotion and voice tags
    print("\n" + "=" * 60)
    print("Example 2: Translation with Emotion and Voice Tags")
    print("=" * 60)

    translate_request = {
        "text": "印尼人民在此宣誓捍卫印尼的独立。",
        "source_language": "zh",
        "target_language": "id",
        "emotion_tags": ["formal"],
        "voice_tags": ["professional"],
    }

    response = requests.post(
        f"{base_url}/v1/translate",
        json=translate_request,
        timeout=30,
    )

    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

    # Example 3: Health check
    print("\n" + "=" * 60)
    print("Example 3: Health Check")
    print("=" * 60)

    response = requests.get(f"{base_url}/health", timeout=10)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")


if __name__ == "__main__":
    main()
