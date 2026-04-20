#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# assign-task.sh
# Assigns a task to a user by looking up their Cognito userId from their email.
#
# Usage:
#   ./scripts/assign-task.sh <taskId> <email>
#
# Example:
#   ./scripts/assign-task.sh task-abc123 bienvenue.cedric@amalitech.com
# ---------------------------------------------------------------------------

TASK_ID="${1:-}"
EMAIL="${2:-}"

if [[ -z "$TASK_ID" || -z "$EMAIL" ]]; then
  echo "Usage: $0 <taskId> <email>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra"

echo "Reading Terraform outputs..."
USER_POOL_ID=$(terraform -chdir="$INFRA_DIR" output -raw cognito_user_pool_id)
API_URL=$(terraform -chdir="$INFRA_DIR" output -raw api_gateway_url)

echo "Looking up userId for $EMAIL ..."
USER_ID=$(aws cognito-idp list-users \
  --user-pool-id "$USER_POOL_ID" \
  --filter "email = \"$EMAIL\"" \
  --region eu-west-1 \
  --query "Users[0].Username" \
  --output text)

if [[ -z "$USER_ID" || "$USER_ID" == "None" ]]; then
  echo "Error: no user found with email $EMAIL"
  exit 1
fi

echo "User Pool ID : $USER_POOL_ID"
echo "User ID      : $USER_ID"
echo "Task ID      : $TASK_ID"

echo "You need a valid admin JWT token to call the API."
echo "Copy your access token from the browser (DevTools → Application → Local Storage → accessToken)"
echo ""
read -r -p "Paste your access token: " TOKEN

RESPONSE=$(curl -s -X PATCH \
  "${API_URL}tasks/${TASK_ID}/assign" \
  -H "Content-Type: application/json" \
  -H "Authorization: ${TOKEN}" \
  -d "{\"userIds\": [\"${USER_ID}\"]}")

echo "Response: $RESPONSE"
