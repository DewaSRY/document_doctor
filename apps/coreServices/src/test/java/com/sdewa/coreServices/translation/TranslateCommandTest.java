package com.sdewa.coreServices.translation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Plain unit tests for the validation and defensive copying in {@link TranslateCommand};
 * no Spring context or gRPC server involved.
 */
class TranslateCommandTest {

	@Test
	void shortConstructorDefaultsTagsToEmptyLists() {
		TranslateCommand command = new TranslateCommand("hello", "en", "id");

		assertThat(command.emotionTags()).isEmpty();
		assertThat(command.voiceTags()).isEmpty();
	}

	@Test
	void nullTagsBecomeEmptyLists() {
		TranslateCommand command = new TranslateCommand("hello", "en", "id", null, null);

		assertThat(command.emotionTags()).isEmpty();
		assertThat(command.voiceTags()).isEmpty();
	}

	@Test
	void nullSourceLanguageIsRejected() {
		assertThatThrownBy(() -> new TranslateCommand("hello", null, "id")).isInstanceOf(NullPointerException.class)
			.hasMessage("sourceLanguage must not be null");
	}

	@Test
	void nullTargetLanguageIsRejected() {
		assertThatThrownBy(() -> new TranslateCommand("hello", "en", null)).isInstanceOf(NullPointerException.class)
			.hasMessage("targetLanguage must not be null");
	}

	@Test
	void tagsAreCopiedSoLaterChangesToTheCallersListDoNotLeakIn() {
		List<String> emotions = new ArrayList<>(List.of("calm"));
		List<String> voices = new ArrayList<>(List.of("formal"));

		TranslateCommand command = new TranslateCommand("hello", "en", "id", emotions, voices);
		emotions.add("angry");
		voices.clear();

		assertThat(command.emotionTags()).containsExactly("calm");
		assertThat(command.voiceTags()).containsExactly("formal");
	}

	@Test
	void tagsAreImmutable() {
		TranslateCommand command = new TranslateCommand("hello", "en", "id", List.of("calm"), List.of("formal"));

		assertThatThrownBy(() -> command.emotionTags().add("angry")).isInstanceOf(UnsupportedOperationException.class);
		assertThatThrownBy(() -> command.voiceTags().add("casual")).isInstanceOf(UnsupportedOperationException.class);
	}

	@Test
	void nullElementInsideTagsIsRejected() {
		List<String> withNull = new ArrayList<>();
		withNull.add(null);

		// List.copyOf rejects null elements, which would otherwise blow up later in the protobuf builder.
		assertThatThrownBy(() -> new TranslateCommand("hello", "en", "id", withNull, List.of()))
			.isInstanceOf(NullPointerException.class);
	}

}
