output "cloudfront_domain" {
  value = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "s3_bucket_name" {
  value = aws_s3_bucket.site.bucket
}

output "site_url" {
  value = "https://${var.domain}"
}
