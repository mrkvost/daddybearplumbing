"""
Daily metrics snapshot Lambda.

Runs once a day via EventBridge Scheduler (04:00 America/Chicago).
Reads CloudWatch, SES, Cognito, and Cost Explorer; writes the result as
metrics/dashboard.json to the gallery bucket where the admin SPA can fetch it.

Schema is documented in docs/ADMIN_DASHBOARD_METRICS_PLAN.md.
"""
import json
import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import boto3

SCHEMA_VERSION = 4
RANGE_DAYS = 30
SERIES_30D_DAYS = 30
CHICAGO = ZoneInfo("America/Chicago")

GALLERY_BUCKET = os.environ["GALLERY_BUCKET"]
DISTRIBUTION_ID = os.environ["DISTRIBUTION_ID"]
CONTACT_FN = os.environ["CONTACT_FN"]
USER_POOL_ID = os.environ["USER_POOL_ID"]
COGNITO_REGION = os.environ.get("COGNITO_REGION", "eu-central-1")
CODEBUILD_PROJECT = os.environ["CODEBUILD_PROJECT"]

# CloudFront metrics are only available in us-east-1, regardless of where the
# distribution itself is "located" (CF is a global service).
cw_global = boto3.client("cloudwatch", region_name="us-east-1")
# Lambda metrics live in the function's own region.
cw_regional = boto3.client("cloudwatch", region_name=os.environ.get("AWS_REGION", "eu-central-1"))
ses = boto3.client("ses", region_name=os.environ.get("SES_REGION", "eu-central-1"))
cognito = boto3.client("cognito-idp", region_name=COGNITO_REGION)
# Cost Explorer is a us-east-1-only API.
ce = boto3.client("ce", region_name="us-east-1")
codebuild = boto3.client("codebuild", region_name=os.environ.get("AWS_REGION", "eu-central-1"))
s3 = boto3.client("s3")


def handler(event, context):
    # Use today (start-of-day in Chicago) as the exclusive end of the window.
    # Every daily series in the snapshot covers the 30 days ending yesterday-Chicago.
    now_chicago = datetime.now(CHICAGO)
    end_chicago = now_chicago.replace(hour=0, minute=0, second=0, microsecond=0)
    end = end_chicago.astimezone(timezone.utc)
    start_30d = end - timedelta(days=SERIES_30D_DAYS)

    snapshot = {
        "version": SCHEMA_VERSION,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "rangeDays": RANGE_DAYS,
        "cloudfront": cloudfront_metrics(start_30d, end),
        "contactForm": contact_form_metrics(start_30d, end),
        "rebuilds": rebuild_metrics(start_30d, end),
        "ses": ses_metrics(),
        "cognito": cognito_metrics(),
        "cost": cost_metrics(now_chicago),
    }

    s3.put_object(
        Bucket=GALLERY_BUCKET,
        Key="metrics/dashboard.json",
        Body=json.dumps(snapshot).encode("utf-8"),
        ContentType="application/json",
        CacheControl="max-age=300",
    )

    return {"ok": True, "key": "metrics/dashboard.json"}


# ---------- CloudFront ----------

