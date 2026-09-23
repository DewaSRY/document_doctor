# coreServices → AI Translation gRPC Client — As Implemented

## Who this doc is for

This doc is for engineers who know Spring Boot (beans, `application.yaml`, `@SpringBootTest`)
but may not have used gRPC from Java. If you already know gRPC-java and protobuf codegen well,
skip **Section 0**.

Everything below was checked against the source in this repo, and the behavior was confirmed
with the test suite in `AiTranslationClientTest`. It describes what the code does, not what it
ideally should do. Read the callouts before building on it: some behavior you might assume is
**not** there yet, such as retries, TLS, auth, input validation and a REST endpoint.

Companion docs on the server side:
[`GRPC_SERVER.md`](../../ai-translation/docs/GRPC_SERVER.md) and
[`GRPC_SERVER_IMPLEMENTATION.md`](../../ai-translation/docs/GRPC_SERVER_IMPLEMENTATION.md).

---

## 0. Background primer

### How gRPC compares to what the app already uses

| Approach       | Direction                       | Transport                        | Typical use                                  |
| -------------- | ------------------------------- | -------------------------------- | -------------------------------------------- |
| REST / JSON    | Request → response              | HTTP/1.1 or HTTP/2, text body    | Public APIs, browsers                        |
| **gRPC (unary)** | **Request → response**        | **HTTP/2, binary protobuf body** | **Service-to-service calls with a strict contract** |
| gRPC streaming | One-way or two-way message streams | HTTP/2                        | Token streaming, long-running jobs           |

coreServices uses **unary gRPC**: one `TranslateRequest` goes in and one `TranslateResponse` comes back.

### The pieces you'll see

- **`.proto` file**: the contract. It declares the messages and the service. Both sides generate code from it.
- **Generated code**: `protoc` (the protobuf compiler) turns the `.proto` into Java message
  classes (`TranslateRequest`, `TranslateResponse`). The `protoc-gen-grpc-java` plugin adds
  `TranslationServiceGrpc`, which holds the client **stubs** and the server base class.
- **Channel**: a long-lived, pooled HTTP/2 connection to `host:port`. One channel per target is
  the norm; do not create one per request.
- **Stub**: a thin typed proxy over a channel. A **blocking stub** makes `stub.translate(req)`
  a normal synchronous method call.
- **Deadline**: gRPC's per-call timeout. When it expires, the call fails with `DEADLINE_EXCEEDED`.
- **Status**: gRPC errors are not HTTP codes. They are `io.grpc.Status` codes (`UNAVAILABLE`,
  `INTERNAL`, `DEADLINE_EXCEEDED`, …). The blocking stub throws them as `StatusRuntimeException`.

### Gotchas that surprise newcomers

1. **By default a gRPC call has no timeout at all.** If the server hangs, a blocking stub waits
   forever. That is why the channel config in **Section 3** sets a default deadline.
2. **Protobuf never sends `null`.** Unset string fields arrive as `""` and unset repeated fields
   as empty lists. The Java builders also *throw* `NullPointerException` if you pass `null`
   (`setText(null)`). That is why `TranslateCommand` normalizes its inputs (**Section 5**).
3. **Spring gRPC's default target is `static://localhost:9090`**
   (`GrpcClientProperties.Channel.DEFAULT_TARGET` in `spring-boot-grpc-client-4.1.1.jar`), but
   the Python server listens on **50051** (`ai-translation/.../bootstrap/server.py:15`).
   If the channel config is missing, you get `UNAVAILABLE` against the wrong port.

---

## 1. Architecture at a glance

The composition root is `CoreServicesApplication` (`CoreServicesApplication.java:6`). It holds no
gRPC logic. `@SpringBootApplication` component-scans `com.sdewa.coreServices.translation`, which
picks up the config class and the client service. The **Spring Boot gRPC client starter**
(`build.gradle:23`, which resolves to Spring gRPC `1.1.1` / grpc-java `1.83.1`) auto-configures the
channel factory from `application.yaml`.

