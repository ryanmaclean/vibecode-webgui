#!/usr/bin/env bash
set -euo pipefail

# Alpine (musl) Chromium headless DOM benchmark
# - Pulls alpine:3.20, installs chromium
# - Hits a URL (default http://host.docker.internal:8080/)
# - Measures time-to-DOM via --dump-dom
# - Emits JSON results to stdout
# - Optionally emits DogStatsD metrics to host (Datadog agent) via UDP
#   metric: vibecode.bench.dom_dump_ms (gauge)

URL="http://host.docker.internal:8080/"
ITER=3
DOCKER_IMAGE="alpine:3.20"
DOGSTATSD_ADDR="host.docker.internal:8125"  # host's DogStatsD
EMIT_STATS=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      URL="$2"; shift 2;;
    --iter|-n)
      ITER="$2"; shift 2;;
    --dogstatsd)
      DOGSTATSD_ADDR="$2"; shift 2;;
    --no-stats)
      EMIT_STATS=false; shift 1;;
    *)
      echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

# Ensure Docker is available
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon not available" >&2; exit 1
fi

# Prepare container command
read -r -d '' CONTAINER_SCRIPT <<'EOS'
set -euo pipefail
URL="${URL}"
ITER="${ITER}"
DOGSTATSD_ADDR="${DOGSTATSD_ADDR}"
EMIT_STATS="${EMIT_STATS}"

apk add --no-cache chromium curl coreutils >/dev/null
# Versions
MUSL_VER=$(ldd --version 2>&1 | head -n1 | tr -s ' ')
CHROME_BIN=$(command -v chromium-browser || command -v chromium)
CHROME_VER=$($CHROME_BIN --version 2>/dev/null | tr -s ' ')

# Run iterations
RESULTS=()
for i in $(seq 1 "$ITER"); do
  start=$(date +%s%3N)
  # Dump DOM; ignore non-zero exit (GPU/Vulkan noise in logs is expected in headless)
  "$CHROME_BIN" --headless=new --disable-gpu --no-sandbox \
    --user-data-dir=/tmp/chrome --dump-dom "$URL" >/tmp/dom.html 2>/tmp/chrome.log || true
  end=$(date +%s%3N)
  dur=$((end - start))
  RESULTS+=("$dur")
  if [ "$EMIT_STATS" = "true" ]; then
    # Send DogStatsD gauge with tags
    METRIC="vibecode.bench.dom_dump_ms:${dur}|g|#mode:alpine_chromium,url:$(echo "$URL" | sed 's/[:,|# ]/_/g')"
    # UDP fire-and-forget to host agent
    # shellcheck disable=SC2086
    (echo "$METRIC" >/dev/udp/${DOGSTATSD_ADDR%:*}/${DOGSTATSD_ADDR#*:}) 2>/dev/null || true
  fi
  # Slight pause between runs
  sleep 0.2
done

# Helper for stats
calc_p50() { printf '%s\n' "$@" | sort -n | awk ' {a[NR]=$1} END{ if (NR==0){print 0}else{m=int((NR+1)/2); if (NR%2){print a[m]} else {print int((a[m]+a[m+1])/2)} } }'; }
calc_min() { printf '%s\n' "$@" | sort -n | head -n1; }
calc_max() { printf '%s\n' "$@" | sort -n | tail -n1; }
calc_p95() { printf '%s\n' "$@" | sort -n | awk ' {a[NR]=$1} END{ if (NR==0){print 0}else{ idx=int(0.95*NR); if (idx<1) idx=1; if (idx>NR) idx=NR; print a[idx] } }'; }

min=$(calc_min "${RESULTS[@]}")
p50=$(calc_p50 "${RESULTS[@]}")
p95=$(calc_p95 "${RESULTS[@]}")
max=$(calc_max "${RESULTS[@]}")

# JSON output
python3 - <<PY
import json
print(json.dumps({
  "url": "${URL}",
  "iter": int(${ITER}),
  "musl": "${MUSL_VER}",
  "chromium": "${CHROME_VER}",
  "durations_ms": [${RESULTS[@]}],
  "min_ms": int(${min}),
  "p50_ms": int(${p50}),
  "p95_ms": int(${p95}),
  "max_ms": int(${max})
}, indent=2))
PY
EOS

# Run container with env
docker run --rm \
  -e URL="$URL" -e ITER="$ITER" \
  -e DOGSTATSD_ADDR="$DOGSTATSD_ADDR" -e EMIT_STATS="$EMIT_STATS" \
  "$DOCKER_IMAGE" sh -euxc "$CONTAINER_SCRIPT"