def cloudfront_metrics(start_30d, end):
    dims = [
        {"Name": "DistributionId", "Value": DISTRIBUTION_ID},
        {"Name": "Region", "Value": "Global"},
    ]
    requests = pad_series(
        daily_series(cw_global, "AWS/CloudFront", "Requests", dims, start_30d, end, "Sum"),
        start_30d, end,
    )
    bytes_dl = pad_series(
        daily_series(cw_global, "AWS/CloudFront", "BytesDownloaded", dims, start_30d, end, "Sum"),
        start_30d, end,
    )
    err4 = pad_series(
        daily_series(cw_global, "AWS/CloudFront", "4xxErrorRate", dims, start_30d, end, "Average"),
        start_30d, end,
    )
    err5 = pad_series(
        daily_series(cw_global, "AWS/CloudFront", "5xxErrorRate", dims, start_30d, end, "Average"),
        start_30d, end,
    )
    err_total = pad_series(
        daily_series(cw_global, "AWS/CloudFront", "TotalErrorRate", dims, start_30d, end, "Average"),
        start_30d, end,
    )
    # Derive an absolute error-count series (not provided directly by CloudFront).
    # errors[i] = round(requests[i] * totalErrorRate[i] / 100)
    errors_count = [
        {"ts": req["ts"], "value": int(round(req["value"] * rate["value"] / 100.0))}
        for req, rate in zip(requests, err_total)
    ]

    return {
        "requests": {
            "total7d": sum_values(requests[-7:]),
            "total30d": sum_values(requests),
            "series": requests,
        },
        "bytesDownloaded": {
            "total7dBytes": sum_values(bytes_dl[-7:]),
            "series": bytes_dl,
        },
        "errors4xxRate": {
            "avg7d": avg_values(err4[-7:]),
            "series": err4,
        },
        "errors5xxRate": {
            "avg7d": avg_values(err5[-7:]),
            "series": err5,
        },
        "totalErrorRate": {
            "avg7d": avg_values(err_total[-7:]),
            "avg30d": avg_values(err_total),
            "series": err_total,
        },
        "errorsTotal": {
            "total7d": sum_values(errors_count[-7:]),
            "total30d": sum_values(errors_count),
            "series": errors_count,
        },
    }


# ---------- Lambda (contact form) ----------

def contact_form_metrics(start_30d, end):
    dims = [{"Name": "FunctionName", "Value": CONTACT_FN}]
    invocations_series = pad_series(
        daily_series(cw_regional, "AWS/Lambda", "Invocations", dims, start_30d, end, "Sum"),
        start_30d, end,
    )
    errors_series = pad_series(
        daily_series(cw_regional, "AWS/Lambda", "Errors", dims, start_30d, end, "Sum"),
        start_30d, end,
    )
    return {
        "invocations30d": sum_values(invocations_series),
        "errors30d": sum_values(errors_series),
        "series": invocations_series,
        "errorsSeries": errors_series,
    }


# ---------- Rebuilds (CodeBuild) ----------

def rebuild_metrics(start_30d, end):
    """Daily build counts for the rebuild CodeBuild project, plus success/failure split."""
    build_ids = []
    next_token = None
    while True:
        params = {"projectName": CODEBUILD_PROJECT, "sortOrder": "DESCENDING"}
        if next_token:
            params["nextToken"] = next_token
        resp = codebuild.list_builds_for_project(**params)
        page_ids = resp.get("ids", [])
        build_ids.extend(page_ids)
        next_token = resp.get("nextToken")
        # Cap at 200 — older builds beyond the 30d window aren't useful.
        if not next_token or len(build_ids) >= 200:
            break

    # Hydrate in batches of 100 (BatchGetBuilds limit).
    builds = []
    for i in range(0, len(build_ids), 100):
        chunk = build_ids[i:i + 100]
        resp = codebuild.batch_get_builds(ids=chunk)
        builds.extend(resp.get("builds", []))

    # Bucket by UTC date within the window.
    by_day_total = {}
    by_day_success = {}
    by_day_failed = {}
    succeeded30 = failed30 = 0
    for b in builds:
        started = b.get("startTime")
        if not started:
            continue
        if started < start_30d or started >= end:
            continue
        day = started.astimezone(timezone.utc).date().isoformat()
        by_day_total[day] = by_day_total.get(day, 0) + 1
        status = b.get("buildStatus", "")
        if status == "SUCCEEDED":
            by_day_success[day] = by_day_success.get(day, 0) + 1
            succeeded30 += 1
        elif status in ("FAILED", "FAULT", "TIMED_OUT", "STOPPED"):
            by_day_failed[day] = by_day_failed.get(day, 0) + 1
            failed30 += 1

    series = pad_series([{"ts": d, "value": c} for d, c in sorted(by_day_total.items())], start_30d, end)
    success_series = pad_series([{"ts": d, "value": c} for d, c in sorted(by_day_success.items())], start_30d, end)
    failed_series = pad_series([{"ts": d, "value": c} for d, c in sorted(by_day_failed.items())], start_30d, end)

    last_build = None
    if builds:
        latest = max(builds, key=lambda b: b.get("startTime") or datetime.min.replace(tzinfo=timezone.utc))
        if latest.get("startTime"):
            last_build = {
                "buildId": latest.get("id"),
                "buildNumber": latest.get("buildNumber"),
                "status": latest.get("buildStatus"),
                "startedAt": latest["startTime"].astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }

    return {
        "total30d": sum_values(series),
        "succeeded30d": succeeded30,
        "failed30d": failed30,
        "series": series,
        "successSeries": success_series,
        "failedSeries": failed_series,
        "lastBuild": last_build,
    }


