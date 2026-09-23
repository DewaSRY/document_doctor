package com.sdewa.coreServices.translation;

import io.grpc.Status;


public class AiTranslationException extends RuntimeException {

	private final Status.Code statusCode;

	public AiTranslationException(Status.Code statusCode, String message, Throwable cause) {
		super(String.format("AI translation failed: %s: %s", statusCode, message), cause);
		this.statusCode = statusCode;
	}

	public Status.Code getStatusCode() {
		return statusCode;
	}

}