| Concern                            | Owner                                                          | Analogy                                           |
| ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| API contract                       | `apps/ai-translation/proto/translation/v1/translation.proto`   | The OpenAPI spec, owned by the server team        |
| Java codegen                       | `build.gradle:44-66` (`com.google.protobuf` plugin)            | An OpenAPI generator run on every build           |
| Connection (host, port, TLS, deadline) | `application.yaml:4-15` (`spring.grpc.client.channel.ai-translation`) | The base URL + timeout of a `RestClient`   |
| Stub bean registration             | `TranslationGrpcClientConfig.java:13-14` (`@ImportGrpcClients`) | `@EnableFeignClients`                            |
| Mapping + error translation        | `AiTranslationClient.java:22-42`                               | A repository adapter over a remote API            |
| Domain-side input/output types     | `TranslateCommand.java`, `TranslationResult.java`              | Request/response DTOs                             |
| Failure type                       | `AiTranslationException.java`                                  | A `RestClientResponseException` equivalent        |

**Why it's split this way.** Only `AiTranslationClient` and the config class import generated
protobuf types. Everything else in coreServices talks in plain records (`TranslateCommand` in,
`TranslationResult` out), so a future controller or JPA entity never touches protobuf builders.
The same split lets the tests swap the real Python server for a fake one without changing any
production class. One consequence of that split shows up later: **nothing in coreServices calls
`AiTranslationClient` yet** (Section 8). The client is wired and tested, but it has no entry point.

---

## 2. Codegen: getting Java classes from the server's `.proto`

### The problem

The contract lives in the Python app. coreServices needs typed Java classes for it. They must be
regenerated whenever the contract changes, and they must never be hand-edited or copied across.

### How it's implemented

Before this change, `build.gradle` already **applied** the protobuf plugin (`build.gradle:5`) but
never **configured** it, so no code was generated. Two blocks were added.

**Source location.** coreServices compiles the proto straight from the server app
(`build.gradle:44-50`):

```groovy
sourceSets {
	main {
		proto {
			srcDir "${rootDir}/../ai-translation/proto"
		}
	}
}
```

**Compiler + gRPC plugin versions come from Spring Boot's BOM** (`build.gradle:52-66`), not from
hard-coded numbers:

```groovy
protoc {
	artifact = "com.google.protobuf:protoc:${dependencyManagement.importedProperties['protobuf-java.version']}"
}
plugins {
	grpc {
		artifact = "io.grpc:protoc-gen-grpc-java:${dependencyManagement.importedProperties['grpc.version']}"
	}
}
```

Today these resolve to `protoc:4.35.1` and `protoc-gen-grpc-java:1.83.1`. That matches the
`protobuf-java` and `grpc-*` runtime jars the starter pulls in. When Spring Boot upgrades, the
compiler and the runtime move together. A protoc newer than the runtime is the classic cause of
`NoSuchMethodError` in generated code.

**Java package options were added to the shared proto**
(`ai-translation/proto/translation/v1/translation.proto:5-7`):

```proto
option java_multiple_files = true;
option java_package = "com.sdewa.coreServices.grpc.translation.v1";
option java_outer_classname = "TranslationProto";
```

Without them, protoc puts everything in the Java package `translation.v1`, with the messages
nested inside one outer class (`translation.v1.Translation.TranslateRequest`).

### What gets generated

Run `./gradlew generateProto` (it also runs as part of `compileJava`). Output goes to
`build/generated/sources/proto/main/`:

| Class                                   | What it is                                                          |
| --------------------------------------- | ------------------------------------------------------------------- |
| `TranslateRequest`, `TranslateResponse` | Immutable messages with `newBuilder()` builders                     |
| `…OrBuilder` interfaces                 | Read-only views; you rarely use them directly                       |
| `TranslationProto`                      | Holds the file descriptor                                           |
| `TranslationServiceGrpc`                | Stubs: `…BlockingStub` (used), `…BlockingV2Stub`, `…FutureStub`, `…Stub` (async); plus `…ImplBase` (server side, used only by the test fake) |

> **Worth flagging: the proto lives outside the Gradle project.** `srcDir` points at
> `../ai-translation/proto`. That works in this monorepo, but a Docker build whose context is
> only `apps/coreServices` will fail at `generateProto`. When coreServices gets a Dockerfile,
> use the repo root as the build context, or copy the proto in a build step.

