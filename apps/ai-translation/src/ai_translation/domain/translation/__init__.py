from .nllb_model import NLLBModel
from .translator import Translator
from .dto import TranslationParams

model = NLLBModel()
translator = Translator(model=model)

