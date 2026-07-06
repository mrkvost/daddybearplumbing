#!/bin/bash
set -euo pipefail

# Creates the S3 bucket and DynamoDB table for Terraform remote state.
# Run this once (against the target AWS account's credentials) before the
# first `terraform init` for a given deployment. Safe to re-run — skips
# resources that already exist.
#
# All configuration is read from `backends/<env>.hcl` — the same file
# `terraform init` uses. That's the single source of truth for bucket name,
# lock table name, and region.
#
# Usage:   ./bootstrap.sh <env>
# Example: AWS_PROFILE=kvaking   ./bootstrap.sh kvaking
#          AWS_PROFILE=daddybear ./bootstrap.sh daddybear

if [ $# -ne 1 ]; then
  echo "Usage: $0 <env>"
  echo "Example: AWS_PROFILE=daddybear $0 daddybear"
  echo ""
  echo "Available envs (backends/*.hcl):"
  ls backends/ 2>/dev/null | sed -E 's/\.hcl$//' | sed 's/^/  /'
  exit 1
fi

ENV="$1"
BACKEND_FILE="backends/${ENV}.hcl"

if [ ! -f "$BACKEND_FILE" ]; then
  echo "error: $BACKEND_FILE not found" >&2
  exit 1
fi

# Extract quoted values from the .hcl file. Handles the common form
# `key = "value"` with any amount of whitespace around the =.
hcl_value() {
  awk -F'"' -v key="$1" '$0 ~ "^"key"[[:space:]]*=" { print $2; exit }' "$BACKEND_FILE"
}

STATE_BUCKET=$(hcl_value bucket)
LOCK_TABLE=$(hcl_value dynamodb_table)
REGION=$(hcl_value region)

for var in STATE_BUCKET LOCK_TABLE REGION; do
  if [ -z "${!var}" ]; then
    echo "error: $BACKEND_FILE is missing '${var,,}' — cannot bootstrap." >&2
    exit 1
  fi
done

echo "Env:          $ENV"
echo "Region:       $REGION"
echo "State bucket: $STATE_BUCKET"
echo "Lock table:   $LOCK_TABLE"
echo ""

echo "Creating state bucket: $STATE_BUCKET"
if aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
  echo "  Bucket already exists, skipping."
else
  # us-east-1 must NOT be passed via LocationConstraint (AWS quirk); every
  # other region requires it. Branch accordingly.
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket \
      --bucket "$STATE_BUCKET" \
      --region "$REGION"
  else
    aws s3api create-bucket \
      --bucket "$STATE_BUCKET" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi

  aws s3api put-bucket-versioning \
    --bucket "$STATE_BUCKET" \
    --versioning-configuration Status=Enabled

  aws s3api put-public-access-block \
    --bucket "$STATE_BUCKET" \
    --public-access-block-configuration \
      BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

  echo "  Created with versioning enabled."
fi

echo "Creating lock table: $LOCK_TABLE"
if aws dynamodb describe-table --table-name "$LOCK_TABLE" --region "$REGION" >/dev/null 2>&1; then
  echo "  Table already exists, skipping."
else
  aws dynamodb create-table \
    --table-name "$LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
  echo "  Created."
fi

echo ""
echo "Done! Next:"
echo "  cp terraform.tfvars.example terraform.tfvars.$ENV   # if not already"
echo "  ./tf $ENV init"
echo "  ./tf $ENV plan"