> **Worth flagging: the Python stubs were not regenerated.** The `java_*` options have no effect
> on Python codegen or on the wire format, so `translation_pb2.py` still works unchanged. The
> next `make gen-proto` will embed the options in the serialized descriptor inside
> `translation_pb2.py`. That is a harmless diff, but don't be surprised by it.

> **Newcomer aside: why there is no `@generated=omit` option.** Many online guides pass
> `option '@generated=omit'` to the grpc plugin to avoid a `javax.annotation.Generated`
> dependency. With grpc-java 1.83 it made no difference; the plugin emits only
> `@io.grpc.stub.annotations.GrpcGenerated`, which was checked by building both ways. So it was
> left out.

---

## 3. Channel configuration

### The problem

The client needs to know where the server is, whether to use TLS, and how long to wait. These
differ between a laptop, Docker Compose and production, so they must come from config, not code.

### How it's implemented

`application.yaml:4-15`:

```yaml
spring:
  grpc:
    client:
      channel:
        ai-translation:
          target: static://${AI_TRANSLATION_GRPC_HOST:localhost}:${AI_TRANSLATION_GRPC_PORT:50051}
          ssl:
            enabled: false
          default:
            deadline: ${AI_TRANSLATION_GRPC_DEADLINE:120s}
```

| Property                                       | Value today                     | What actually happens                                                                 |
| ---------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| `channel.ai-translation`                       | name `ai-translation`           | The key that `@ImportGrpcClients(target = "ai-translation")` looks up (Section 4)     |
| `.target`                                      | `static://localhost:50051`      | `static://` means one fixed address with no DNS re-resolution. `dns:///host:port` is the alternative for multiple A records |
| `.ssl.enabled`                                 | `false`                         | Plaintext HTTP/2. Required, because the server only calls `add_insecure_port` (`server.py:22`) |
| `.default.deadline`                            | `120s`                          | Applied to **every** call on this channel by Spring gRPC's deadline interceptor        |

Environment variables:

| Variable                        | Default     | Use                                               |
| ------------------------------- | ----------- | ------------------------------------------------- |
| `AI_TRANSLATION_GRPC_HOST`      | `localhost` | Set to `ai-translation` inside Docker Compose      |
| `AI_TRANSLATION_GRPC_PORT`      | `50051`     | Must match the server's `GRPC_PORT`                |
| `AI_TRANSLATION_GRPC_DEADLINE`  | `120s`      | Any Spring `Duration` (`500ms`, `30s`, `2m`)       |

### Why the deadline is 120 seconds

The server loads the Qwen model **lazily on the first request**
(`ai-translation/.../domain/translation/__init__.py:13-17`). The first call after a server
restart pays for the full model load, and later calls pay only for inference. A tight deadline
such as 5s would make the first call fail every time with `DEADLINE_EXCEEDED`, even though the
server is fine and still working. The server then finishes the translation for nobody.

> **This trips people up: the deadline is real, and it has been tested.**
> `slowServerHitsConfiguredDeadline` sets the deadline to `500ms` and makes the fake server sleep
> for 2s. The call fails with `DEADLINE_EXCEEDED`. When the test deadline was temporarily raised
> to `10s`, that same test failed, which proves the value comes from this YAML and not from a
> hidden default.

> **Deliberately not configured: retries, keepalive, TLS, auth.** The channel has no
> `service-config` retry policy, no keepalive and no credentials. Today, a transient
> `UNAVAILABLE` (for example, the server restarting) goes straight to the caller as an
> `AiTranslationException`. If you add retries later, only retry `UNAVAILABLE`. `Translate` is
> expensive GPU work, and retrying `DEADLINE_EXCEEDED` can stack duplicate inference jobs on the
> server.

---

## 4. Stub registration

### The problem

Something has to build a `TranslationServiceBlockingStub` on top of the `ai-translation`
channel and expose it as a Spring bean.

### How it's implemented

`TranslationGrpcClientConfig.java:13-14`:

```java
@Configuration(proxyBeanMethods = false)
@ImportGrpcClients(target = "ai-translation", types = TranslationServiceGrpc.TranslationServiceBlockingStub.class)
public class TranslationGrpcClientConfig {
}
```

