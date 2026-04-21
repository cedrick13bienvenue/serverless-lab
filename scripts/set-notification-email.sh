#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# set-notification-email.sh
# Updates where task notification emails are delivered for a user.
# Reads infrastructure values from Terraform outputs — no hardcoded IDs.
#
# Usage:
#   ./scripts/set-notification-email.sh <cognito-login-email> <notification-email>
#
# Example:
#   ./scripts/set-notification-email.sh user@company.com personal@gmail.com
# ---------------------------------------------------------------------------

if [ $# -lt 2 ]; then
  echo "Usage: $0 <cognito-login-email> <notification-email>"
  echo ""
  echo "Example:"
  echo "  $0 user@company.com personal@gmail.com"
  exit 1
fi

COGNITO_EMAIL="$1"
NOTIFY_EMAIL="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra"

echo "Reading Terraform outputs..."
REGION=$(terraform -chdir="$INFRA_DIR" output -raw region 2>/dev/null || echo "eu-west-1")
USER_POOL_ID=$(terraform -chdir="$INFRA_DIR" output -raw cognito_user_pool_id)

# Check if email is already verified in SES
STATUS=$(aws ses get-identity-verification-attributes \
  --identities "$NOTIFY_EMAIL" \
  --region "$REGION" \
  --query "VerificationAttributes.\"$NOTIFY_EMAIL\".VerificationStatus" \
  --output text 2>/dev/null || echo "NotFound")

if [ "$STATUS" != "Success" ]; then
  echo "Sending SES verification email to $NOTIFY_EMAIL ..."
  aws ses verify-email-identity --email-address "$NOTIFY_EMAIL" --region "$REGION"
  echo ""
  echo "Check $NOTIFY_EMAIL inbox and click the verification link from AWS."
  read -rp "Press Enter once you've clicked the link..."
  echo ""
fi

USER_ID=$(aws cognito-idp admin-get-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$COGNITO_EMAIL" \
  --region "$REGION" \
  --query 'UserAttributes[?Name==`sub`].Value' \
  --output text)

aws dynamodb update-item \
  --table-name users \
  --key "{\"userId\": {\"S\": \"$USER_ID\"}}" \
  --update-expression "SET email = :e" \
  --expression-attribute-values "{\":e\": {\"S\": \"$NOTIFY_EMAIL\"}}" \
  --region "$REGION"

echo "Done. Notifications for $COGNITO_EMAIL will now go to $NOTIFY_EMAIL"
