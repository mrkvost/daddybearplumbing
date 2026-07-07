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
    userPoolId: 'us-east-1_ZVXECpnQu',
    cognitoClientId: '3am5q61j2d7ps25o31irfgc42m',
    identityPoolId: 'us-east-1:afb23c64-710c-49a9-aca2-15ea463064a6',
    bucketName: 'daddybear-site',
    galleryBucket: 'daddybear-site-gallery',
    reviewsBucket: 'daddybear-site-reviews',
  },
  contactFormUrl: 'https://xtatjo566r6lcfz7zcmnhta4x40rvhqi.lambda-url.us-east-1.on.aws/',
  // TODO: register a Turnstile site for daddybearplumbing.com in Cloudflare
  // and paste the site key here (the secret goes in terraform.tfvars.daddybear).
  turnstileSiteKey: '0x4AAAAAADxfNT75ByjK OHr',
  rebuildTriggerUrl: 'https://gmfwmrdjaej7hfnz5e5qkjp42y0sixbm.lambda-url.us-east-1.on.aws/',
  rebuildStatusUrl: 'https://rdp6a7vlw4hotqayrolmbjnhda0bsgcn.lambda-url.us-east-1.on.aws/',
};
