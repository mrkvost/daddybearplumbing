# Terraform S3 backend config for the kvaking.com deployment.
# Loaded via `terraform init -backend-config=backends/kvaking.hcl -reconfigure`.
# The bucket + lock table live in the kvaking AWS account in eu-central-1.
#
# The state file is stored under the workspace named `kvaking` (workspace name
# == env name is the project-wide convention). Actual S3 key:
#     env:/kvaking/kvaking/terraform.tfstate
# The `./tf kvaking init` wrapper selects that workspace automatically.
bucket         = "kvaking-terraform-state"
key            = "kvaking/terraform.tfstate"
dynamodb_table = "kvaking-terraform-locks"
region         = "eu-central-1"
