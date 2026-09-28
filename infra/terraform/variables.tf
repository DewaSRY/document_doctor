variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-southeast-1"
}

variable "instance_type" {
  description = "EC2 instance type. The service loads Qwen2.5-1.5B-Instruct on CPU in float32 (~6 GB resident) next to LibreOffice and postgres, so 16 GB of RAM is the comfortable minimum; t3.micro/small/medium will be OOM-killed while loading the model."
  type        = string
  default     = "t3.xlarge"
}

variable "root_volume_size" {
  description = "Root EBS volume size in GiB. Holds the docker image (torch + LibreOffice + fonts, ~10 GB), the Hugging Face model cache (~3 GB per model) and the bundled postgres data."
  type        = number
  default     = 60
}

variable "docker_image" {
  description = "Docker Hub image to run on the instance. Must be built for linux/amd64 (see apps/ai-translation Makefile's docker-push)."
  type        = string
  default     = "sdewa/ai-translation:latest"
}

variable "app_port" {
  description = "Port the ai-translation container listens on (REST_PORT). Only reachable from the instance itself (127.0.0.1) and from nginx over the internal docker network — not exposed to the internet directly."
  type        = number
  default     = 8000
}

variable "docker_compose_version" {
  description = "docker compose CLI plugin release to install on the instance at boot (see https://github.com/docker/compose/releases). Set to \"latest\" to resolve GitHub's current release at boot time instead."
  type        = string
  default     = "v5.5.1"
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed to SSH into the instance"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "app_cidr_blocks" {
  description = "CIDR blocks allowed to reach nginx_port, i.e. the public entrypoint that reverse-proxies to ai-translation"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# --- nginx: reverse proxy + rate limiter in front of ai-translation ---

variable "nginx_image" {
  description = "nginx Docker Hub image to run as the reverse proxy in front of ai-translation"
  type        = string
  default     = "nginx:1.27-alpine"
}

variable "nginx_port" {
  description = "Public port nginx listens on and proxies to ai-translation on app_port"
  type        = number
  default     = 80
}

variable "nginx_rate_limit_rps" {
  description = "nginx limit_req rate, in requests/second per client IP. Note the portal calls this service server-side, so all of its users share the portal host's IP(s)."
  type        = number
  default     = 10
}

variable "nginx_rate_limit_burst" {
  description = "nginx limit_req burst size: how many requests over nginx_rate_limit_rps a client can burst before nginx starts responding 429"
  type        = number
  default     = 20
}

variable "nginx_client_max_body_size" {
  description = "nginx client_max_body_size. nginx's default is 1m; the service accepts documents up to 10 MB and PDF merges up to 50 MB in total."
  type        = string
  default     = "60m"
}

variable "nginx_proxy_timeout_seconds" {
  description = "nginx proxy_read_timeout/proxy_send_timeout. Translation runs synchronously on CPU, and the portal waits up to 15 minutes for it (feature/translator/client.ts)."
  type        = number
  default     = 900
}

# --- App config (mirrors ai_translation.config.Settings / apps/ai-translation/.env.example) ---

variable "hf_token" {
  description = "Hugging Face Hub read token, passed through as HF_TOKEN. Optional for the public Qwen models; avoids download rate limits."
  type        = string
  default     = ""
  sensitive   = true
}

variable "qwen_model_name" {
  description = "Hugging Face model id, passed through as QWEN_MODEL_NAME"
  type        = string
  default     = "Qwen/Qwen2.5-1.5B-Instruct"
}

variable "translation_batch_size" {
  description = "Passed through as TRANSLATION_BATCH_SIZE"
  type        = number
  default     = 8
}

variable "app_rate_limit" {
  description = "Passed through as RATE_LIMIT (slowapi, inside the service itself)"
  type        = string
  default     = "100/minute"
}

variable "cors_origins" {
  description = "Comma-separated allowed CORS origins, passed through as CORS_ORIGINS. The portal calls the service server-side, so this only matters for browsers calling it directly."
  type        = string
  default     = ""
}

variable "cors_allow_headers" {
  description = "Comma-separated allowed CORS headers, passed through as CORS_ALLOW_HEADERS"
  type        = string
  default     = "Origin,Content-Type,Authorization,X-Timezone,X-Request-Id"
}

# --- Database ---

variable "db_host" {
  description = "External Postgres host. Leave empty to run postgres as a container on the instance (data in the ai-translation-postgres-data volume)."
  type        = string
  default     = ""
}

variable "db_port" {
  description = "Postgres port"
  type        = number
  default     = 5432
}

variable "db_user" {
  description = "Postgres user"
  type        = string
  default     = "ai_translation"
}

variable "db_name" {
  description = "Postgres database name"
  type        = string
  default     = "ai_translation"
}

variable "db_password" {
  description = "Postgres password. Leave empty to have Terraform generate one (required to be set when db_host points to an external database). Must not contain @ : / or $."
  type        = string
  default     = ""
  sensitive   = true

  validation {
    condition     = can(regex("^[^@:/$]*$", var.db_password))
    error_message = "db_password must not contain @, :, / or $ — it is embedded unescaped in the database URL and env file."
  }
}

variable "postgres_image" {
  description = "Postgres image used when db_host is empty"
  type        = string
  default     = "postgres:16"
}
