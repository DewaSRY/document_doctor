import os
from concurrent import futures

import grpc

from ai_translation.infrastructure.grpc.translation.v1 import translation_pb2_grpc
from ai_translation.infrastructure.grpc.translation.v1.servicer import (
    TranslationServicer,
)


def serve() -> None:
    port = os.environ.get("GRPC_PORT", "50051")

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    translation_pb2_grpc.add_TranslationServiceServicer_to_server(
        TranslationServicer(), server
    )

    server.add_insecure_port(f"[::]:{port}")
    server.start()

    print(f"gRPC server listening on port {port}")
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
