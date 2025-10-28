#!/usr/bin/env bash
# Script to fix the network policy issue with kubernetes_network_policy.vibecode_app

set -euo pipefail

# Configuration
TOFU_DIR=${TOFU_DIR:-"tofu"}
NETWORK_POLICY_FILE="${TOFU_DIR}/k8s-vibecode-app.tf"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Fixing network policy in ${NETWORK_POLICY_FILE}${NC}"

# Ensure the file exists
if [[ ! -f "${NETWORK_POLICY_FILE}" ]]; then
  echo -e "${RED}Error: File ${NETWORK_POLICY_FILE} does not exist${NC}"
  exit 1
fi

# Check if there's a backup file already
if [[ -f "${NETWORK_POLICY_FILE}.bak" ]]; then
  echo -e "${YELLOW}Backup file already exists. Creating a new one with timestamp.${NC}"
  BACKUP_FILE="${NETWORK_POLICY_FILE}.bak.$(date +%Y%m%d%H%M%S)"
else
  BACKUP_FILE="${NETWORK_POLICY_FILE}.bak"
fi

# Create a backup of the original file
cp "${NETWORK_POLICY_FILE}" "${BACKUP_FILE}"
echo -e "${GREEN}Created backup at ${BACKUP_FILE}${NC}"

# Function to check if each egress block has a 'to' block with peers
check_network_policy() {
  local file="$1"
  local has_issues=false
  local line_count=0
  local in_egress=false
  local has_to=false
  local egress_start_line=0
  local issues=()
  
  while IFS= read -r line; do
    line_count=$((line_count + 1))
    
    if [[ "${line}" =~ ^[[:space:]]*egress[[:space:]]*{ ]]; then
      in_egress=true
      has_to=false
      egress_start_line=${line_count}
    elif [[ "${in_egress}" == true && "${line}" =~ ^[[:space:]]*to[[:space:]]*{ ]]; then
      has_to=true
    elif [[ "${in_egress}" == true && "${line}" =~ ^[[:space:]]*} ]]; then
      if [[ "${has_to}" == false ]]; then
        has_issues=true
        issues+=("${egress_start_line}")
      fi
      in_egress=false
    fi
  done < "${file}"
  
  if [[ "${has_issues}" == true ]]; then
    echo -e "${RED}Found egress blocks without 'to' blocks at lines: ${issues[*]}${NC}"
    return 1
  else
    echo -e "${GREEN}No issues found. All egress blocks have 'to' blocks with peers.${NC}"
    return 0
  fi
}

# Fix egress blocks that don't have a 'to' block with peers
fix_network_policy() {
  local file="$1"
  local fixed_content=""
  local line_count=0
  local in_egress=false
  local has_to=false
  local egress_block=""
  local fixed=false
  
  while IFS= read -r line; do
    line_count=$((line_count + 1))
    
    if [[ "${line}" =~ ^[[:space:]]*egress[[:space:]]*{ ]]; then
      in_egress=true
      has_to=false
      egress_block="${line}\n"
    elif [[ "${in_egress}" == true ]]; then
      egress_block+="${line}\n"
      
      if [[ "${line}" =~ ^[[:space:]]*to[[:space:]]*{ ]]; then
        has_to=true
      elif [[ "${line}" =~ ^[[:space:]]*} ]]; then
        # End of egress block
        if [[ "${has_to}" == false ]]; then
          # Insert a 'to' block before the closing brace
          # We need to extract the last line and replace it with our new content
          egress_block=$(echo -e "${egress_block}" | sed '$ d')
          egress_block+="      # Allow access to all pods in the same namespace\n"
          egress_block+="      to {\n"
          egress_block+="        namespace_selector {\n"
          egress_block+="          match_labels = {\n"
          egress_block+="            name = kubernetes_namespace.vibecode_platform.metadata[0].name\n"
          egress_block+="          }\n"
          egress_block+="        }\n"
          egress_block+="      }\n"
          egress_block+="${line}\n"
          fixed=true
        fi
        
        fixed_content+="${egress_block}"
        in_egress=false
        egress_block=""
      fi
    else
      fixed_content+="${line}\n"
    fi
  done < "${file}"
  
  if [[ "${fixed}" == true ]]; then
    echo -e "${fixed_content}" > "${file}"
    echo -e "${GREEN}Fixed network policy by adding missing 'to' blocks${NC}"
    return 0
  else
    echo -e "${YELLOW}No changes needed${NC}"
    return 0
  fi
}

# Check if there are any issues with the network policy
if ! check_network_policy "${NETWORK_POLICY_FILE}"; then
  # Fix the network policy
  if fix_network_policy "${NETWORK_POLICY_FILE}"; then
    echo -e "${GREEN}Successfully fixed network policy${NC}"
  else
    echo -e "${RED}Failed to fix network policy${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}No issues found in network policy. No changes made.${NC}"
fi

echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review the changes to the network policy"
echo "2. Run 'cd ${TOFU_DIR} && tofu validate' to validate the changes"
echo "3. Run 'cd ${TOFU_DIR} && tofu plan' to see the planned changes"
echo "4. Run 'cd ${TOFU_DIR} && tofu apply' to apply the changes"