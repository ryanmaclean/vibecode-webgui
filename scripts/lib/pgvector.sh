# shellcheck shell=bash
# Helpers for working with temporary pgvector containers in tests.

pgvector_start_container() {
  local container_name="$1"
  local host_port="$2"
  local database="$3"
  local user="$4"
  local password="$5"
  local image="${6:-ankane/pgvector}"

  docker rm -f "$container_name" >/dev/null 2>&1 || true
  docker run --name "$container_name" \
    -e POSTGRES_DB="$database" \
    -e POSTGRES_USER="$user" \
    -e POSTGRES_PASSWORD="$password" \
    -p "${host_port}:5432" \
    -d "$image" >/dev/null
}

pgvector_wait_for_start() {
  local container_name="$1"
  local user="$2"
  local database="$3"
  local retries="${4:-10}"
  local delay_seconds="${5:-2}"

  local attempt
  for attempt in $(seq 1 "$retries"); do
    if docker exec "$container_name" psql -U "$user" -d "$database" -c 'SELECT 1' >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay_seconds"
  done

  return 1
}

pgvector_exec_sql() {
  local container_name="$1"
  local user="$2"
  local database="$3"
  local sql="$4"

  docker exec "$container_name" psql -U "$user" -d "$database" -c "$sql"
}