`@ImportGrpcClients` (from `spring-grpc-core`) registers a bean for each listed stub type.
`target` names the channel from Section 3. Spring gRPC's `GrpcChannelFactory` creates and caches
that channel and closes it on context shutdown, so you never manage `ManagedChannel` lifecycle
yourself.

> **Newcomer aside: why `types = BlockingStub` and not the whole `TranslationServiceGrpc`.**
> You can also pass `value = TranslationServiceGrpc.class` and pick a stub factory. Naming the
> exact stub type keeps one unambiguous bean, so constructor injection by type
> (`AiTranslationClient.java:20`) just works.

---

## 5. `AiTranslationClient`: mapping and error translation

### The problem

Callers should not have to build protobuf messages or catch `StatusRuntimeException`. They
should pass a plain Java object and get back either a result or one meaningful exception.

### How it's implemented

**Input normalization** happens in `TranslateCommand`'s compact constructor
(`TranslateCommand.java:17-24`). The three strings are required, and `null` tag lists become
`List.of()`:

```java
Objects.requireNonNull(text, "text must not be null");
...
emotionTags = emotionTags == null ? List.of() : List.copyOf(emotionTags);
```

There is also a convenience constructor with no tags (`TranslateCommand.java:26-28`).

**The call** (`AiTranslationClient.java:22-42`) goes through three steps:

1. Build a `TranslateRequest` field by field (`:23-29`).
2. Call `stub.translate(request)` (`:33`). This blocks the calling thread until the response
   arrives, an error comes back, or the deadline fires.
3. Catch `StatusRuntimeException` and rethrow it as `AiTranslationException`, carrying the gRPC
   status code (`:35-38`):

```java
catch (StatusRuntimeException ex) {
	throw new AiTranslationException(ex.getStatus().getCode(),
			"AI translation failed: " + ex.getStatus().getCode() + " " + ex.getStatus().getDescription(), ex);
}
```

4. Copy the four response fields into a `TranslationResult` (`:40-41`).

### Status codes a caller can actually see

| `getStatusCode()`   | When it happens today                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `UNAVAILABLE`       | Server not running, wrong host or port, or TLS mismatch                                                         |
| `DEADLINE_EXCEEDED` | Model load plus inference took longer than `default.deadline`                                                   |
| `INTERNAL`          | **Any** Python exception in the servicer. The message is `str(exc)` (`servicer.py:33-36`)                        |
| `UNIMPLEMENTED`     | Proto drift, for example a server built from an older proto without the method                                  |

> **A sharp edge to know about: unsupported language codes do not fail.** The server looks up
> codes with `LANGUAGES.get(code, "Unknown")` (`ai-translation/.../utils.py:15-16`). The same
> applies to emotion and voice tags. `sourceLanguage = "xx"` is **not** rejected with
> `INVALID_ARGUMENT`. The server prompts the model with the literal word "Unknown" and returns a
> success. The client passes codes through unchecked (`TranslateCommand` only checks for
> `null`). Supported codes today: `en id fr de es ja ko zh`. If you add an HTTP endpoint, validate
> codes there. Better still, fix the server to return `INVALID_ARGUMENT`.

> **Worth flagging: the response echoes the request's language codes, not what the model used.**
> `TranslationResult.sourceLanguage()` and `.targetLanguage()` are copied from the request by
> the server (`servicer.py:29-30`). `model()` is the Hugging Face `name_or_path` of the loaded
> model (`servicer.py:31`). It is useful to log or persist next to each translation.

> **Worth flagging: a blocking stub is the right choice for Spring MVC, and the wrong one for
> WebFlux.** `build.gradle:26-27` pulls in **both** `webmvc` and `webflux`. When both are
> present, Spring Boot runs the servlet (MVC) stack, where blocking a request thread is normal.
> If you ever call `AiTranslationClient` from a WebFlux handler or a Reactor chain, wrap it in
> `Mono.fromCallable(...).subscribeOn(Schedulers.boundedElastic())`. Otherwise one slow
> translation stalls an event-loop thread.

---

## 6. Tests

### The problem

The real server needs a multi-GB model and ideally a GPU. The client wiring (YAML, stub bean,
mapping, error handling, deadline) still has to be tested in CI.

