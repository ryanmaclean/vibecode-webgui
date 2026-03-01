#!/bin/bash
# Manual E2E Test Script for Workspace Templates and Cloning Feature
#
# Prerequisites:
# - Development server running (npm run dev)
# - User authenticated (session cookie available)
#
# Usage: ./tests/manual/workspace-templates-e2e.sh

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
WORKSPACE_ID="test-workspace-$(date +%s)"
TEMPLATE_NAME="E2E Test Template"

echo "==================================="
echo "Workspace Templates E2E Test"
echo "==================================="
echo ""
echo "API Base URL: $API_BASE_URL"
echo "Test Workspace ID: $WORKSPACE_ID"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Create a workspace via API
echo -e "${YELLOW}Step 1: Creating workspace...${NC}"
CREATE_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/api/workspaces" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'"$WORKSPACE_ID"'",
    "projectName": "E2E Test Workspace",
    "framework": "react",
    "userId": "test-user",
    "files": {
      "package.json": "{\"name\":\"test\",\"version\":\"1.0.0\"}",
      "index.js": "console.log(\"Hello World\");"
    },
    "dependencies": ["react", "react-dom"],
    "environment": {"NODE_ENV": "development"}
  }')

echo "$CREATE_RESPONSE" | jq . || echo "$CREATE_RESPONSE"

if echo "$CREATE_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Workspace created successfully${NC}"
  CREATED_WORKSPACE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.workspace.id' 2>/dev/null || echo "$WORKSPACE_ID")
else
  echo -e "${RED}✗ Failed to create workspace${NC}"
  if echo "$CREATE_RESPONSE" | grep -q "Kubernetes cluster not configured"; then
    echo -e "${YELLOW}⚠ Kubernetes not available - skipping workspace creation tests${NC}"
    echo "Continuing with template tests using existing workspace..."
    CREATED_WORKSPACE_ID="$WORKSPACE_ID"
  else
    exit 1
  fi
fi
echo ""

# Step 2: Save workspace as template
echo -e "${YELLOW}Step 2: Saving workspace as template...${NC}"
TEMPLATE_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/api/workspaces/${CREATED_WORKSPACE_ID}/template" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'"$TEMPLATE_NAME"'",
    "description": "E2E test template for workspace templates feature",
    "is_public": false,
    "tags": "e2e,test,react",
    "framework": "react",
    "language": "javascript"
  }')

echo "$TEMPLATE_RESPONSE" | jq . || echo "$TEMPLATE_RESPONSE"

if echo "$TEMPLATE_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Template created successfully${NC}"
  TEMPLATE_ID=$(echo "$TEMPLATE_RESPONSE" | jq -r '.template.id' 2>/dev/null)
else
  echo -e "${RED}✗ Failed to create template${NC}"
  if echo "$TEMPLATE_RESPONSE" | grep -q "Unauthorized"; then
    echo -e "${YELLOW}⚠ Authentication required - please ensure you are logged in${NC}"
    exit 1
  fi
fi
echo ""

# Step 3: Verify template appears in listing
echo -e "${YELLOW}Step 3: Verifying template in listing...${NC}"
LIST_RESPONSE=$(curl -s -X GET "${API_BASE_URL}/api/workspace-templates")

echo "$LIST_RESPONSE" | jq . || echo "$LIST_RESPONSE"

if echo "$LIST_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Templates listed successfully${NC}"

  # Check if our template is in the list
  if echo "$LIST_RESPONSE" | grep -q "$TEMPLATE_NAME"; then
    echo -e "${GREEN}✓ Created template found in listing${NC}"
  else
    echo -e "${YELLOW}⚠ Created template not found in listing (may be filtered)${NC}"
  fi
else
  echo -e "${RED}✗ Failed to list templates${NC}"
fi
echo ""

# Step 4: Filter templates by framework
echo -e "${YELLOW}Step 4: Testing template filtering by framework...${NC}"
FILTER_RESPONSE=$(curl -s -X GET "${API_BASE_URL}/api/workspace-templates?framework=react")

echo "$FILTER_RESPONSE" | jq . || echo "$FILTER_RESPONSE"

if echo "$FILTER_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Templates filtered successfully${NC}"
else
  echo -e "${RED}✗ Failed to filter templates${NC}"
fi
echo ""

# Step 5: Get specific template details
if [ -n "$TEMPLATE_ID" ] && [ "$TEMPLATE_ID" != "null" ]; then
  echo -e "${YELLOW}Step 5: Getting template details...${NC}"
  TEMPLATE_DETAIL_RESPONSE=$(curl -s -X GET "${API_BASE_URL}/api/workspace-templates/${TEMPLATE_ID}")

  echo "$TEMPLATE_DETAIL_RESPONSE" | jq . || echo "$TEMPLATE_DETAIL_RESPONSE"

  if echo "$TEMPLATE_DETAIL_RESPONSE" | grep -q "$TEMPLATE_NAME"; then
    echo -e "${GREEN}✓ Template details retrieved successfully${NC}"
  else
    echo -e "${RED}✗ Failed to get template details${NC}"
  fi
  echo ""
fi

# Step 6: Clone workspace
echo -e "${YELLOW}Step 6: Cloning workspace...${NC}"
CLONE_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/api/workspaces/${CREATED_WORKSPACE_ID}/clone" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cloned E2E Test Workspace"
  }')

echo "$CLONE_RESPONSE" | jq . || echo "$CLONE_RESPONSE"

if echo "$CLONE_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Workspace cloned successfully${NC}"
  CLONED_WORKSPACE_ID=$(echo "$CLONE_RESPONSE" | jq -r '.workspace.id' 2>/dev/null)

  # Verify different ID
  if [ "$CLONED_WORKSPACE_ID" != "$CREATED_WORKSPACE_ID" ]; then
    echo -e "${GREEN}✓ Cloned workspace has different ID${NC}"
  else
    echo -e "${RED}✗ Cloned workspace has same ID as original${NC}"
  fi
else
  echo -e "${RED}✗ Failed to clone workspace${NC}"
  if echo "$CLONE_RESPONSE" | grep -q "Kubernetes cluster not configured"; then
    echo -e "${YELLOW}⚠ Kubernetes not available - expected behavior${NC}"
  fi
fi
echo ""

# Summary
echo "==================================="
echo -e "${GREEN}E2E Test Summary${NC}"
echo "==================================="
echo ""
echo "Test completed. Review the output above for any failures."
echo ""
echo "Created Resources:"
echo "  - Workspace ID: $CREATED_WORKSPACE_ID"
if [ -n "$TEMPLATE_ID" ] && [ "$TEMPLATE_ID" != "null" ]; then
  echo "  - Template ID: $TEMPLATE_ID"
fi
if [ -n "$CLONED_WORKSPACE_ID" ] && [ "$CLONED_WORKSPACE_ID" != "null" ]; then
  echo "  - Cloned Workspace ID: $CLONED_WORKSPACE_ID"
fi
echo ""
echo -e "${YELLOW}Note: Manual cleanup may be required for created resources${NC}"
