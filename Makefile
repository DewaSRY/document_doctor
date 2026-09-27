APP_DIR := apps/ai-translation

TF_DIR := infra/terraform
TF_KEY := $(TF_DIR)/ai-translation-key.pem

tf-init:
	terraform -chdir=$(TF_DIR) init

tf-fmt:
	terraform -chdir=$(TF_DIR) fmt

tf-validate:
	terraform -chdir=$(TF_DIR) validate

tf-plan:
	terraform -chdir=$(TF_DIR) plan

tf-apply:
	terraform -chdir=$(TF_DIR) apply

tf-output:
	terraform -chdir=$(TF_DIR) output

tf-destroy:
	terraform -chdir=$(TF_DIR) destroy

# Re-runs the exact first-boot script (docker compose stack: ai-translation +
# postgres + nginx, see infra/terraform/docker-compose.prod.yaml) against the
# already-running instance over SSH. EC2 only executes user_data
# automatically on an instance's first boot (and main.tf ignores later
# user_data changes), so this is how an existing instance picks up a new
# image, a new nginx setting, a new env var, etc. Idempotent
# (docker compose pull + up -d each time) — safe to re-run.
tf-redeploy:
	$(eval EC2_IP := $(shell terraform -chdir=$(TF_DIR) output -raw public_ip))
	terraform -chdir=$(TF_DIR) output -raw rendered_user_data | ssh -i $(TF_KEY) -o StrictHostKeyChecking=accept-new ec2-user@$(EC2_IP) 'sudo bash -s'

# Builds + pushes the ai-translation linux/amd64 image, then redeploys the
# EC2 instance against it.
deploy:
	$(MAKE) -C $(APP_DIR) docker-push
	$(MAKE) tf-redeploy

.PHONY: tf-init tf-fmt tf-validate tf-plan tf-apply tf-output tf-destroy tf-redeploy deploy
