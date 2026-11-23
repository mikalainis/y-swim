#!/usr/bin/env bash
# y-swim.com: point y-swim.com (and www) at Cloud Run.
#
# Run in Cloud Shell AFTER the first successful Cloud Run deploy (the "y-swim" service must exist):
#   bash infra/gcp/domain.sh
#
# Uses Cloud Run domain mappings: free, with a Google-managed HTTPS certificate for BOTH
# y-swim.com and www.y-swim.com (this fixes the old www certificate problem). Google labels
# domain mappings Preview; a load balancer is the alternative, about $18+/month, not worth it here.
#
# Before the first run, the domain must be verified for the signed-in Google account, once:
#   gcloud domains verify y-swim.com
# (Search Console opens; it gives a TXT record to add in Squarespace Domains -> y-swim.com -> DNS).
# Then this script prints the DNS records to enter at Squarespace.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-pentathlon-records}"
REGION="${REGION:-us-east4}"
SERVICE="y-swim"
DOMAINS=(${DOMAINS:-y-swim.com www.y-swim.com})

gcloud config set project "$PROJECT_ID" >/dev/null

for d in "${DOMAINS[@]}"; do
  if ! gcloud beta run domain-mappings describe --domain "$d" --region "$REGION" >/dev/null 2>&1; then
    gcloud beta run domain-mappings create --service "$SERVICE" --domain "$d" --region "$REGION"
  fi
  printf '\n\033[1m== DNS records for %s (enter these at Squarespace Domains)\033[0m\n' "$d"
  gcloud beta run domain-mappings describe --domain "$d" --region "$REGION" \
    --format='table(status.resourceRecords[].type,status.resourceRecords[].name,status.resourceRecords[].rrdata)'
done

cat <<'MSG'

At Squarespace Domains (y-swim.com -> DNS settings):
  1. Remove the old Firebase Hosting records: the A record(s) for @ pointing at Firebase
     (199.36.158.100 or similar) and any www record pointing at Firebase / web.app.
     Keep the Google Workspace records (MX, and TXT for SPF/DKIM/verification) as they are.
  2. Add the records printed above. "Name" @ or blank means the bare domain y-swim.com.
The HTTPS certificates are issued automatically, usually within 15-60 minutes of DNS updating.
Check progress with:
  gcloud beta run domain-mappings describe --domain y-swim.com --region us-east4
  gcloud beta run domain-mappings describe --domain www.y-swim.com --region us-east4
MSG