### How it's implemented

`AiTranslationClientTest` starts a **real Netty gRPC server on a random port** with a fake
`TranslationServiceImplBase` (`AiTranslationClientTest.java:51-53`). It then points the
**production** `application.yaml` at that port by overriding only the env-var placeholders
(`:61-63`):

```java
registry.add("AI_TRANSLATION_GRPC_PORT", () -> server.getPort());
registry.add("AI_TRANSLATION_GRPC_DEADLINE", () -> "500ms");
```

This deliberately does **not** use `@AutoConfigureTestGrpcTransport` (the in-process transport
from the test starter). That transport replaces the channel factory, so it would skip the
`static://` target and `ssl.enabled: false` settings that the test is meant to cover.

| Test                                      | What it proves                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `mapsCommandToRequestAndResponseToResult` | Every field crosses the wire in both directions, including repeated tags |
| `omittedTagsAreSentAsEmptyLists`          | The 3-argument constructor produces empty (not null) repeated fields     |
| `serverErrorIsWrappedWithItsStatusCode`   | Server `INTERNAL` becomes `AiTranslationException(INTERNAL)`, keeping the description |
| `slowServerHitsConfiguredDeadline`        | The YAML deadline is applied (see the callout in Section 3)             |
| `nullTextIsRejectedBeforeAnyCall`         | A clear error before protobuf's own NPE                                  |

Run them:

```bash
cd apps/coreServices
./gradlew test --tests '*AiTranslationClientTest'
```

> **Rough edge: the test has to switch off two unrelated things** (`AiTranslationClientTest.java:36-40`).
> - `spring.grpc.server.enabled=false`: the `grpc-client-test` starter puts
>   `spring-boot-grpc-server` on the test classpath. Without this, Spring would try to start its
>   own gRPC server alongside the fake.
> - DataSource and Hibernate auto-configuration are excluded. See Section 7 for why.

---

## 7. Cross-feature coupling

These are things outside the gRPC client that affect whether it can run. Know them before you
refactor either side.

- **JPA blocks the whole app from booting, and it did before this change.**
  `spring-boot-starter-data-jpa` and `postgresql` are on the classpath (`build.gradle:22,29`), but
  `application.yaml` has no `spring.datasource.*`. The existing `CoreServicesApplicationTests.contextLoads`
  **already failed** before any gRPC work, with `Failed to configure a DataSource`. It still fails
  unless Postgres is configured. So today you cannot `bootRun` coreServices to exercise the client
  by hand until a datasource is configured. The gRPC test works around this (Section 6).
- **`docker-compose.yaml` is invalid right now.** The Postgres environment uses
  `${POSTGRES_USER:user-translation-ai}`. Compose requires `${VAR:-default}`, so
  `docker compose config` fails with `invalid interpolation format`. This blocks the
  `ai-translation` service from starting through Compose as well, because Compose rejects the
  whole file.
- **coreServices is not in `docker-compose.yaml`.** When it is added, set
  `AI_TRANSLATION_GRPC_HOST=ai-translation`, the Compose service name. `localhost` inside the
  coreServices container is not the AI server.
- **The server team owns the contract.** Any rename or renumbering in `translation.proto` breaks
  the client at compile time (good) or at runtime (field numbers). Treat field numbers
  `1–5` / `1–4` as frozen. Only add new fields with new numbers.
- **Spring Security does not affect this client.** The security starter secures *inbound* HTTP.
  Outbound gRPC calls are not filtered. It *will* matter as soon as you add an HTTP endpoint that
  calls the client (Section 8).

---

## 8. Presentational / entry-point layer

**There is none yet.** No controller, scheduled job or listener calls `AiTranslationClient`.
The client is a Spring bean, ready to inject:

```java
@RequiredArgsConstructor
class SomeService {
	private final AiTranslationClient aiTranslationClient;

	TranslationResult run() {
		return aiTranslationClient.translate(
				new TranslateCommand("你好", "zh", "id", List.of("calm"), List.of("formal")));
	}
}
```

Before you add a `POST /translations` controller, make two decisions:

1. **Security.** With the current starter defaults, every endpoint requires HTTP Basic auth with
   a generated password, and CSRF protection rejects a `POST` from `curl` with `403`. You need a
   `SecurityFilterChain` that deliberately decides who can trigger GPU inference.
