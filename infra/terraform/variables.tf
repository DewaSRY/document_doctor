variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-southeast-1"
}

variable "instance_type" {
  description = "EC2 instance type. The service loads NLLB-200 distilled 600M on CPU in float32 alongside LibreOffice and Postgres; 16 GB is the conservative default for inference headroom."
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

variable "api_domain" {
  description = "DNS-only hostname for the HTTPS AI API, pointed at the EC2 Elastic IP (for example api.example.com)."
  type        = string
}

variable "acme_email" {
  description = "Contact email used by Caddy when obtaining and renewing the TLS certificate."
  type        = string
}

variable "app_port" {
  description = "Port the ai-translation container listens on (REST_PORT). Only reachable from the instance and Caddy over the Docker network."
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
  default     = []
}

variable "app_cidr_blocks" {
  description = "CIDR blocks allowed to reach the public Caddy HTTP and HTTPS listeners"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# --- Caddy: HTTPS reverse proxy in front of ai-translation ---

variable "caddy_image" {
  description = "Caddy image used as the HTTPS reverse proxy"
  type        = string
  default     = "caddy:2.10-alpine"
}

variable "http_port" {
  description = "Public HTTP port for ACME challenges and HTTPS redirects"
  type        = number
  default     = 80
}

variable "https_port" {
  description = "Public HTTPS port for the portal Worker to call the AI API"
  type        = number
  default     = 443
}

# --- App config (mirrors ai_translation.config.Settings / apps/ai-translation/.env.example) ---

variable "hf_token" {
  description = "Hugging Face Hub read token, passed through as HF_TOKEN. Optional for the public NLLB model; avoids download rate limits."
  type        = string
  default     = ""
  sensitive   = true
}

variable "portal_api_token" {
  description = "Shared bearer token required by the AI API and the Cloudflare Worker. Set the same random value as the Worker secret AI_TRANSLATION_API_TOKEN."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[A-Za-z0-9_-]{32,}$", var.portal_api_token))
    error_message = "portal_api_token must be at least 32 URL-safe characters."
  }
}

variable "nllb_model_name" {
  description = "Hugging Face model id, passed through as NLLB_MODEL_NAME"
  type        = string
  default     = "facebook/nllb-200-distilled-600M"
}

variable "model_license_allows_production" {
  description = "Set true only after confirming the selected translation model's license and model card permit this production document-translation use. The current NLLB-200 checkpoint does not."
  type        = bool
  default     = false
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
