import os
import threading
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from .base import BaseTranslator
from .dto import TranslationParams
from .url_protection import translate_protecting_urls


class QwenTranslatorModel(BaseTranslator):
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
        # Decoder-only models must be padded on the left for batched generation.
        self.tokenizer.padding_side = "left"
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        self.batch_size = int(os.getenv("TRANSLATION_BATCH_SIZE", "8"))
        # generate() is not safe to run from several threads on one model.
        self._lock = threading.Lock()

        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            dtype=self.dtype,
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
            "Keep placeholders such as [1] exactly as they are. "
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

    def translate(
        self,
        translation_params: TranslationParams,
        **generation_options: Any,
    ) -> str:
        """Process one translation request at runtime."""
        return self.translate_batch([translation_params], **generation_options)[0]

    def translate_batch(
        self,
        params_list: list[TranslationParams],
        *,
        max_new_tokens: int = 256,
        temperature: float = 0.2,
        do_sample: bool = False,
    ) -> list[str]:
        """
        Translate many texts with batched generation.

        URLs are kept verbatim. Texts are sorted by length so each batch
        carries little padding; results are returned in the input order.
        """
        return translate_protecting_urls(
            params_list,
            lambda protected: self._translate_sorted(
                protected,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                do_sample=do_sample,
            ),
        )

    def _translate_sorted(
        self,
        params_list: list[TranslationParams],
        *,
        max_new_tokens: int,
        temperature: float,
        do_sample: bool,
    ) -> list[str]:
        order = sorted(
            range(len(params_list)),
            key=lambda index: len(params_list[index].text),
        )
        results: list[str] = [""] * len(params_list)

        for start in range(0, len(order), self.batch_size):
            batch_indices = order[start:start + self.batch_size]
            translations = self._generate(
                [params_list[index] for index in batch_indices],
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                do_sample=do_sample,
            )
            for index, translation in zip(batch_indices, translations):
                results[index] = translation

        return results

    def chat_batch(
        self,
        conversations: list[list[dict[str, str]]],
        *,
        max_new_tokens: int = 512,
    ) -> list[str]:
        """
        Run free-form chat completions (summaries, extraction, ...) on the
        loaded model, in batches; results are returned in the input order.
        """
        prompts = [
            self.tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )
            for messages in conversations
        ]
        results: list[str] = []
        for start in range(0, len(prompts), self.batch_size):
            results.extend(
                self._generate_prompts(
                    prompts[start:start + self.batch_size],
                    max_new_tokens=max_new_tokens,
                    temperature=0.2,
                    do_sample=False,
                )
            )
        return results

    def _generate(
        self,
        params_list: list[TranslationParams],
        *,
        max_new_tokens: int,
        temperature: float,
        do_sample: bool,
    ) -> list[str]:
        return self._generate_prompts(
            [self._build_prompt(params) for params in params_list],
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            do_sample=do_sample,
        )

    @torch.inference_mode()
    def _generate_prompts(
        self,
        prompts: list[str],
        *,
        max_new_tokens: int,
        temperature: float,
        do_sample: bool,
    ) -> list[str]:
        inputs = self.tokenizer(
            prompts,
            return_tensors="pt",
            padding=True,
            truncation=True,
        )

        inputs = {
            key: value.to(self.device)
            for key, value in inputs.items()
        }

        generation_kwargs: dict[str, Any] = {
            "max_new_tokens": max_new_tokens,
            "do_sample": do_sample,
            "pad_token_id": self.tokenizer.pad_token_id,
        }

        if do_sample:
            generation_kwargs["temperature"] = temperature

        with self._lock:
            outputs = self.model.generate(
                **inputs,
                **generation_kwargs,
            )

        # Left padding gives every prompt the same length.
        input_length = inputs["input_ids"].shape[1]

        translations = self.tokenizer.batch_decode(
            outputs[:, input_length:],
            skip_special_tokens=True,
        )

        return [translation.strip() for translation in translations]
