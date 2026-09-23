package com.sdewa.coreServices.translation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.sdewa.coreServices.grpc.translation.v1.TranslateRequest;
import com.sdewa.coreServices.grpc.translation.v1.TranslateResponse;
import com.sdewa.coreServices.grpc.translation.v1.TranslationServiceGrpc;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;

/**
 * Runs the real client wiring (application.yaml + {@link TranslationGrpcClientConfig})
 * against a fake TranslationService on a random local port, so no model or GPU is needed.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE, properties = {
		"spring.grpc.server.enabled=false",
		"spring.autoconfigure.exclude="
				+ "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,"
				+ "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration" })
class AiTranslationClientTest {

	private static final FakeTranslationService fakeServer = new FakeTranslationService();

	private static Server server;

	@Autowired
	private AiTranslationClient client;

	@BeforeAll
	static void startServer() throws IOException {
		server = ServerBuilder.forPort(0).addService(fakeServer).build().start();
	}

	@AfterAll
	static void stopServer() throws InterruptedException {
		server.shutdownNow().awaitTermination(5, TimeUnit.SECONDS);
	}

	@DynamicPropertySource
	static void grpcProperties(DynamicPropertyRegistry registry) {
		registry.add("AI_TRANSLATION_GRPC_PORT", () -> server.getPort());
		registry.add("AI_TRANSLATION_GRPC_DEADLINE", () -> "500ms");
	}

	@BeforeEach
	void resetFake() {
		fakeServer.reset();
	}

	@Test
	void mapsCommandToRequestAndResponseToResult() {
		TranslationResult result = client.translate(
				new TranslateCommand("你好", "zh", "id", List.of("calm"), List.of("formal", "friendly")));

		TranslateRequest sent = fakeServer.lastRequest.get();
		assertThat(sent.getText()).isEqualTo("你好");
		assertThat(sent.getSourceLanguage()).isEqualTo("zh");
		assertThat(sent.getTargetLanguage()).isEqualTo("id");
		assertThat(sent.getEmotionTagsList()).containsExactly("calm");
		assertThat(sent.getVoiceTagsList()).containsExactly("formal", "friendly");

		assertThat(result).isEqualTo(new TranslationResult("[id] 你好", "zh", "id", "fake-model"));
	}

	@Test
	void omittedTagsAreSentAsEmptyLists() {
		client.translate(new TranslateCommand("hello", "en", "id"));

		assertThat(fakeServer.lastRequest.get().getEmotionTagsList()).isEmpty();
		assertThat(fakeServer.lastRequest.get().getVoiceTagsList()).isEmpty();
	}

	@Test
	void serverErrorIsWrappedWithItsStatusCode() {
		fakeServer.failWith = Status.INTERNAL.withDescription("CUDA out of memory");

		assertThatThrownBy(() -> client.translate(new TranslateCommand("hello", "en", "id")))
			.isInstanceOfSatisfying(AiTranslationException.class,
					ex -> assertThat(ex.getStatusCode()).isEqualTo(Status.Code.INTERNAL))
			.hasMessageContaining("CUDA out of memory");
	}

	@Test
	void slowServerHitsConfiguredDeadline() {
		fakeServer.delayMillis = 2_000;

		assertThatThrownBy(() -> client.translate(new TranslateCommand("hello", "en", "id")))
			.isInstanceOfSatisfying(AiTranslationException.class,
					ex -> assertThat(ex.getStatusCode()).isEqualTo(Status.Code.DEADLINE_EXCEEDED));
	}

	@Test
	void nullTextIsRejectedBeforeAnyCall() {
		assertThatThrownBy(() -> new TranslateCommand(null, "en", "id")).isInstanceOf(NullPointerException.class)
			.hasMessage("text must not be null");
	}

	@SpringBootConfiguration
	@EnableAutoConfiguration
	@Import({ TranslationGrpcClientConfig.class, AiTranslationClient.class })
	static class TestApplication {

	}

	static class FakeTranslationService extends TranslationServiceGrpc.TranslationServiceImplBase {

		final AtomicReference<TranslateRequest> lastRequest = new AtomicReference<>();

		volatile Status failWith;

		volatile long delayMillis;

		void reset() {
			lastRequest.set(null);
			failWith = null;
			delayMillis = 0;
		}

		@Override
		public void translate(TranslateRequest request, StreamObserver<TranslateResponse> responseObserver) {
			lastRequest.set(request);
			if (delayMillis > 0) {
				try {
					Thread.sleep(delayMillis);
				}
				catch (InterruptedException ex) {
					Thread.currentThread().interrupt();
				}
			}
			if (failWith != null) {
				responseObserver.onError(failWith.asRuntimeException());
				return;
			}
			responseObserver.onNext(TranslateResponse.newBuilder()
				.setTranslatedText("[" + request.getTargetLanguage() + "] " + request.getText())
				.setSourceLanguage(request.getSourceLanguage())
				.setTargetLanguage(request.getTargetLanguage())
				.setModel("fake-model")
				.build());
			responseObserver.onCompleted();
		}

	}

}
