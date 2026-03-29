"""
Regenerates gallery.json whenever an image is uploaded to or deleted from
the gallery-photos/ prefix in S3. Triggered by S3 event notifications.
"""
import json
import os
import boto3

s3 = boto3.client("s3")
BUCKET = os.environ["BUCKET_NAME"]
PREFIX = os.environ["PREFIX"]
MANIFEST_KEY = f"{PREFIX}gallery.json"
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


def handler(event, context):
    # List all image files in the gallery prefix
    filenames = []
    paginator = s3.get_paginator("list_objects_v2")

    for page in paginator.paginate(Bucket=BUCKET, Prefix=PREFIX):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            name = key[len(PREFIX):]  # strip prefix
            if name and any(name.lower().endswith(ext) for ext in IMAGE_EXTENSIONS):
                filenames.append(name)

    filenames.sort()

    # Write the manifest
    s3.put_object(
        Bucket=BUCKET,
        Key=MANIFEST_KEY,
        Body=json.dumps(filenames),
        ContentType="application/json",
    )

    print(f"Updated {MANIFEST_KEY} with {len(filenames)} images")
    return {"statusCode": 200, "body": f"{len(filenames)} images indexed"}