# ---------- SES ----------

def ses_metrics():
    try:
        resp = ses.get_send_statistics()
    except Exception:
        return {"sends30d": 0, "bounces30d": 0, "complaints30d": 0}

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    sends = bounces = complaints = 0
    for point in resp.get("SendDataPoints", []):
        ts = point.get("Timestamp")
        if ts and ts.replace(tzinfo=timezone.utc) >= cutoff:
            sends += point.get("DeliveryAttempts", 0)
            bounces += point.get("Bounces", 0)
            complaints += point.get("Complaints", 0)
    return {
        "sends30d": sends,
        "bounces30d": bounces,
        "complaints30d": complaints,
    }


# ---------- Cognito ----------

def cognito_metrics():
    count = 0
    pagination_token = None
    while True:
        params = {"UserPoolId": USER_POOL_ID, "Limit": 60}
        if pagination_token:
            params["PaginationToken"] = pagination_token
        resp = cognito.list_users(**params)
        count += len(resp.get("Users", []))
        pagination_token = resp.get("PaginationToken")
        if not pagination_token:
            break
    return {"userCount": count}


# ---------- Cost Explorer ----------

def cost_metrics(now_chicago):
    today_utc = datetime.now(timezone.utc).date()
    month_start = today_utc.replace(day=1)
    prev_month_end = month_start
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

    mtd_resp = ce.get_cost_and_usage(
        TimePeriod={"Start": month_start.isoformat(), "End": today_utc.isoformat()},
        Granularity="MONTHLY",
        Metrics=["UnblendedCost"],
        GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
    )
    by_service = {}
    for r in mtd_resp.get("ResultsByTime", []):
        for g in r.get("Groups", []):
            service = g["Keys"][0]
            amount = float(g["Metrics"]["UnblendedCost"]["Amount"])
            by_service[service] = by_service.get(service, 0.0) + amount
    mtd_total = round(sum(by_service.values()), 2)
    top = sorted(by_service.items(), key=lambda kv: kv[1], reverse=True)[:5]
    top_services = [{"service": s, "monthToDate": round(amt, 2)} for s, amt in top if amt > 0]

    prev_resp = ce.get_cost_and_usage(
        TimePeriod={"Start": prev_month_start.isoformat(), "End": prev_month_end.isoformat()},
        Granularity="MONTHLY",
        Metrics=["UnblendedCost"],
    )
    prev_total = 0.0
    for r in prev_resp.get("ResultsByTime", []):
        prev_total += float(r["Total"]["UnblendedCost"]["Amount"])

    # End-of-month forecast. Cost Explorer's GetCostForecast predicts spend over a future
    # window; we ask for "today → first day of next month" to get the predicted end-of-month
    # total when added to month-to-date.
    next_month_start = (month_start + timedelta(days=32)).replace(day=1)
    forecast = None
    forecast_lower = None
    forecast_upper = None
    forecast_end_of_month = None
    if today_utc < next_month_start:
        try:
            fc = ce.get_cost_forecast(
                TimePeriod={
                    "Start": today_utc.isoformat(),
                    "End": next_month_start.isoformat(),
                },
                Metric="UNBLENDED_COST",
                Granularity="MONTHLY",
                PredictionIntervalLevel=80,
            )
            forecast = round(float(fc["Total"]["Amount"]), 2)
            # Aggregate the (single) forecast window's bounds if present.
            for r in fc.get("ForecastResultsByTime", []):
                lo = r.get("PredictionIntervalLowerBound")
                up = r.get("PredictionIntervalUpperBound")
                if lo is not None:
                    forecast_lower = round(float(lo), 2)
                if up is not None:
                    forecast_upper = round(float(up), 2)
            forecast_end_of_month = round(mtd_total + (forecast or 0.0), 2)
        except Exception:
            # CE forecast needs ~14 days of history; brand-new accounts get a
            # ValidationException. Fall through with nulls.
            pass

    return {
        "currency": "USD",
        "monthToDate": mtd_total,
        "previousMonth": round(prev_total, 2),
        "topServices": top_services,
        "forecastRemainder": forecast,
        "forecastEndOfMonth": forecast_end_of_month,
        "forecastLower": forecast_lower,
        "forecastUpper": forecast_upper,
    }


