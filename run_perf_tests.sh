#!/bin/bash
export DD_API_KEY=${DD_API_KEY:-"dummy-datadog-key"}
export DD_APPLICATION_KEY=${DD_APPLICATION_KEY:-"dummy-datadog-app-key"}
export BASE_URL=http://localhost:8080
npm run test:performance
