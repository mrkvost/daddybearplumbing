# Terraform S3 backend config for the kvaking.com deployment.
# Loaded via `terraform init -backend-config=backends/kvaking.hcl -reconfigure`.
# The bucket + lock table live in the kvaking AWS account in eu-central-1.
bucket         = "kvaking-terraform-state"
key            = "kvaking/terraform.tfstate"
dynamodb_table = "kvaking-terraform-locks"
region         = "eu-central-1"
