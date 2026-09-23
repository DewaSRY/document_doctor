package com.sdewa.coreServices.translation;

import org.springframework.stereotype.Service;

import com.sdewa.coreServices.grpc.translation.v1.TranslateRequest;
import com.sdewa.coreServices.grpc.translation.v1.TranslateResponse;
import com.sdewa.coreServices.grpc.translation.v1.TranslationServiceGrpc.TranslationServiceBlockingStub;

import io.grpc.StatusRuntimeException;
import lombok.RequiredArgsConstructor;

/**
 * Calls {@code translation.v1.TranslationService/Translate} on the AI server and
 * keeps generated protobuf types out of the rest of the application.
 */
@Service
@RequiredArgsConstructor
public class AiTranslationClient {

	private final TranslationServiceBlockingStub stub;

	public TranslationResult translate(TranslateCommand command) {
		TranslateRequest request = TranslateRequest.newBuilder()
			.setText(command.text())
			.setSourceLanguage(command.sourceLanguage())
			.setTargetLanguage(command.targetLanguage())
			.addAllEmotionTags(command.emotionTags())
			.addAllVoiceTags(command.voiceTags())
			.build();

		TranslateResponse response;
		try {
			response = stub.translate(request);
		}
		catch (StatusRuntimeException ex) {
			throw new AiTranslationException(
					ex.getStatus().getCode(), 
					ex.getStatus().getDescription(),
					ex
			);
		}

		return new TranslationResult(response.getTranslatedText(), response.getSourceLanguage(),
				response.getTargetLanguage(), response.getModel());
	}

}
