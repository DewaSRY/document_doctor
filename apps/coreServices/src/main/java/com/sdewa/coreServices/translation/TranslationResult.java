package com.sdewa.coreServices.translation;

public record TranslationResult(
		String translatedText,
		String sourceLanguage,
		String targetLanguage,
		String model) {
}
