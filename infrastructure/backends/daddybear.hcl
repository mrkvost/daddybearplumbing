# Terraform S3 backend config for the daddybearplumbing.com deployment.
# Loaded via `terraform init -backend-config=backends/daddybear.hcl -reconfigure`.
# The bucket + lock table live in the daddybear AWS account in us-east-1
# (N. Virginia). Chosen so the whole stack — S3, Lambda, Cognito, CodeBuild,
# and the CloudFront ACM cert (which is *required* to be in us-east-1) —
# all live in the same region. Create bucket + lock table once via
# `AWS_PROFILE=daddybear ./bootstrap.sh daddybear` before init (region is
# read from this file).
#
# The state file is stored under the workspace named `daddybear` (workspace
# name == env name is the project-wide convention). Actual S3 key:
#     env:/daddybear/daddybear/terraform.tfstate
# The `./tf daddybear init` wrapper selects/creates that workspace automatically.
bucket         = "daddybear-terraform-state"
key            = "daddybear/terraform.tfstate"
dynamodb_table = "daddybear-terraform-locks"
region         = "us-east-1"