# ---------- Helpers ----------

def pad_series(series, start, end):
    """Ensure every UTC day in [start, end) has an entry, defaulting missing days to 0."""
    existing = {p["ts"]: p["value"] for p in series}
    result = []
    cur = start.date()
    end_date = end.date()
    while cur < end_date:
        ts = cur.isoformat()
        result.append({"ts": ts, "value": existing.get(ts, 0)})
        cur += timedelta(days=1)
    return result


def daily_series(client, namespace, metric, dims, start, end, stat):
    """Returns [{ts: 'YYYY-MM-DD', value: <number>}] one entry per UTC day."""
    resp = client.get_metric_statistics(
        Namespace=namespace,
        MetricName=metric,
        Dimensions=dims,
        StartTime=start,
        EndTime=end,
        Period=86400,
        Statistics=[stat],
        Unit=_unit_for(metric),
    ) if _unit_for(metric) else client.get_metric_statistics(
        Namespace=namespace,
        MetricName=metric,
        Dimensions=dims,
        StartTime=start,
        EndTime=end,
        Period=86400,
        Statistics=[stat],
    )
    points = sorted(resp.get("Datapoints", []), key=lambda p: p["Timestamp"])
    series = []
    for p in points:
        ts = p["Timestamp"].date().isoformat()
        value = p.get(stat, 0)
        # Round error rates to 4 decimals, counts to integers.
        if stat == "Average":
            value = round(value, 4)
        else:
            value = int(value)
        series.append({"ts": ts, "value": value})
    return series


def total(client, namespace, metric, dims, start, end, stat):
    """Returns the sum across the full window as a single number."""
    resp = client.get_metric_statistics(
        Namespace=namespace,
        MetricName=metric,
        Dimensions=dims,
        StartTime=start,
        EndTime=end,
        Period=max(60, int((end - start).total_seconds())),
        Statistics=[stat],
    )
    points = resp.get("Datapoints", [])
    if not points:
        return 0
    if stat == "Sum":
        return sum(p["Sum"] for p in points)
    return sum(p[stat] for p in points) / len(points)


def _unit_for(metric):
    # Specifying the Unit on rate metrics avoids ambiguous-unit warnings.
    if metric in ("4xxErrorRate", "5xxErrorRate"):
        return "Percent"
    if metric == "BytesDownloaded":
        return "Bytes"
    return None


def sum_values(series):
    return sum(p["value"] for p in series)


def avg_values(series):
    if not series:
        return 0
    return round(sum(p["value"] for p in series) / len(series), 4)
