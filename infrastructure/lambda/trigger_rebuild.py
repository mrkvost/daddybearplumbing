"""
Trigger an admin-initiated CodeBuild run for the static site.

The admin browser calls this Lambda's Function URL with AWS_IAM auth using
the temporary credentials it gets from the Cognito Identity Pool. Auth is
enforced by the Function URL itself (caller must be the cognito_authenticated
role) — this handler only needs to start the build and return the build id.
"""
import json
import os
import boto3

PROJECT_NAME = os.environ["CODEBUILD_PROJECT"]

codebuild = boto3.client("codebuild")


def handler(event, context):
    try:
        result = codebuild.start_build(projectName=PROJECT_NAME)
    except Exception as e:
        print(f"start_build failed: {e}")
        return _response(500, json.dumps({"ok": False, "error": "Failed to start build"}))

    build = result["build"]
    return _response(200, json.dumps({
        "ok": True,
        "buildId": build["id"],
        "buildNumber": build.get("buildNumber"),
        "status": build.get("buildStatus", "IN_PROGRESS"),
        "startedAt": build["startTime"].isoformat() if build.get("startTime") else None,
    }))


def _response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": body,
    }