2. **Error mapping.** Map `AiTranslationException` to HTTP, for example `UNAVAILABLE` to `503`,
   `DEADLINE_EXCEEDED` to `504` and `INTERNAL` to `502`, with a `@RestControllerAdvice`.

Not part of this flow: `CoreServicesApplicationTests` is the Initializr default context test and
does not touch translation.

---

## 9. Data flow summary

### Setup (application start)

```
CoreServicesApplication
  └─ component scan → TranslationGrpcClientConfig
        └─ @ImportGrpcClients(target="ai-translation")
              └─ GrpcChannelFactory reads spring.grpc.client.channel.ai-translation
                    └─ ManagedChannel (plaintext, static://host:port, deadline interceptor)
                          └─ TranslationServiceBlockingStub bean
                                └─ injected into AiTranslationClient
```

The channel connects lazily: no TCP connection opens until the first call. The app therefore
starts fine even when the AI server is down, and the first `translate` gets `UNAVAILABLE`.

### Happy path

```
caller → AiTranslationClient.translate(TranslateCommand)
       → TranslateRequest (protobuf)
       → HTTP/2 POST /translation.v1.TranslationService/Translate  (deadline 120s)
       → [Python] TranslationServicer.Translate → codes→names → get_translator().translate(...)
       ← TranslateResponse{translated_text, source_language, target_language, model}
       ← TranslationResult
```

### Error paths

```
server down / wrong port        → StatusRuntimeException(UNAVAILABLE)       → AiTranslationException(UNAVAILABLE)
model load + inference > 120s   → StatusRuntimeException(DEADLINE_EXCEEDED) → AiTranslationException(DEADLINE_EXCEEDED)
Python raises anything          → StatusRuntimeException(INTERNAL, str(exc)) → AiTranslationException(INTERNAL)
unknown language code           → no error; model prompted with "Unknown"   → TranslationResult (success)
```

---

## 10. Reference

### RPC surface

| Method  | Full name                                     | Purpose                     | Used by coreServices |
| ------- | --------------------------------------------- | --------------------------- | -------------------- |
| Unary   | `/translation.v1.TranslationService/Translate` | Translate one piece of text | Yes, via `AiTranslationClient.translate` |

This is the only RPC the server exposes (`translation.proto:9-11`). The server does not register
gRPC health checking or server reflection, so `grpcurl list` will not work without passing the
`.proto` explicitly:

```bash
grpcurl -plaintext -import-path apps/ai-translation/proto -proto translation/v1/translation.proto \
  -d '{"text":"你好","source_language":"zh","target_language":"id"}' \
  localhost:50051 translation.v1.TranslationService/Translate
```

### Message fields

| `TranslateRequest` field | # | `TranslateCommand` | | `TranslateResponse` field | # | `TranslationResult` |
| ------------------------ | - | ------------------ | - | ------------------------- | - | ------------------- |
| `text`                   | 1 | `text`             | | `translated_text`         | 1 | `translatedText`    |
| `source_language`        | 2 | `sourceLanguage`   | | `source_language`         | 2 | `sourceLanguage`    |
| `target_language`        | 3 | `targetLanguage`   | | `target_language`         | 3 | `targetLanguage`    |
| `emotion_tags` (repeated) | 4 | `emotionTags`     | | `model`                   | 4 | `model`             |
| `voice_tags` (repeated)  | 5 | `voiceTags`        | | | | |

### Files touched by this implementation

| File                                                                | Change                                  |
| ------------------------------------------------------------------- | --------------------------------------- |
| `apps/ai-translation/proto/translation/v1/translation.proto`        | Added 3 `java_*` options                |
| `apps/coreServices/build.gradle`                                    | Added `sourceSets.proto` and `protobuf {}` |
| `apps/coreServices/src/main/resources/application.yaml`             | Added the `ai-translation` channel      |
| `apps/coreServices/src/main/java/com/sdewa/coreServices/translation/*` | New: config, client, command, result, exception |
| `apps/coreServices/src/test/java/com/sdewa/coreServices/translation/AiTranslationClientTest.java` | New |
