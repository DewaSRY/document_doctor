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

.PHONY: translate
translate: ## Run the translation CLI (test translation)
	uv run ai-translation translate

.PHONY: serve
serve: ## Run the REST API server
	uv run ai-translation server

.PHONY: serve-dev
serve-dev: ## Run the REST API server in development mode (with auto-reload)
	uv run uvicorn ai_translation.bootstrap.server:create_app --host 0.0.0.0 --port 8000 --reload

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
	@echo "Cleaning caches and build artifacts..."
	@echo "if file is not removed, run this codey"
	@echo "  rm -rf .pytest_cache .ruff_cache dist build **/__pycache__"
	rm -rf .pytest_cache .ruff_cache dist build **/__pycache__

.PHONY: clean-venv
clean-venv: ## Remove the virtual environment entirely
	rm -rf $(VENV)


## DOCKER

IMAGE_NAME := sdewa/ai-translation
IMAGE_TAG := latest
CONTAINER_NAME := ai-translation
PORT := 8000
MODEL_CACHE_VOLUME := ai-translation-model-cache

.PHONY: docker-build
docker-build: ## Build the Docker image
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .

.PHONY: docker-run
docker-run: ## Run the Docker image (model cache persisted in a named volume, see docs/MODEL_STORAGE.md)
	docker run --rm --name $(CONTAINER_NAME) -p $(PORT):8000 \
		-v $(MODEL_CACHE_VOLUME):/models/huggingface \
		--env-file .env \
		$(IMAGE_NAME):$(IMAGE_TAG)

.PHONY: docker-stop
docker-stop: ## Stop the running Docker container
	docker stop $(CONTAINER_NAME)

.PHONY: docker-logs
docker-logs: ## Tail logs from the running Docker container
	docker logs -f $(CONTAINER_NAME)

.PHONY: docker-shell
docker-shell: ## Open a shell inside a running/new Docker container
	docker run --rm -it --entrypoint /bin/bash $(IMAGE_NAME):$(IMAGE_TAG)

.PHONY: docker-clean
docker-clean: ## Remove the built Docker image
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG)
