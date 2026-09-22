import torch

from transformers import AutoModelForSeq2SeqLM, AutoTokenizer


class NLLBModel:
    def __init__(
        self,
        model_name: str = "facebook/nllb-200-distilled-600M",
    ):
        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        self.tokenizer = AutoTokenizer.from_pretrained(model_name)

        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            model_name,
        )

        self.model.to(self.device)
        self.model.eval()

    @torch.inference_mode()
    def translate(
        self,
        text: str,
        source_language: str,
        target_language: str,
    ) -> str:

        self.tokenizer.src_lang = source_language

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
        ).to(self.device)

        target_token_id = self.tokenizer.convert_tokens_to_ids(
            target_language
        )

        output = self.model.generate(
            **inputs,
            forced_bos_token_id=target_token_id,
            max_length=512,
        )

        return self.tokenizer.batch_decode(
            output,
            skip_special_tokens=True,
        )[0]