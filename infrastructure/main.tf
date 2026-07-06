terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Partial backend configuration. `bucket`, `key`, `dynamodb_table`, and
  # `region` are supplied at init time via `-backend-config=backends/<env>.hcl`
  # so a single main.tf can serve multiple deployments (kvaking in eu-central-1,
  # daddybear near Chicago, …), each with its own state bucket in its own AWS
  # account/region.
  backend "s3" {
    encrypt = true
  }
}

provider "aws" {
  region = var.region
}

# ACM certificates for CloudFront must be in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ---------- S3 Bucket ----------

resource "aws_s3_bucket" "site" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id

  policy = jsonencode({
    Version = "2008-10-17"
    Id      = "PolicyForCloudFrontPrivateContent"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.site.arn}/*"
        Condition = {
          ArnLike = {
            "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
          }
        }
      }
    ]
  })
}


# ---------- S3 Bucket: Gallery ----------

resource "aws_s3_bucket" "gallery" {
  bucket = "${var.bucket_name}-gallery"
}

resource "aws_s3_bucket_public_access_block" "gallery" {
  bucket = aws_s3_bucket.gallery.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "gallery" {
  bucket = aws_s3_bucket.gallery.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.gallery.arn}/*"
        Condition = {
          ArnLike = {
            "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_cors_configuration" "gallery" {
  bucket = aws_s3_bucket.gallery.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "DELETE"]
    allowed_origins = ["https://${var.domain}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# ---------- S3 Bucket: Reviews ----------

resource "aws_s3_bucket" "reviews" {
  bucket = "${var.bucket_name}-reviews"
}

resource "aws_s3_bucket_public_access_block" "reviews" {
  bucket = aws_s3_bucket.reviews.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "reviews" {
  bucket = aws_s3_bucket.reviews.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.reviews.arn}/*"
        Condition = {
          ArnLike = {
            "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_cors_configuration" "reviews" {
  bucket = aws_s3_bucket.reviews.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "DELETE"]
    allowed_origins = ["https://${var.domain}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# ---------- CloudFront Origin Access Control ----------

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "oac-${var.project}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ---------- ACM Certificate (us-east-1) ----------

resource "aws_acm_certificate" "site" {
  provider = aws.us_east_1

  domain_name               = var.domain
  subject_alternative_names = ["*.${var.domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# ---------- Route53 Hosted Zone ----------

resource "aws_route53_zone" "site" {
  name    = var.domain
  comment = "HostedZone created by Route53 Registrar, managed by Terraform"
}

# ACM DNS validation record
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.site.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
    if dvo.domain_name == var.domain
  }

  zone_id = aws_route53_zone.site.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "site" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# ---------- CloudFront Cache Policies ----------

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# ---------- CloudFront Function: pretty URLs → index.html ----------
# S3 with OAC has no directory-index resolution, so we rewrite incoming URIs:
#   /admin/login          -> /admin/login/index.html
#   /admin/               -> /admin/index.html
#   /styles-abc.css       (left alone — already a file)
# This is what makes the prerendered /admin/index.html and /admin/login/index.html
# actually get served, instead of falling back to the public home shell.

resource "aws_cloudfront_function" "spa_router" {
  name    = "${var.project}-spa-router"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      var lastSegment = uri.split('/').pop();
      if (lastSegment && lastSegment.indexOf('.') !== -1) {
        return request;
      }
      request.uri = uri.charAt(uri.length - 1) === '/' ? uri + 'index.html' : uri + '/index.html';
      return request;
    }
  EOT
}

# ---------- CloudFront Distribution ----------

resource "aws_cloudfront_distribution" "site" {
  enabled             = var.cloudfront_enabled
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [var.domain]
  price_class         = "PriceClass_All"
  http_version        = "http2"

  # WAF is auto-managed by CloudFront's security bundle
  lifecycle {
    ignore_changes = [web_acl_id]
  }

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-${var.project}"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  origin {
    domain_name              = aws_s3_bucket.gallery.bucket_regional_domain_name
    origin_id                = "s3-${var.project}-gallery"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  origin {
    domain_name              = aws_s3_bucket.reviews.bucket_regional_domain_name
    origin_id                = "s3-${var.project}-reviews"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-${var.project}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
    }
  }

  # Gallery JSON manifests (gallery.json, meta.json): no cache so changes are instant
  ordered_cache_behavior {
    path_pattern           = "/gallery-images/*.json"
    target_origin_id       = "s3-${var.project}-gallery"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_disabled.id
  }

  # Reviews manifest: no cache so changes are instant
  ordered_cache_behavior {
    path_pattern           = "/reviews-data/reviews.json"
    target_origin_id       = "s3-${var.project}-reviews"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_disabled.id
  }

  # Gallery images: cached normally (images don't change)
  ordered_cache_behavior {
    path_pattern           = "/gallery-images/*"
    target_origin_id       = "s3-${var.project}-gallery"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  # Reviews data: cached normally
  ordered_cache_behavior {
    path_pattern           = "/reviews-data/*"
    target_origin_id       = "s3-${var.project}-reviews"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  # SPA routing — serve index.html for 403/404
  custom_error_response {
    error_code            = 403
    response_page_path    = "/index.html"
    response_code         = 200
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_page_path    = "/index.html"
    response_code         = 200
    error_caching_min_ttl = 0
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.site.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

# ---------- Route53 DNS Records ----------
# Gated by `var.publish_dns` (default true). Set to false during initial setup
# of a new deployment so the domain doesn't resolve while content is being
# migrated — the whole stack still builds and is testable via the CloudFront
# default hostname (`d1a2b3c4.cloudfront.net`).

resource "aws_route53_record" "a" {
  count   = var.publish_dns ? 1 : 0
  zone_id = aws_route53_zone.site.zone_id
  name    = var.domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "aaaa" {
  count   = var.publish_dns ? 1 : 0
  zone_id = aws_route53_zone.site.zone_id
  name    = var.domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# State migration for the existing kvaking deployment: adding `count` above
# changes the resource address from `aws_route53_record.a` to
# `aws_route53_record.a[0]`. Without these `moved` blocks Terraform would try
# to destroy + recreate the records on the next apply — causing brief DNS
# downtime on the live site. `moved` migrates state addresses in place.
moved {
  from = aws_route53_record.a
  to   = aws_route53_record.a[0]
}
moved {
  from = aws_route53_record.aaaa
  to   = aws_route53_record.aaaa[0]
}

# ---------- Cognito User Pool (Admin Authentication) ----------

resource "aws_cognito_user_pool" "admin" {
  name = "${var.project}-admin-pool"

  # No self-signup — admin creates users manually
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "admin_only"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_client" "admin" {
  name         = "${var.project}-admin-client"
  user_pool_id = aws_cognito_user_pool.admin.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  # No client secret — required for browser-based auth
  generate_secret = false
}

# ---------- Cognito Identity Pool (S3 Credentials) ----------

resource "aws_cognito_identity_pool" "admin" {
  identity_pool_name               = "${var.project}-admin-identity"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.admin.id
    provider_name           = aws_cognito_user_pool.admin.endpoint
    server_side_token_check = false
  }
}

# IAM role for authenticated Cognito users — scoped to gallery-photos/ in S3
resource "aws_iam_role" "cognito_authenticated" {
  name = "${var.project}-cognito-authenticated"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.admin.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "cognito_s3_admin" {
  name = "${var.project}-s3-admin"
  role = aws_iam_role.cognito_authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObject",
        ]
        Resource = [
          "${aws_s3_bucket.gallery.arn}/gallery-images/*",
          "${aws_s3_bucket.reviews.arn}/reviews-data/*",
        ]
      },
      {
        # Admin SPA reads the daily metrics snapshot (written by the
        # metrics-snapshot Lambda). Read-only; never written from the browser.
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.gallery.arn}/metrics/*"
      },
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = [
          aws_s3_bucket.gallery.arn,
          aws_s3_bucket.reviews.arn,
        ]
      }
    ]
  })
}

resource "aws_cognito_identity_pool_roles_attachment" "admin" {
  identity_pool_id = aws_cognito_identity_pool.admin.id

  roles = {
    authenticated = aws_iam_role.cognito_authenticated.arn
  }
}

# ---------- SES: Email for Contact Form ----------

resource "aws_ses_domain_identity" "site" {
  domain = var.domain
}

resource "aws_ses_domain_dkim" "site" {
  domain = aws_ses_domain_identity.site.domain
}

# DNS records for SES domain verification
resource "aws_route53_record" "ses_verification" {
  zone_id = aws_route53_zone.site.zone_id
  name    = "_amazonses.${var.domain}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.site.verification_token]
}

resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = aws_route53_zone.site.zone_id
  name    = "${aws_ses_domain_dkim.site.dkim_tokens[count.index]}._domainkey.${var.domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.site.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# ---------- Lambda: Contact Form Handler ----------

data "archive_file" "contact_form" {
  type        = "zip"
  source_file = "${path.module}/lambda/contact_form.py"
  output_path = "${path.module}/lambda/contact_form.zip"
}

resource "aws_iam_role" "contact_lambda" {
  name = "${var.project}-contact-form-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "contact_lambda_ses" {
  name = "${var.project}-contact-lambda-ses"
  role = aws_iam_role.contact_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "ses:SendEmail"
      Resource = "*"
      Condition = {
        StringEquals = {
          "ses:FromAddress" = "contact@${var.domain}"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "contact_lambda_logs" {
  role       = aws_iam_role.contact_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "contact_form" {
  function_name                  = "${var.project}-contact-form"
  role                           = aws_iam_role.contact_lambda.arn
  handler                        = "contact_form.handler"
  runtime                        = "python3.13"
  timeout                        = 10
  reserved_concurrent_executions = var.reserve_lambda_concurrency ? 10 : -1
  filename         = data.archive_file.contact_form.output_path
  source_code_hash = data.archive_file.contact_form.output_base64sha256

  environment {
    variables = {
      TURNSTILE_SECRET = var.turnstile_secret
      TO_EMAIL         = var.contact_email
      FROM_EMAIL       = "contact@${var.domain}"
      SES_REGION       = var.region
    }
  }
}

resource "aws_lambda_function_url" "contact_form" {
  function_name      = aws_lambda_function.contact_form.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["https://${var.domain}"]
    allow_methods = ["POST"]
    allow_headers = ["content-type"]
    max_age       = 3600
  }
}

resource "aws_lambda_permission" "contact_form_url" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.contact_form.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "contact_form_invoke" {
  statement_id  = "FunctionURLAllowPublicInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.contact_form.function_name
  principal     = "*"
}

# ---------- CodeBuild: admin-triggered site rebuilds ----------

# GitHub source connection. Terraform creates this in PENDING state.
# After `terraform apply`, open the connection in the AWS Console
# (CodePipeline → Settings → Connections) and click "Update pending connection"
# to complete the GitHub OAuth handshake — the status flips to AVAILABLE.
resource "aws_codestarconnections_connection" "github" {
  name          = "${var.project}-github"
  provider_type = "GitHub"
}

resource "aws_iam_role" "codebuild" {
  name = "${var.project}-codebuild"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "codebuild.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "codebuild" {
  name = "${var.project}-codebuild-policy"
  role = aws_iam_role.codebuild.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:${var.region}:*:log-group:/aws/codebuild/${var.project}-site*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.site.arn,
          "${aws_s3_bucket.site.arn}/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = "cloudfront:CreateInvalidation"
        Resource = aws_cloudfront_distribution.site.arn
      },
      {
        Effect   = "Allow"
        Action   = "codestar-connections:UseConnection"
        Resource = aws_codestarconnections_connection.github.arn
      },
    ]
  })
}

resource "aws_codebuild_project" "site" {
  name         = "${var.project}-site"
  service_role = aws_iam_role.codebuild.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type = "BUILD_GENERAL1_SMALL"
    type         = "LINUX_CONTAINER"
    image        = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"

    environment_variable {
      name  = "BUCKET_NAME"
      value = aws_s3_bucket.site.bucket
    }

    environment_variable {
      name  = "CLOUDFRONT_DIST_ID"
      value = aws_cloudfront_distribution.site.id
    }
  }

  source {
    type            = "GITHUB"
    location        = var.github_repo_url
    git_clone_depth = 1
    buildspec       = "infrastructure/buildspec.yml"
  }

  source_version = var.github_branch

  logs_config {
    cloudwatch_logs {
      group_name = "/aws/codebuild/${var.project}-site"
    }
  }

  build_timeout = 20 # minutes
}

# ---------- Lambdas: admin-triggered rebuild (trigger + status) ----------

data "archive_file" "rebuild_trigger" {
  type        = "zip"
  source_file = "${path.module}/lambda/trigger_rebuild.py"
  output_path = "${path.module}/lambda/trigger_rebuild.zip"
}

data "archive_file" "rebuild_status" {
  type        = "zip"
  source_file = "${path.module}/lambda/rebuild_status.py"
  output_path = "${path.module}/lambda/rebuild_status.zip"
}

resource "aws_iam_role" "rebuild_lambda" {
  name = "${var.project}-rebuild-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "rebuild_lambda" {
  name = "${var.project}-rebuild-lambda-policy"
  role = aws_iam_role.rebuild_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "codebuild:StartBuild",
          "codebuild:BatchGetBuilds",
          "codebuild:ListBuildsForProject",
        ]
        Resource = aws_codebuild_project.site.arn
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rebuild_lambda_logs" {
  role       = aws_iam_role.rebuild_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "rebuild_trigger" {
  function_name                  = "${var.project}-rebuild-trigger"
  role                           = aws_iam_role.rebuild_lambda.arn
  handler                        = "trigger_rebuild.handler"
  runtime                        = "python3.13"
  timeout                        = 10
  reserved_concurrent_executions = var.reserve_lambda_concurrency ? 2 : -1
  filename                       = data.archive_file.rebuild_trigger.output_path
  source_code_hash               = data.archive_file.rebuild_trigger.output_base64sha256

  environment {
    variables = {
      CODEBUILD_PROJECT = aws_codebuild_project.site.name
    }
  }
}

resource "aws_lambda_function" "rebuild_status" {
  function_name                  = "${var.project}-rebuild-status"
  role                           = aws_iam_role.rebuild_lambda.arn
  handler                        = "rebuild_status.handler"
  runtime                        = "python3.13"
  timeout                        = 10
  reserved_concurrent_executions = var.reserve_lambda_concurrency ? 5 : -1
  filename                       = data.archive_file.rebuild_status.output_path
  source_code_hash               = data.archive_file.rebuild_status.output_base64sha256

  environment {
    variables = {
      CODEBUILD_PROJECT = aws_codebuild_project.site.name
    }
  }
}

resource "aws_lambda_function_url" "rebuild_trigger" {
  function_name      = aws_lambda_function.rebuild_trigger.function_name
  authorization_type = "AWS_IAM"

  cors {
    allow_origins = ["https://${var.domain}"]
    allow_methods = ["POST"]
    allow_headers = ["content-type", "authorization", "x-amz-date", "x-amz-security-token", "x-amz-content-sha256"]
    max_age       = 3600
  }
}

resource "aws_lambda_function_url" "rebuild_status" {
  function_name      = aws_lambda_function.rebuild_status.function_name
  authorization_type = "AWS_IAM"

  cors {
    allow_origins = ["https://${var.domain}"]
    allow_methods = ["GET"]
    allow_headers = ["content-type", "authorization", "x-amz-date", "x-amz-security-token", "x-amz-content-sha256"]
    max_age       = 3600
  }
}

# Resource-based permission complementing the IAM identity policy.
# `function_url_auth_type` is intentionally omitted: setting it adds a
# `lambda:FunctionUrlAuthType` Condition that AWS appears not to populate
# for these calls, which caused 403/AccessDenied on every invocation.
resource "aws_lambda_permission" "rebuild_trigger_iam_invoke" {
  statement_id  = "FunctionURLAllowCognitoIAMInvoke"
  action        = "lambda:InvokeFunctionUrl"
  function_name = aws_lambda_function.rebuild_trigger.function_name
  principal     = aws_iam_role.cognito_authenticated.arn
}

resource "aws_lambda_permission" "rebuild_status_iam_invoke" {
  statement_id  = "FunctionURLAllowCognitoIAMInvoke"
  action        = "lambda:InvokeFunctionUrl"
  function_name = aws_lambda_function.rebuild_status.function_name
  principal     = aws_iam_role.cognito_authenticated.arn
}

# Allow the authenticated Cognito role to invoke these Function URLs.
# Function URLs created after Oct 2025 require BOTH lambda:InvokeFunctionUrl
# and lambda:InvokeFunction; the InvokedViaFunctionUrl condition restricts
# the broader InvokeFunction action to only Function URL calls.
resource "aws_iam_role_policy" "cognito_invoke_rebuild" {
  name = "${var.project}-cognito-invoke-rebuild"
  role = aws_iam_role.cognito_authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunctionUrl"
        Resource = [
          aws_lambda_function.rebuild_trigger.arn,
          aws_lambda_function.rebuild_status.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = [
          aws_lambda_function.rebuild_trigger.arn,
          aws_lambda_function.rebuild_status.arn,
        ]
        Condition = {
          Bool = {
            "lambda:InvokedViaFunctionUrl" = "true"
          }
        }
      },
    ]
  })
}


# ---------- Lambda: Daily Metrics Snapshot ----------
# Runs once per day (04:00 America/Chicago) via EventBridge Scheduler. Reads
# CloudWatch / SES / Cognito / Cost Explorer and writes
# metrics/dashboard.json to the gallery bucket. Admin SPA fetches that file
# via Cognito temp credentials (read-only — see cognito_s3_admin policy).

data "archive_file" "metrics_snapshot" {
  type        = "zip"
  source_file = "${path.module}/lambda/metrics_snapshot.py"
  output_path = "${path.module}/lambda/metrics_snapshot.zip"
}

resource "aws_iam_role" "metrics_snapshot_lambda" {
  name = "${var.project}-metrics-snapshot-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "metrics_snapshot_logs" {
  role       = aws_iam_role.metrics_snapshot_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "metrics_snapshot_perms" {
  name = "${var.project}-metrics-snapshot"
  role = aws_iam_role.metrics_snapshot_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # CloudWatch GetMetricData/Statistics doesn't support resource-level scoping.
        Effect   = "Allow"
        Action   = ["cloudwatch:GetMetricStatistics", "cloudwatch:GetMetricData"]
        Resource = "*"
      },
      {
        # Cost Explorer is account-scoped; no resource-level permissions.
        Effect   = "Allow"
        Action   = ["ce:GetCostAndUsage", "ce:GetCostForecast"]
        Resource = "*"
      },
      {
        # CodeBuild rebuild history feeds the rebuilds-per-day chart.
        Effect   = "Allow"
        Action   = ["codebuild:ListBuildsForProject", "codebuild:BatchGetBuilds"]
        Resource = aws_codebuild_project.site.arn
      },
      {
        Effect   = "Allow"
        Action   = ["ses:GetSendStatistics"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["cognito-idp:ListUsers"]
        Resource = aws_cognito_user_pool.admin.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.gallery.arn}/metrics/*"
      },
    ]
  })
}

resource "aws_lambda_function" "metrics_snapshot" {
  function_name    = "${var.project}-metrics-snapshot"
  role             = aws_iam_role.metrics_snapshot_lambda.arn
  handler          = "metrics_snapshot.handler"
  runtime          = "python3.13"
  timeout          = 60
  memory_size      = 256
  filename         = data.archive_file.metrics_snapshot.output_path
  source_code_hash = data.archive_file.metrics_snapshot.output_base64sha256

  environment {
    variables = {
      GALLERY_BUCKET    = aws_s3_bucket.gallery.id
      DISTRIBUTION_ID   = aws_cloudfront_distribution.site.id
      CONTACT_FN        = aws_lambda_function.contact_form.function_name
      USER_POOL_ID      = aws_cognito_user_pool.admin.id
      COGNITO_REGION    = var.region
      SES_REGION        = var.region
      CODEBUILD_PROJECT = aws_codebuild_project.site.name
    }
  }
}

# EventBridge Scheduler invokes the Lambda once per day. America/Chicago so DST is handled.
resource "aws_iam_role" "metrics_scheduler" {
  name = "${var.project}-metrics-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "metrics_scheduler_invoke" {
  name = "${var.project}-metrics-scheduler-invoke"
  role = aws_iam_role.metrics_scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.metrics_snapshot.arn
    }]
  })
}

resource "aws_scheduler_schedule" "metrics_snapshot_daily" {
  name        = "${var.project}-metrics-snapshot-daily"
  group_name  = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = "cron(0 4 * * ? *)"
  schedule_expression_timezone = "America/Chicago"

  target {
    arn      = aws_lambda_function.metrics_snapshot.arn
    role_arn = aws_iam_role.metrics_scheduler.arn
  }
}
