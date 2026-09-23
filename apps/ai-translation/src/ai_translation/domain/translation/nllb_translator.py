import os
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

from .dto import TranslationParams


class NllbTranslatorModel:
    # Map common language names to FLORES-200 codes used by NLLB
    LANG_CODE_MAP = {
        "english": "eng_Latn",
        "indonesian": "ind_Latn",
        "spanish": "spa_Latn",
        "french": "fra_Latn",
        "german": "deu_Latn",
        "japanese": "jpn_Jpan",
        "chinese": "zho_Hans",
        # Add more mappings as needed
    }

    def __init__(
        self,
        model_name: str | None = None,
    ):
        if model_name is None:
            model_name = os.environ.get(
                "MODEL_PATH", os.environ.get("NLLB_MODEL_NAME", "facebook/nllb-200-distilled-600M")
            )

        if torch.cuda.is_available():
            self.device = torch.device("cuda")
        elif torch.backends.mps.is_available():
            self.device = torch.device("mps")
        else:
            self.device = torch.device("cpu")

        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if self.device.type != "cpu" else torch.float32,
        )

        self.model.to(self.device)
        self.model.eval()

    def _resolve_lang_code(self, lang_name: str) -> str:
        """Helper to convert 'English' or 'eng_Latn' into a valid NLLB code."""
        cleaned = lang_name.strip().lower()
        if cleaned in self.LANG_CODE_MAP:
            return self.LANG_CODE_MAP[cleaned]
    
        return lang_name

    @torch.inference_mode()
    def translate(
        self,
        translation_params: TranslationParams,
    ) -> str:
  
        source_lang = getattr(translation_params, "source_language", "eng_Latn")
        src_code = self._resolve_lang_code(source_lang)
        tgt_code = self._resolve_lang_code(translation_params.target_language)

        self.tokenizer.src_lang = src_code

        inputs = self.tokenizer(translation_params.text, return_tensors="pt").to(self.device)

        target_lang_id = self.tokenizer.convert_tokens_to_ids(tgt_code)

        # Generate translation
        outputs = self.model.generate(
            **inputs,
            forced_bos_token_id=target_lang_id,
            max_new_tokens=256,
            num_beams=4, # Beam search is standard & high accuracy for Seq2Seq models
        )

        return self.tokenizer.decode(outputs[0], skip_special_tokens=True).strip()