#!/bin/sh
set -eu
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
GOBIN="$DIR/bin" go build -o "$DIR/bin/td" ./cmd/td
