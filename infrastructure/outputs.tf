output "cloudfront_domain" {
  value = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "s3_bucket_name" {
  value = aws_s3_bucket.site.bucket
}

output "gallery_bucket_name" {
  value = aws_s3_bucket.gallery.bucket
}

output "reviews_bucket_name" {
  value = aws_s3_bucket.reviews.bucket
}

output "site_url" {
  value = "https://${var.domain}"
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.admin.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.admin.id
}

output "cognito_identity_pool_id" {
  value = aws_cognito_identity_pool.admin.id
}

output "contact_form_url" {
  value = aws_lambda_function_url.contact_form.function_url
}
