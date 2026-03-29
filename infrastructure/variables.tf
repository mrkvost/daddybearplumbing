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
