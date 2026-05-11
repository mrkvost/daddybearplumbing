export const environment = {
  aws: {
    region: 'eu-central-1',
    userPoolId: 'eu-central-1_84q7fOb5W',
    cognitoClientId: '3q588ms0j715sb3fda0k23a5eh',
    identityPoolId: 'eu-central-1:ca32fe95-307c-4649-8395-64e3ee72e8ca',
    bucketName: 'kvaking',
    galleryBucket: 'kvaking-gallery',
    reviewsBucket: 'kvaking-reviews',
  },
  contactFormUrl: 'https://btoqsuf4ifih4srhhrn5sue6oi0jjkyl.lambda-url.eu-central-1.on.aws/',
  turnstileSiteKey: '0x4AAAAAACynucEthcRJVGmV',
  // Filled in from terraform output after the rebuild stack is applied.
  rebuildTriggerUrl: 'https://ewuayj4hffmsrk56lefwclrxqy0mpecj.lambda-url.eu-central-1.on.aws/',
  rebuildStatusUrl: 'https://imu3xv6mmktjghjpw6kqrfbyt40joebv.lambda-url.eu-central-1.on.aws/',
};
