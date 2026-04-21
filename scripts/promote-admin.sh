#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# promote-admin.sh
# Promotes a user to the Admins group in the Cognito User Pool.
# Reads infrastructure values from Terraform outputs — no hardcoded IDs.
#
# Usage:
#   ./scripts/promote-admin.sh <email>
#
# Example:
#   ./scripts/promote-admin.sh username@amalitech.com
# ---------------------------------------------------------------------------

DEFAULT_EMAIL="bienvenue.cedric@amalitech.com"
EMAIL="${1:-$DEFAULT_EMAIL}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra"

echo "Reading Terraform outputs from $INFRA_DIR ..."
USER_POOL_ID=$(terraform -chdir="$INFRA_DIR" output -raw cognito_user_pool_id)

echo "User Pool ID : $USER_POOL_ID"
echo "Promoting    : $EMAIL -> Admins"

aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --group-name Admins \
  --region eu-west-1

echo "Done. Hard-refresh the browser to pick up the new role."
