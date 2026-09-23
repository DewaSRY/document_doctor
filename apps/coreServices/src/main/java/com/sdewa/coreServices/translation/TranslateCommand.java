package com.sdewa.coreServices.translation;

import java.util.List;
import java.util.Objects;

/**
 * Input for a translation call. Language, emotion and voice values are the short
 * codes the AI server understands (e.g. {@code "zh"}, {@code "formal"}).
 */
public record TranslateCommand(
		String text,
		String sourceLanguage,
		String targetLanguage,
		List<String> emotionTags,
		List<String> voiceTags) {

	public TranslateCommand {
		// Protobuf builders throw NullPointerException on null, so fail early with a clear message.
		Objects.requireNonNull(text, "text must not be null");
		Objects.requireNonNull(sourceLanguage, "sourceLanguage must not be null");
		Objects.requireNonNull(targetLanguage, "targetLanguage must not be null");
		emotionTags = emotionTags == null ? List.of() : List.copyOf(emotionTags);
		voiceTags = voiceTags == null ? List.of() : List.copyOf(voiceTags);
	}

	public TranslateCommand(String text, String sourceLanguage, String targetLanguage) {
		this(text, sourceLanguage, targetLanguage, List.of(), List.of());
	}

}
