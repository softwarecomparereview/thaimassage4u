#!/usr/bin/env bash
set -u

BASE="${BASE:-http://localhost:3000}"
BASE="${BASE%/}"
PASS=0
FAIL=0
UA="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

fetch() {
  local route="$1"
  RESPONSE="$(curl -s --compressed --max-time 20 --connect-timeout 5 -A "$UA" -w '__STATUS__%{http_code}' "$BASE$route")"
  STATUS="${RESPONSE##*__STATUS__}"
  HTML="${RESPONSE%__STATUS__*}"
}

pass() { PASS=$((PASS + 1)); printf '  [PASS] %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  [FAIL] %s\n' "$1"; }

check_public() {
  local route="$1" needle="$2" title="$3"
  fetch "$route"
  local title="$3" root body title_count canonical_count head_part
  root="$(printf '%s' "$HTML" | awk '!capturing { i=index($0,"<div id=\"root\">"); if (!i) next; capturing=1; $0=substr($0,i+15) } { j=index($0,"window.__RQ_STATE__"); if (j) { printf "%s", substr($0,1,j-1); exit } print }')"
  [ "$STATUS" = "200" ] || { fail "$route status $STATUS"; return; }
  printf '%s' "$root" | grep -qF -- "$needle" || { fail "$route missing server body text"; return; }
  head_part="${HTML%%</head>*}"
  title_count="$(printf '%s' "$head_part" | grep -o '<title>' | wc -l | tr -d ' ' || true)"
  canonical_count="$(printf '%s' "$head_part" | grep -o 'rel="canonical"' | wc -l | tr -d ' ' || true)"
  [ "$title_count" = "1" ] || { fail "$route title count $title_count"; return; }
  printf '%s' "$HTML" | grep -qF "<title>$title</title>" || { fail "$route title"; return; }
  [ "$canonical_count" = "1" ] || { fail "$route canonical count $canonical_count"; return; }
  printf '%s' "$HTML" | grep -qF 'property="og:title"' || { fail "$route og:title"; return; }
  printf '%s' "$HTML" | grep -qF 'name="twitter:card"' || { fail "$route twitter card"; return; }
  printf '%s' "$HTML" | grep -qF '__RQ_STATE__' || { fail "$route dehydrated state"; return; }
  pass "$route"
}

check_noindex() {
  local route="$1" needle="$2"
  fetch "$route"
  [ "$STATUS" = "200" ] || { fail "$route status $STATUS"; return; }
  if [ -n "$needle" ]; then
    printf '%s' "$HTML" | grep -qF "$needle" || { fail "$route body"; return; }
  fi
  printf '%s' "$HTML" | grep -io '<meta[^>]*name="robots"[^>]*>' | grep -qiF 'noindex' || { fail "$route noindex"; return; }
  pass "$route noindex"
}

check_404() {
  local route="$1"
  fetch "$route"
  [ "$STATUS" = "404" ] || { fail "$route expected 404 got $STATUS"; return; }
  printf '%s' "$HTML" | grep -io '<meta[^>]*name="robots"[^>]*>' | grep -qiF 'noindex' || { fail "$route 404 noindex"; return; }
  ! printf '%s' "$HTML" | grep -qE '<!--app-(html|head)-->' || { fail "$route raw template placeholder"; return; }
  pass "$route 404"
}

check_redirect() {
  local route="$1" target="$2"
  local result code location
  result="$(curl -s -o /dev/null --max-time 20 --connect-timeout 5 -A "$UA" -w '%{http_code} %{redirect_url}' "$BASE$route")"
  code="${result%% *}"; location="${result#* }"
  [ "$code" = "301" ] && [ "$location" = "$BASE$target" ] || { fail "$route redirect"; return; }
  pass "$route redirect"
}

echo "== Quiet Hour SSR verification: $BASE =="
check_public "/" "The best wellness recommendations" "Quiet Hour — Find your place in the city"
check_public "/directory" "A more considered way to choose" "Wellness directory — Quiet Hour"
check_public "/journal" "Wellness intelligence, without the performance" "Wellness journal — Quiet Hour"
check_public "/list-your-place" "Be found by people who are" "List your wellness studio — Quiet Hour"
check_noindex "/cms" ""
check_404 "/definitely-not-a-route"
if [ "${CHECK_REDIRECTS:-1}" = "1" ]; then
  check_redirect "/index.html" "/"
  check_redirect "/journal/" "/journal"
fi
echo "== Result: PASS=$PASS FAIL=$FAIL =="
[ "$FAIL" = "0" ]
