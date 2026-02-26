#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_LOGIN_ID="${ADMIN_LOGIN_ID:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
SMOKE_USER_PASSWORD="${SMOKE_USER_PASSWORD:-user12345}"

json_string() {
  local json="$1"
  local key="$2"
  printf '%s' "$json" | sed -n "s/.*\"$key\":\"\\([^\"]*\\)\".*/\\1/p" | head -n1
}

require_value() {
  local value="$1"
  local label="$2"
  if [[ -z "$value" ]]; then
    echo "missing value: $label"
    exit 1
  fi
}

docker compose up -d >/dev/null

for _ in $(seq 1 30); do
  if curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
  echo "api is not ready: $BASE_URL/health"
  exit 1
fi

admin_login_resp="$(curl -fsS -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"loginId\":\"$ADMIN_LOGIN_ID\",\"password\":\"$ADMIN_PASSWORD\"}")"
admin_token="$(json_string "$admin_login_resp" "token")"
require_value "$admin_token" "admin token"

run_id="$(date +%Y%m%d%H%M%S)"
warehouse_name="smoke-warehouse-$run_id"
asset_no="SMOKE-$run_id"
tool_name="Smoke Tool $run_id"
smoke_username="smoke_user_$run_id"
smoke_email="smoke_$run_id@example.com"

warehouse_resp="$(curl -fsS -X POST "$BASE_URL/api/admin/warehouses" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$warehouse_name\"}")"
warehouse_id="$(json_string "$warehouse_resp" "id")"
require_value "$warehouse_id" "warehouse id"

tool_resp="$(curl -fsS -X POST "$BASE_URL/api/admin/tools" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d "{\"assetNo\":\"$asset_no\",\"name\":\"$tool_name\",\"warehouseId\":\"$warehouse_id\",\"baseStatus\":\"AVAILABLE\"}")"
tool_id="$(json_string "$tool_resp" "id")"
require_value "$tool_id" "tool id"

curl -fsS -X POST "$BASE_URL/api/admin/users" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d "{\"department\":\"smoke\",\"username\":\"$smoke_username\",\"email\":\"$smoke_email\",\"password\":\"$SMOKE_USER_PASSWORD\",\"role\":\"user\"}" >/dev/null

user_login_resp="$(curl -fsS -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"loginId\":\"$smoke_username\",\"password\":\"$SMOKE_USER_PASSWORD\"}")"
user_token="$(json_string "$user_login_resp" "token")"
require_value "$user_token" "user token"

today="$(date +%F)"
loan_resp="$(curl -fsS -X POST "$BASE_URL/api/loan-boxes" \
  -H "Authorization: Bearer $user_token" \
  -H "Content-Type: application/json" \
  -d "{\"startDate\":\"$today\",\"dueDate\":\"$today\",\"toolIds\":[\"$tool_id\"],\"itemDueOverrides\":{}}")"
box_id="$(json_string "$loan_resp" "boxId")"
loan_item_id="$(json_string "$loan_resp" "loanItemId")"
require_value "$box_id" "box id"
require_value "$loan_item_id" "loan item id"

curl -fsS -X POST "$BASE_URL/api/my/loans/$loan_item_id/return-request" \
  -H "Authorization: Bearer $user_token" \
  -H "Content-Type: application/json" \
  -d '{}' >/dev/null

curl -fsS -X POST "$BASE_URL/api/admin/returns/approve-box" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d "{\"boxId\":\"$box_id\"}" >/dev/null

tools_resp="$(curl -fsS -G "$BASE_URL/api/tools" \
  -H "Authorization: Bearer $user_token" \
  --data-urlencode "q=$asset_no" \
  --data-urlencode "mode=exact" \
  --data-urlencode "page=1" \
  --data-urlencode "pageSize=25")"

if ! printf '%s' "$tools_resp" | grep -q "\"assetNo\":\"$asset_no\""; then
  echo "tool not found in /api/tools response"
  exit 1
fi
if ! printf '%s' "$tools_resp" | grep -q "\"status\":\"AVAILABLE\""; then
  echo "tool did not return to AVAILABLE"
  exit 1
fi

echo "e2e smoke passed: tool is AVAILABLE"
