package com.sdewa.coreServices.translation;

import io.grpc.Status;

/**
 * Raised when a call to the AI translation server fails. Carries the gRPC status
 * code so callers can tell "server unreachable" apart from "model blew up".
 */
public class AiTranslationException extends RuntimeException {

	private final Status.Code statusCode;

	public AiTranslationException(Status.Code statusCode, String message, Throwable cause) {
		super(message, cause);
		this.statusCode = statusCode;
	}

	public Status.Code getStatusCode() {
		return statusCode;
	}

}
