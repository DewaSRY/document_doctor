import os
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from .dto import TranslationParams


class QwenTranslatorModel:
    """
    Long-lived Qwen inference engine.

    The model is loaded once when this class is initialized.
    Each call to `translate()` processes a new request at runtime.
    """

    def __init__(
        self,
        model_name: str | None = None,
    ):
        self.model_name = (
            model_name
            or os.getenv("MODEL_PATH")
            or os.getenv(
                "QWEN_MODEL_NAME",
                "Qwen/Qwen2.5-1.5B-Instruct",
            )
        )

        self.device = self._get_device()
        self.dtype = self._get_dtype()

        print(f"Loading model: {self.model_name}")
        print(f"Device: {self.device}")
        print(f"Dtype: {self.dtype}")

        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_name,
        )

        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            torch_dtype=self.dtype,
        )

        self.model.to(self.device)
        self.model.eval()

        print("Qwen model loaded successfully.")

    def _get_device(self) -> torch.device:
        if torch.cuda.is_available():
            return torch.device("cuda")

        if torch.backends.mps.is_available():
            return torch.device("mps")

        return torch.device("cpu")

    def _get_dtype(self) -> torch.dtype:
        if self.device.type == "cuda":
            return torch.float16

        if self.device.type == "mps":
            return torch.float16

        return torch.float32

    def _build_messages(
        self,
        translation_params: TranslationParams,
    ) -> list[dict[str, str]]:
        tags: list[str] = []

        if translation_params.voice_tags:
            tags.extend(
                tag.strip()
                for tag in translation_params.voice_tags
                if tag.strip()
            )

        if translation_params.emotions_tags:
            tags.extend(
                tag.strip()
                for tag in translation_params.emotions_tags
                if tag.strip()
            )

        style_instruction = ""

        if tags:
            style_instruction = (
                f"Apply the following style characteristics: "
                f"{', '.join(tags)}."
            )

        system_prompt = (
            f"You are a professional translator. "
            f"Translate the user's text into "
            f"{translation_params.target_language}. "
            f"{style_instruction} "
            "Preserve the original meaning and context. "
            "Do not explain the translation. "
            "Output ONLY the translated text."
        )

        return [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": translation_params.text,
            },
        ]

    def _build_prompt(
        self,
        translation_params: TranslationParams,
    ) -> str:
        messages = self._build_messages(translation_params)

        return self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

    @torch.inference_mode()
    def translate(
        self,
        translation_params: TranslationParams,
        *,
        max_new_tokens: int = 256,
        temperature: float = 0.2,
        do_sample: bool = False,
    ) -> str:
        """
        Process one translation request at runtime.

        The model itself is NOT loaded again.
        """

        prompt = self._build_prompt(translation_params)

        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
        )

        inputs = {
            key: value.to(self.device)
            for key, value in inputs.items()
        }

        generation_kwargs: dict[str, Any] = {
            "max_new_tokens": max_new_tokens,
            "do_sample": do_sample,
        }

        if do_sample:
            generation_kwargs["temperature"] = temperature

        outputs = self.model.generate(
            **inputs,
            **generation_kwargs,
        )

        input_length = inputs["input_ids"].shape[1]

        generated_tokens = outputs[0][input_length:]

        translation = self.tokenizer.decode(
            generated_tokens,
            skip_special_tokens=True,
        )

        return translation.strip()