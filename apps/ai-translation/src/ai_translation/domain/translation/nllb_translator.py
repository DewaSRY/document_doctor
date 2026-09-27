

import os
import threading

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

from .dto import TranslationParams


class NllbTranslatorModel:
    """
    Runtime-optimized NLLB translation model.

    Optimizations:
    - Loads model once during application startup.
    - Uses inference_mode().
    - Uses greedy decoding by default.
    - Enables KV cache.
    - Uses fp16 on CUDA/MPS.
    - Uses fp32 on CPU for compatibility.
    - Avoids unnecessary tokenizer/model configuration per request.
    """

    LANG_CODE_MAP = {
        "english": "eng_Latn",
        "indonesian": "ind_Latn",
        "spanish": "spa_Latn",
        "french": "fra_Latn",
        "german": "deu_Latn",
        "japanese": "jpn_Jpan",
        "chinese": "zho_Hans",
        "korean": "kor_Hang",
    }

    DEFAULT_MODEL = "facebook/nllb-200-distilled-600M"

    def __init__(
        self,
        model_name: str | None = None,
    ):
        self.model_name = (
            model_name
            or os.getenv("MODEL_PATH")
            or os.getenv("NLLB_MODEL_NAME")
            or self.DEFAULT_MODEL
        )

        self.device = self._get_device()
        self.dtype = self._get_dtype()

        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_name,
            use_fast=True,
        )

        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            self.model_name,
            dtype=self.dtype,
        )

        self.model.to(self.device)
        self.model.eval()

        # Helps some inference workloads avoid unnecessary
        # training-related configuration.
        self.model.config.use_cache = True
        # max_new_tokens is computed per request; drop the conflicting default.
        self.model.generation_config.max_length = None

        self.batch_size = int(os.getenv("TRANSLATION_BATCH_SIZE", "16"))
        # generate() is not safe to run from several threads on one model,
        # and tokenizer.src_lang is shared state.
        self._lock = threading.Lock()

    @staticmethod
    def _get_device() -> torch.device:
        if torch.cuda.is_available():
            return torch.device("cuda")

        if torch.backends.mps.is_available():
            return torch.device("mps")

        return torch.device("cpu")

    def _get_dtype(self) -> torch.dtype:
        if self.device.type in ("cuda", "mps"):
            return torch.float16

        return torch.float32

    def _resolve_lang_code(self, lang_name: str) -> str:
        cleaned = lang_name.strip().lower()
        code = self.LANG_CODE_MAP.get(cleaned, lang_name)

        # Unknown codes map to <unk> and silently produce untranslated output.
        if self.tokenizer.convert_tokens_to_ids(code) == self.tokenizer.unk_token_id:
            raise ValueError(f"Unsupported language: {lang_name}")

        return code

    def translate(
        self,
        translation_params: TranslationParams,
    ) -> str:
        return self.translate_batch([translation_params])[0]

    def translate_batch(
        self,
        params_list: list[TranslationParams],
    ) -> list[str]:
        """
        Translate many texts with batched generation.

        All params must share the same source and target language.
        Results are returned in the input order.
        """
        if not params_list:
            return []

        first = params_list[0]
        if any(
            params.source_language != first.source_language
            or params.target_language != first.target_language
            for params in params_list
        ):
            raise ValueError("translate_batch requires one language pair per call")

        src_code = self._resolve_lang_code(first.source_language)
        tgt_code = self._resolve_lang_code(first.target_language)

        # Sort by length so each batch carries little padding.
        order = sorted(
            range(len(params_list)),
            key=lambda index: len(params_list[index].text),
        )
        results: list[str] = [""] * len(params_list)

        for start in range(0, len(order), self.batch_size):
            batch_indices = order[start:start + self.batch_size]
            translations = self._generate(
                [params_list[index].text for index in batch_indices],
                src_code,
                tgt_code,
            )
            for index, translation in zip(batch_indices, translations):
                results[index] = translation

        return results

    @torch.inference_mode()
    def _generate(
        self,
        texts: list[str],
        src_code: str,
        tgt_code: str,
    ) -> list[str]:
        with self._lock:
            self.tokenizer.src_lang = src_code

            inputs = self.tokenizer(
                texts,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512,
            )

            inputs = {
                key: value.to(self.device)
                for key, value in inputs.items()
            }

            target_lang_id = self.tokenizer.convert_tokens_to_ids(
                tgt_code
            )

            outputs = self.model.generate(
                **inputs,
                forced_bos_token_id=target_lang_id,

                # Runtime optimization
                num_beams=1,
                do_sample=False,
                use_cache=True,

                # Scale with the input so long segments are not cut off
                max_new_tokens=min(512, inputs["input_ids"].shape[-1] * 2 + 16),

                # Avoid returning unnecessary generation data
                return_dict_in_generate=False,
            )

        return [
            translation.strip()
            for translation in self.tokenizer.batch_decode(
                outputs,
                skip_special_tokens=True,
            )
        ]
