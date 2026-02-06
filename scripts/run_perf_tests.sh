#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

export DD_API_KEY=${DD_API_KEY:-"dummy-datadog-key"}

# Initialize log aggregation
init_log_aggregation

export DD_APPLICATION_KEY=${DD_APPLICATION_KEY:-"dummy-datadog-app-key"}
export BASE_URL=http://localhost:8080
npm run test:performance
