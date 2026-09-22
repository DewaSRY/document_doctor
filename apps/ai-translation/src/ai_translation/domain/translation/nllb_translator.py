import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from .dto import TranslationParams

class NLLBModel:
    def __init__(
        self,
        model_name: str = "Qwen/Qwen2.5-1.5B-Instruct", # or "meta-llama/Llama-3.2-1B-Instruct"
    ):
        if torch.cuda.is_available():
            self.device = torch.device("cuda")
        elif torch.backends.mps.is_available():
            self.device = torch.device("mps")
        else:
            self.device = torch.device("cpu")

        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            dtype=torch.float16 if self.device.type != "cpu" else torch.float32,
        )

        self.model.to(self.device)
        self.model.eval()

    def _build_messages(self, translation_params: TranslationParams) -> list:
        tags = []
        if translation_params.voice_tags:
            tags.extend(t.strip() for t in translation_params.voice_tags if t.strip())

        if translation_params.emotions_tags:
            tags.extend(t.strip() for t in translation_params.emotions_tags if t.strip())

        style_instruction = f"Apply these vocal/emotion styles: {', '.join(tags)}." if tags else ""

        system_prompt = (
            f"You are a professional {translation_params.target_language} translator. "
            f"Translate this text into {translation_params.target_language}. "
            f"{style_instruction} "
            "Output ONLY the translated text."
        )

        user_content = translation_params.text

        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

    @torch.inference_mode()
    def translate(
        self,
        translation_params: TranslationParams,
    ) -> str:
        messages = self._build_messages(translation_params)

        # Apply standard chat template for the pre-trained model
        prompt = self.tokenizer.apply_chat_template(
            messages, 
            tokenize=False, 
            add_generation_prompt=True
        )

        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)

        outputs = self.model.generate(
            **inputs,
            max_new_tokens=256,
            temperature=0.3, 
            do_sample=True,
        )

        generated_tokens = outputs[0][inputs.input_ids.shape[1]:]
        return self.tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()