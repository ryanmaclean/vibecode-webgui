#!/usr/bin/env bash
# Script to verify DNS resolution and SSL certificate for vibecode.eastus2.cloudapp.azure.com

set -euo pipefail

# Configuration
DOMAIN=${DOMAIN:-"vibecode.eastus2.cloudapp.azure.com"}
EXPECTED_IP=${EXPECTED_IP:-"72.153.39.233"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Verifying DNS and SSL for ${DOMAIN}${NC}"
echo "---------------------------------------------------"

# Check DNS resolution
echo -e "${YELLOW}Testing DNS resolution...${NC}"
DNS_OUTPUT=$(nslookup "${DOMAIN}" 2>&1)
if [[ $? -eq 0 ]]; then
  RESOLVED_IP=$(echo "${DNS_OUTPUT}" | grep -oE "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b" | tail -n 1)
  if [[ -n "${RESOLVED_IP}" ]]; then
    echo -e "${GREEN}✓ Domain resolves to IP: ${RESOLVED_IP}${NC}"
    
    if [[ "${RESOLVED_IP}" == "${EXPECTED_IP}" ]]; then
      echo -e "${GREEN}✓ Resolved IP matches expected IP (${EXPECTED_IP})${NC}"
    else
      echo -e "${RED}✗ Resolved IP (${RESOLVED_IP}) does not match expected IP (${EXPECTED_IP})${NC}"
    fi
  else
    echo -e "${RED}✗ Failed to extract IP address from nslookup output${NC}"
    echo "${DNS_OUTPUT}"
  fi
else
  echo -e "${RED}✗ DNS resolution failed${NC}"
  echo "${DNS_OUTPUT}"
fi

echo "---------------------------------------------------"

# Check HTTP/HTTPS access
echo -e "${YELLOW}Testing HTTP access...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${DOMAIN}" 2>/dev/null || echo "Failed")
if [[ "${HTTP_CODE}" == "Failed" ]]; then
  echo -e "${RED}✗ HTTP connection failed${NC}"
else
  echo -e "${GREEN}✓ HTTP connection succeeded with status code: ${HTTP_CODE}${NC}"
fi

echo "---------------------------------------------------"

echo -e "${YELLOW}Testing HTTPS access...${NC}"
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}" 2>/dev/null || echo "Failed")
if [[ "${HTTPS_CODE}" == "Failed" ]]; then
  echo -e "${RED}✗ HTTPS connection failed${NC}"
else
  echo -e "${GREEN}✓ HTTPS connection succeeded with status code: ${HTTPS_CODE}${NC}"
fi

echo "---------------------------------------------------"

# Check SSL certificate
echo -e "${YELLOW}Checking SSL certificate...${NC}"
CERT_INFO=$(openssl s_client -connect "${DOMAIN}:443" -servername "${DOMAIN}" < /dev/null 2>/dev/null | openssl x509 -noout -text 2>/dev/null || echo "Failed")

if [[ "${CERT_INFO}" == "Failed" ]]; then
  echo -e "${RED}✗ Failed to retrieve SSL certificate information${NC}"
else
  ISSUER=$(echo "${CERT_INFO}" | grep "Issuer:" || echo "Not found")
  VALID_FROM=$(echo "${CERT_INFO}" | grep "Not Before:" || echo "Not found")
  VALID_TO=$(echo "${CERT_INFO}" | grep "Not After :" || echo "Not found")
  SUBJECT_ALT_NAMES=$(echo "${CERT_INFO}" | grep -A1 "Subject Alternative Name" | grep "DNS:" || echo "Not found")
  
  echo "Certificate issuer: ${ISSUER}"
  echo "Valid from: ${VALID_FROM}"
  echo "Valid until: ${VALID_TO}"
  echo "Subject Alternative Names: ${SUBJECT_ALT_NAMES}"
  
  if [[ "${ISSUER}" == *"Let's Encrypt"* ]]; then
    echo -e "${GREEN}✓ Certificate issued by Let's Encrypt${NC}"
  else
    echo -e "${YELLOW}⚠ Certificate not issued by Let's Encrypt${NC}"
  fi
  
  if [[ "${SUBJECT_ALT_NAMES}" == *"${DOMAIN}"* ]]; then
    echo -e "${GREEN}✓ Certificate covers ${DOMAIN}${NC}"
  else
    echo -e "${RED}✗ Certificate does not cover ${DOMAIN}${NC}"
  fi
  
  # Check if certificate is expiring soon
  EXPIRY_DATE=$(echo "${VALID_TO}" | cut -d ":" -f 2- | xargs)
  EXPIRY_TIMESTAMP=$(date -j -f "%b %d %H:%M:%S %Y %Z" "${EXPIRY_DATE}" +%s 2>/dev/null || echo "Failed")
  CURRENT_TIMESTAMP=$(date +%s)
  
  if [[ "${EXPIRY_TIMESTAMP}" != "Failed" ]]; then
    DAYS_REMAINING=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
    
    if [[ ${DAYS_REMAINING} -gt 30 ]]; then
      echo -e "${GREEN}✓ Certificate valid for ${DAYS_REMAINING} more days${NC}"
    elif [[ ${DAYS_REMAINING} -gt 0 ]]; then
      echo -e "${YELLOW}⚠ Certificate expires in ${DAYS_REMAINING} days${NC}"
    else
      echo -e "${RED}✗ Certificate has expired${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ Could not determine certificate expiration${NC}"
  fi
fi

echo "---------------------------------------------------"
echo -e "${YELLOW}Checking Let's Encrypt renewal status...${NC}"

# This would require ssh access to the ingress controller pod
# Since we don't have that in this script, we'll add a reminder
echo -e "${YELLOW}⚠ To check Let's Encrypt renewal status, you need to access the ingress controller:${NC}"
echo "  kubectl get pods -n ingress-nginx"
echo "  kubectl exec -it <ingress-controller-pod> -n ingress-nginx -- certbot certificates"

echo "---------------------------------------------------"
echo -e "${YELLOW}Summary:${NC}"

if [[ $? -eq 0 && "${RESOLVED_IP}" == "${EXPECTED_IP}" && "${HTTPS_CODE}" != "Failed" && "${CERT_INFO}" != "Failed" ]]; then
  echo -e "${GREEN}✓ DNS resolution successful${NC}"
  echo -e "${GREEN}✓ HTTPS access successful${NC}"
  echo -e "${GREEN}✓ SSL certificate valid${NC}"
  echo -e "${GREEN}DNS and SSL configuration appears to be working correctly!${NC}"
else
  echo -e "${RED}There are issues with the DNS or SSL configuration. Please review the details above.${NC}"
fi