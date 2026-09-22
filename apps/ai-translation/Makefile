.DEFAULT_GOAL := help

VENV := .venv
PYTHON := $(VENV)/bin/python

.PHONY: help
help: ## Show this help message
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Create the virtual environment and install dependencies (uv)
	uv sync

.PHONY: activate
activate: ## Print how to activate the virtual environment (must be sourced, not run)
	@echo "Run this in your shell (Makefiles cannot activate a venv for you):"
	@echo "  source $(VENV)/bin/activate"

.PHONY: deactivate
deactivate: ## Print how to deactivate the virtual environment (must be sourced, not run)
	@echo "Run this in your shell (Makefiles cannot deactivate a venv for you):"
	@echo "  deactivate"

.PHONY: run
run: ## Run the application
	uv run ai-translation

.PHONY: test
test: ## Run the test suite
	uv run pytest

.PHONY: lint
lint: ## Lint the codebase
	uv run ruff check .

.PHONY: format
format: ## Format the codebase
	uv run ruff format .

.PHONY: clean
clean: ## Remove caches and build artifacts
	rm -rf .pytest_cache .ruff_cache dist build **/__pycache__

.PHONY: clean-venv
clean-venv: ## Remove the virtual environment entirely
	rm -rf $(VENV)



PROTO_DIR := ./proto
PROTO_FILE := $(PROTO_DIR)/translation/v1/translation.proto
GRPC_OUT := ./src/ai_translation/infrastructure/grpc

.PHONY: gen-proto
gen-proto: ## Generate gRPC code from proto files
	$(PYTHON) -m grpc_tools.protoc \
		-I$(PROTO_DIR) \
		--python_out=$(GRPC_OUT) \
		--grpc_python_out=$(GRPC_OUT) \
		$(PROTO_FILE)
	touch $(GRPC_OUT)/translation/__init__.py $(GRPC_OUT)/translation/v1/__init__.py
	sed -i '' 's/from translation.v1 import/from . import/' $(GRPC_OUT)/translation/v1/translation_pb2_grpc.py

.PHONY: clean-proto
clean-proto: ## Remove generated gRPC code
	rm -rf $(GRPC_OUT)/translation


.PHONY: serve
serve: ## Run the gRPC server
	uv run ai-translation-serve