#!/usr/bin/env bash
# Script to check the status of resource deletion

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Checking the status of resource group deletion...${NC}"

# Check main resource group
RG_STATUS=$(az group show --name rg-vibecode-aks-prod --query properties.provisioningState -o tsv 2>/dev/null || echo "NotFound")

if [ "$RG_STATUS" == "Deleting" ]; then
  echo -e "${YELLOW}Resource group rg-vibecode-aks-prod is still being deleted.${NC}"
  echo -e "Status: ${RG_STATUS}"
elif [ "$RG_STATUS" == "NotFound" ]; then
  echo -e "${GREEN}Resource group rg-vibecode-aks-prod has been deleted.${NC}"
else
  echo -e "${YELLOW}Resource group rg-vibecode-aks-prod has status: ${RG_STATUS}.${NC}"
fi

# Check nodes resource group
NODES_RG_STATUS=$(az group show --name rg-vibecode-aks-prod-nodes --query properties.provisioningState -o tsv 2>/dev/null || echo "NotFound")

if [ "$NODES_RG_STATUS" == "Deleting" ]; then
  echo -e "${YELLOW}Resource group rg-vibecode-aks-prod-nodes is still being deleted.${NC}"
  echo -e "Status: ${NODES_RG_STATUS}"
elif [ "$NODES_RG_STATUS" == "NotFound" ]; then
  echo -e "${GREEN}Resource group rg-vibecode-aks-prod-nodes has been deleted.${NC}"
else
  echo -e "${YELLOW}Resource group rg-vibecode-aks-prod-nodes has status: ${NODES_RG_STATUS}.${NC}"
fi

# Overall status
if [ "$RG_STATUS" == "NotFound" ] && [ "$NODES_RG_STATUS" == "NotFound" ]; then
  echo -e "\n${GREEN}All old resources have been deleted. You can proceed with creating a new AKS cluster.${NC}"
  echo -e "Run: ./scripts/create-aks-cluster.sh"
  exit 0
else
  echo -e "\n${YELLOW}Some resources are still being deleted. Please wait and check again later.${NC}"
  echo -e "Run this script again in a few minutes to check the status."
  exit 1
fi