# API Reference

gRPC contract exposed by the `ai-translation` service to the Go backend.

## Protocol

- Transport: gRPC (internal/private network only)
- Consumers: Go backend only — this service must never be called directly by clients.

## Proto Definitions

<!-- TODO: fill in — path to .proto files once defined, e.g. `proto/translation.proto`. -->

## Services & RPCs

<!-- TODO: fill in — list each RPC method, e.g.

### Translate

Request:
```protobuf
message TranslateRequest {
  string text = 1;
  string source_language = 2;
  string target_language = 3;
  // context, relationship, tone fields...
}
```

Response:
```protobuf
message TranslateResponse {
  string translation = 1;
  repeated string alternatives = 2;
  string explanation = 3;
}
```
-->

## Error Handling

<!-- TODO: fill in — gRPC status codes used and their meaning. -->

## Versioning

<!-- TODO: fill in — how the API contract is versioned. -->
