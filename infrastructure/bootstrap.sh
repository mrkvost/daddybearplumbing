#!/bin/bash
set -e

# Creates the S3 bucket and DynamoDB table for Terraform remote state.
# Run this once before the first `terraform init`.
# Safe to run multiple times — skips resources that already exist.
#
# Usage: ./bootstrap.sh <project-name> [region]
# Example: ./bootstrap.sh kvaking eu-central-1
#          ./bootstrap.sh daddybear us-east-1

if [ -z "$1" ]; then
  echo "Usage: ./bootstrap.sh <project-name> [region]"
  echo "Example: ./bootstrap.sh daddybear eu-central-1"
  exit 1
fi

PROJECT="$1"
REGION="${2:-eu-central-1}"
STATE_BUCKET="${PROJECT}-terraform-state"
LOCK_TABLE="${PROJECT}-terraform-locks"

echo "Project:      $PROJECT"
echo "Region:       $REGION"
echo "State bucket: $STATE_BUCKET"
echo "Lock table:   $LOCK_TABLE"
echo ""

echo "Creating state bucket: $STATE_BUCKET"
if aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
  echo "  Bucket already exists, skipping."
else
  aws s3api create-bucket \
    --bucket "$STATE_BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"

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
echo "Done! Update the backend block in main.tf:"
echo "  bucket         = \"$STATE_BUCKET\""
echo "  dynamodb_table = \"$LOCK_TABLE\""
echo "  region         = \"$REGION\""
echo ""
echo "Then run:"
echo "  cd infrastructure"
echo "  terraform init"
echo "  terraform plan"
