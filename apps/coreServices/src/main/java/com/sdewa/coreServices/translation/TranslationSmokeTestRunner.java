package com.sdewa.coreServices.translation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Sends one translation request to the AI server once the application has started,
 * so a plain {@code bootRun} shows whether the gRPC connection works. Toggle with
 * {@code translation.smoke-test.enabled}.
 */
@Component
@ConditionalOnProperty(name = "translation.smoke-test.enabled", havingValue = "true")
public class TranslationSmokeTestRunner implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(TranslationSmokeTestRunner.class);

	private final AiTranslationClient client;

	public TranslationSmokeTestRunner(AiTranslationClient client) {
		this.client = client;
	}

	@Override
	public void run(ApplicationArguments args) {
		TranslateCommand command = new TranslateCommand("Hello, how are you today?", "en", "zh");
		log.info("gRPC smoke test: sending {}", command);
		long start = System.currentTimeMillis();
		try {
			TranslationResult result = client.translate(command);
			log.info("gRPC smoke test OK in {} ms: {}", System.currentTimeMillis() - start, result);
		}
		catch (AiTranslationException ex) {
			// Log instead of rethrowing so the application still starts when the AI server is down.
			log.error("gRPC smoke test FAILED in {} ms (status {}): {}", System.currentTimeMillis() - start,
					ex.getStatusCode(), ex.getMessage());
		}
	}

}
