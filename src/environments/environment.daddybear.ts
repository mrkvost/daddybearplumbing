// Environment values for the daddybearplumbing.com deployment.
// Selected at build time via Angular's fileReplacements (see angular.json's
// `daddybear` build configuration) when `./docker_build.sh daddybear` runs.
//
// To refresh these values after a Terraform apply:
//   ./tf daddybear output -json | jq '{
//     userPoolId:      .cognito_user_pool_id.value,
//     cognitoClientId: .cognito_client_id.value,
//     identityPoolId:  .cognito_identity_pool_id.value,
//     contactFormUrl:  .contact_form_url.value,
//     rebuildTriggerUrl: .rebuild_trigger_url.value,
//     rebuildStatusUrl:  .rebuild_status_url.value,
//   }'
export const environment = {
  aws: {
    region: 'us-east-1',
    userPoolId: 'TODO_FROM_TF_OUTPUT_cognito_user_pool_id',
    cognitoClientId: 'TODO_FROM_TF_OUTPUT_cognito_client_id',
    identityPoolId: 'TODO_FROM_TF_OUTPUT_cognito_identity_pool_id',
    bucketName: 'daddybear-site',
    galleryBucket: 'daddybear-site-gallery',
    reviewsBucket: 'daddybear-site-reviews',
  },
  contactFormUrl: 'TODO_FROM_TF_OUTPUT_contact_form_url',
  // TODO: register a Turnstile site for daddybearplumbing.com in Cloudflare
  // and paste the site key here (the secret goes in terraform.tfvars.daddybear).
  turnstileSiteKey: 'TODO_FROM_CLOUDFLARE_TURNSTILE',
  rebuildTriggerUrl: 'TODO_FROM_TF_OUTPUT_rebuild_trigger_url',
  rebuildStatusUrl: 'TODO_FROM_TF_OUTPUT_rebuild_status_url',
};
