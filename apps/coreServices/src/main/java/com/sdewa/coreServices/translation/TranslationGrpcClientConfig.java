package com.sdewa.coreServices.translation;

import org.springframework.context.annotation.Configuration;
import org.springframework.grpc.client.ImportGrpcClients;

import com.sdewa.coreServices.grpc.translation.v1.TranslationServiceGrpc;

/**
 * Registers a {@link TranslationServiceGrpc.TranslationServiceBlockingStub} bean
 * bound to the {@code ai-translation} channel. Host, port, TLS and deadline for
 * that channel live under {@code spring.grpc.client.channel.ai-translation.*}.
 */
@Configuration(proxyBeanMethods = false)
@ImportGrpcClients(target = "ai-translation", types = TranslationServiceGrpc.TranslationServiceBlockingStub.class)
public class TranslationGrpcClientConfig {

}
