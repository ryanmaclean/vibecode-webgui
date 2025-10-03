# shellcheck shell=bash
# Shared helpers for KIND orchestration scripts.

if [[ -n "${KIND_LIB_SOURCED:-}" ]]; then
  return
fi

KIND_LIB_SOURCED=1

kind_set_scripts_dir() {
  KIND_SCRIPTS_DIR="$1"
}

kind_run_step() {
  local description="$1"
  local script_name="$2"
  local requirement="${3:-required}"

  if [[ -z "${KIND_SCRIPTS_DIR:-}" ]]; then
    log_error "KIND_SCRIPTS_DIR is not set. Call kind_set_scripts_dir first."
    return 1
  fi

  log_step "$description"

  local script_path="${KIND_SCRIPTS_DIR}/${script_name}"
  if [[ ! -f "$script_path" ]]; then
    if [[ "$requirement" == "optional" ]]; then
      log_warn "Script not found, skipping: ${script_path}"
      return 0
    fi

    log_error "Script not found: ${script_path}"
    return 1
  fi

  chmod +x "$script_path"
  if ! "$script_path"; then
    if [[ "$requirement" == "optional" ]]; then
      log_warn "Script failed: ${script_path}"
      return 0
    fi

    log_error "Script failed: ${script_path}"
    return 1
  fi

  return 0
}
