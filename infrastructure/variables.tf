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
  description = "AWS region for S3 and most resources"
  type        = string
  default     = "eu-central-1"
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
