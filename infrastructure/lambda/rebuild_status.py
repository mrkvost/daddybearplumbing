"""
Return the status of a CodeBuild run (or the most recent run if no id is given).

Two query patterns:
  GET /?id=<build-arn-or-id>   - status of that specific build
  GET /                        - status of the latest build for the project

Both call BatchGetBuilds; the latter resolves the latest build id via
ListBuildsForProject first.
"""
import json
import os
import boto3

PROJECT_NAME = os.environ["CODEBUILD_PROJECT"]

codebuild = boto3.client("codebuild")


def handler(event, context):
    qs = event.get("queryStringParameters") or {}
    build_id = qs.get("id")

    try:
        if not build_id:
            listing = codebuild.list_builds_for_project(
                projectName=PROJECT_NAME, sortOrder="DESCENDING"
            )
            ids = listing.get("ids", [])
            if not ids:
                return _response(200, json.dumps({"ok": True, "build": None}))
            build_id = ids[0]

        details = codebuild.batch_get_builds(ids=[build_id])
        builds = details.get("builds", [])
        if not builds:
            return _response(404, json.dumps({"ok": False, "error": "Build not found"}))

        return _response(200, json.dumps({"ok": True, "build": _summarize(builds[0])}))
    except Exception as e:
        print(f"status lookup failed: {e}")
        return _response(500, json.dumps({"ok": False, "error": "Failed to read build status"}))


def _summarize(build):
    return {
        "id": build["id"],
        "buildNumber": build.get("buildNumber"),
        "status": build.get("buildStatus"),
        "currentPhase": build.get("currentPhase"),
        "startedAt": _iso(build.get("startTime")),
        "endedAt": _iso(build.get("endTime")),
    }


def _iso(dt):
    return dt.isoformat() if dt else None


def _response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": body,
    }
