variable "domain" {
  description = "Primary domain name (e.g. daddybearplumbing.com)"
  type        = string
}

variable "bucket_name" {
  description = "S3 bucket name for the website content"
  type        = string
}

variable "project" {
  description = "Short project name used for naming resources (e.g. daddybear)"
  type        = string
}

variable "region" {
  description = <<-EOT
    AWS region for S3 and most resources. Required — no default, so each
    deployment must declare it explicitly in its terraform.tfvars.<env> file.
    (kvaking uses eu-central-1; daddybear uses us-east-1 — same region as
    its CloudFront ACM cert, keeping the entire stack in one region.)
  EOT
  type        = string
}

variable "contact_email" {
  description = "Email address that receives contact form submissions"
  type        = string
  default     = ""
}

variable "turnstile_secret" {
  description = "Cloudflare Turnstile secret key (server-side)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_repo_url" {
  description = "HTTPS URL of the GitHub repo backing the CodeBuild source (e.g. https://github.com/owner/repo)"
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "Branch CodeBuild rebuilds from"
  type        = string
  default     = "master"
}

variable "google_site_verification" {
  description = <<-EOT
    Google Workspace domain verification token (the `google-site-verification=...`
    string from the Google Workspace setup wizard). Lives on the apex TXT record
    alongside SPF. Leave empty for envs that don't use Google Workspace.
  EOT
  type        = string
  default     = ""
}

variable "publish_dns" {
  description = <<-EOT
    When true, the domain's A/AAAA records are created and point at CloudFront.
    Set to false to build the whole stack (buckets, cert, distribution, Cognito, etc.)
    without exposing the domain publicly — useful while migrating content on a new
    deployment. Preview at the CloudFront default hostname; flip to true to go live.

    Kept `true` by default so existing deployments (e.g. kvaking.com) keep serving DNS
    on every apply without needing an explicit override.
  EOT
  type        = bool
  default     = true
}

variable "reserve_lambda_concurrency" {
  description = <<-EOT
    Whether to set per-function reserved concurrent executions on the app's
    Lambdas. Set to false on fresh AWS accounts whose regional Lambda
    "Concurrent executions" quota (L-B99A9384) is only 10 — reserving any
    positive number on any function would drop unreserved below AWS's
    10-minimum and Lambda refuses the update.

    When true (default, matches accounts with the standard 1000-slot quota):
      contact_form   = 10  (spam-surge protection)
      rebuild_trigger= 2   (limit concurrent rebuild kicks)
      rebuild_status = 5   (limit concurrent status polls)
    When false, all three functions run with no reservation (from the
    account's unreserved pool).

    Flip back to true after the account's Lambda quota has been raised via
    a service-quotas ticket.
  EOT
  type        = bool
  default     = true
}

variable "cloudfront_enabled" {
  description = <<-EOT
    Controls the CloudFront distribution's `enabled` flag. When false, the distribution
    exists (all dependent resources — S3 policies, Route 53 aliases, CodeBuild output,
    Lambda env vars — stay valid) but returns HTTP 403 to every request. Combined with
    `publish_dns = false`, this makes the site doubly invisible during a fresh deployment:
    DNS doesn't resolve to it, and the CloudFront default hostname is also locked shut.

    Flip to true (via `terraform apply -var="cloudfront_enabled=true"`) when the content
    is migrated and you're ready to open the site. CloudFront takes ~5 minutes to
    propagate the state change globally.

    Default `true` so existing deployments keep serving traffic.
  EOT
  type        = bool
  default     = true
}
