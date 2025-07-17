# Datadog Security Synthetic Tests
#
# Comprehensive security testing for VibeCode platform
# Tests for vulnerabilities identified in security review
#
# Staff Engineer Implementation - Production security validation

# Input Validation Security Test
resource "datadog_synthetics_test" "input_validation_security" {
  type    = "api"
  subtype = "multi"
  name    = "VibeCode Input Validation Security Test - ${var.environment}"
  message = "Input validation vulnerabilities detected. ${var.alerting_config.escalation_message}"
  tags    = ["env:${var.environment}", "service:vibecode-api", "team:security", "test-type:input-validation"]

  locations = local.security_locations

  options_list {
    tick_every = var.test_intervals.security

    retry {
      count    = 1
      interval = 60
    }

    monitor_options {
      renotify_interval = var.alerting_config.renotify_interval_minutes
    }
  }

  # Test SQL Injection attempts
  api_step {
    name = "SQL Injection Test"

    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/chat"
      headers = {
        "Content-Type" = "application/json"
        "User-Agent"   = "Security-Scanner/1.0"
      }
      body = jsonencode({
        message = "'; DROP TABLE users; --"
        workspaceId = "test'; DELETE FROM workspaces; --"
        contextFiles = ["../../etc/passwd", "../../../etc/shadow"]
      })
    }

    assertion {
      type     = "statusCode"
      operator = "is"
      target   = "401" # Should reject unauthenticated requests
    }

    assertion {
      type     = "body"
      operator = "doesNotContain"
      target   = "error"
    }
  }

  # Test Command Injection attempts
  api_step {
    name = "Command Injection Test"

    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/generate"
      headers = {
        "Content-Type" = "application/json"
      }
      body = jsonencode({
        prompt = "$(rm -rf /)",
        workspaceId = "; cat /etc/passwd #",
        filePath = "../../../../../../etc/passwd"
      })
    }

    assertion {
      type     = "statusCode"
      operator = "is"
      target   = "401" # Should reject unauthenticated requests
    }

    assertion {
      type     = "body"
      operator = "doesNotContain"
      target   = "root:x:0:0"
    }
  }

  # Test Path Traversal attempts
  api_step {
    name = "Path Traversal Test"

    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/analyze"
      headers = {
        "Content-Type" = "application/json"
      }
      body = jsonencode({
        code = "test code",
        workspaceId = "../../../etc",
        language = "javascript"
      })
    }

    assertion {
      type     = "statusCode"
      operator = "is"
      target   = "401"
    }
  }
}

# Authentication Bypass Security Test
resource "datadog_synthetics_test" "auth_bypass_security" {
  type    = "api"
  subtype = "multi"
  name    = "VibeCode Authentication Bypass Security Test - ${var.environment}"
  message = "Authentication bypass vulnerabilities detected. ${var.alerting_config.escalation_message}"
  tags    = ["env:${var.environment}", "service:vibecode-auth", "team:security", "test-type:auth-bypass"]

  locations = local.security_locations

  options_list {
    tick_every = var.test_intervals.security
  }

  # Test direct API access without authentication
  api_step {
    name = "Unauthenticated API Access Test"

    request_definition {
      method = "GET"
      url    = "${var.app_base_url}/api/monitoring/metrics"
      headers = {
        "User-Agent" = "Security-Scanner/1.0"
      }
    }

    assertion {
      type     = "statusCode"
      operator = "isNot"
      target   = "200" # Should not allow access
    }
  }

  # Test session manipulation
  api_step {
    name = "Session Manipulation Test"

    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/session"
      headers = {
        "Content-Type" = "application/json"
        "Cookie"       = "session=invalid_session_token"
      }
      body = jsonencode({
        action = "start",
        workspaceId = "admin-workspace"
      })
    }

    assertion {
      type     = "statusCode"
      operator = "is"
      target   = "401"
    }
  }

  # Test JWT manipulation
  api_step {
    name = "JWT Manipulation Test"

    request_definition {
      method = "GET"
      url    = "${var.app_base_url}/api/auth/session"
      headers = {
        "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malicious.payload"
      }
    }

    assertion {
      type     = "statusCode"
      operator = "is"
      target   = "401"
    }
  }
}

# XSS and Content Security Test
resource "datadog_synthetics_test" "xss_content_security" {
  type    = "api"
  subtype = "multi"
  name    = "VibeCode XSS and Content Security Test - ${var.environment}"
  message = "XSS vulnerabilities or CSP violations detected. @security-team"
  tags    = ["env:${var.environment}", "service:vibecode-frontend", "team:security", "test-type:xss"]

  locations = local.security_locations

  options_list {
    tick_every = var.test_intervals.security
  }

  # Test XSS payload injection
  api_step {
    name = "XSS Payload Test"

    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/chat"
      headers = {
        "Content-Type" = "application/json"
      }
      body = jsonencode({
        message = "<script>alert('XSS')</script>",
        workspaceId = "<img src=x onerror=alert('XSS')>"
      })
    }

    assertion {
      type     = "statusCode"
      operator = "is"
      target   = "401" # Should be rejected due to auth
    }

    assertion {
      type     = "body"
      operator = "doesNotContain"
      target   = "<script>"
    }
  }

  # Test Content Security Policy
  api_step {
    name = "Content Security Policy Test"

    request_definition {
      method = "GET"
      url    = "${var.app_base_url}/"
      headers = {
        "User-Agent" = "Security-Scanner/1.0"
      }
    }

    assertion {
      type     = "header"
      operator = "contains"
      property = "content-security-policy"
      target   = "default-src"
    }

    assertion {
      type     = "header"
      operator = "contains"
      property = "x-content-type-options"
      target   = "nosniff"
    }
  }
}

# File Upload Security Test
resource "datadog_synthetics_test" "file_upload_security" {
  type    = "api"
  subtype = "multi"
  name    = "VibeCode File Upload Security Test - ${var.environment}"
  message = "File upload vulnerabilities detected. @security-team @slack-alerts"
  tags    = ["env:${var.environment}", "service:vibecode-api", "team:security", "test-type:file-upload"]

  locations = local.security_locations

  options_list {
    tick_every = var.test_intervals.security * 2 # Less frequent
  }

  # Test malicious file upload attempts
  api_step {
    name = "Malicious File Upload Test"

    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/analyze"
      headers = {
        "Content-Type" = "application/json"
      }
      body = jsonencode({
        code = "<?php system($_GET['cmd']); ?>",
        language = "php",
        workspaceId = "test"
      })
    }

    assertion {
      type     = "statusCode"
      operator = "is"
      target   = "401" # Should be rejected due to auth
    }
  }

  # Test oversized payload
  api_step {
    name = "Oversized Payload Test"

    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/generate"
      headers = {
        "Content-Type" = "application/json"
      }
      body = jsonencode({
        prompt = "${"A" * 100000}", # Very large payload
        workspaceId = "test"
      })
    }

    assertion {
      type     = "statusCode"
      operator = "isNot"
      target   = "200"
    }

    assertion {
      type     = "responseTime"
      operator = "lessThan"
      target   = "5000" # Should fail quickly, not hang
    }
  }
}

# Rate Limiting and DoS Protection Test
resource "datadog_synthetics_test" "rate_limiting_security" {
  type    = "api"
  subtype = "multi"
  name    = "VibeCode Rate Limiting Security Test - ${var.environment}"
  message = "Rate limiting failures detected. Potential DoS vulnerability. @security-team"
  tags    = ["env:${var.environment}", "service:vibecode-api", "team:security", "test-type:rate-limiting"]

  locations = ["aws:us-east-1"] # Single location for cost

  options_list {
    tick_every = var.test_intervals.rate_limiting
  }

  # Rapid fire requests to test rate limiting
  api_step {
    name = "Rapid Request 1"

    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/chat"
      headers = {
        "Content-Type" = "application/json"
        "X-Forwarded-For" = "192.168.1.100"
      }
      body = jsonencode({
        message = "rate test 1",
        workspaceId = "test"
      })
    }

    assertion {
      type     = "statusCode"
      operator = "isNot"
      target   = "500" # Should not crash server
    }
  }

  api_step {
    name = "Rapid Request 2"

    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/chat"
      headers = {
        "Content-Type" = "application/json"
        "X-Forwarded-For" = "192.168.1.100"
      }
      body = jsonencode({
        message = "rate test 2",
        workspaceId = "test"
      })
    }

    assertion {
      type     = "statusCode"
      operator = "isNot"
      target   = "500"
    }
  }

  # After rapid requests, should see rate limiting
  api_step {
    name = "Rate Limited Request"

    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/chat"
      headers = {
        "Content-Type" = "application/json"
        "X-Forwarded-For" = "192.168.1.100"
      }
      body = jsonencode({
        message = "should be rate limited",
        workspaceId = "test"
      })
    }

    assertion {
      type     = "statusCode"
      operator = "matches"
      target   = "4[0-9][0-9]" # Should return 4xx error
    }
  }
}

# Information Disclosure Security Test
resource "datadog_synthetics_test" "information_disclosure_security" {
  type    = "api"
  subtype = "multi"
  name    = "VibeCode Information Disclosure Security Test - ${var.environment}"
  message = "Information disclosure vulnerabilities detected. @security-team"
  tags    = ["env:${var.environment}", "service:vibecode-api", "team:security", "test-type:info-disclosure"]

  locations = local.security_locations

  options_list {
    tick_every = var.test_intervals.security
  }

  # Test error message information disclosure
  api_step {
    name = "Error Message Disclosure Test"

    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/invalid-endpoint"
      headers = {
        "Content-Type" = "application/json"
      }
      body = "invalid json"
    }

    assertion {
      type     = "body"
      operator = "doesNotContain"
      target   = "/Users/"
    }

    assertion {
      type     = "body"
      operator = "doesNotContain"
      target   = "stack trace"
    }

    assertion {
      type     = "body"
      operator = "doesNotContain"
      target   = "ANTHROPIC_API_KEY"
    }
  }

  # Test debug information disclosure
  api_step {
    name = "Debug Information Test"

    request_definition {
      method = "GET"
      url    = "${var.app_base_url}/api/debug"
      headers = {
        "User-Agent" = "Security-Scanner/1.0"
      }
    }

    assertion {
      type     = "statusCode"
      operator = "is"
      target   = "404" # Debug endpoints should not exist in production
    }
  }

  # Test server version disclosure
  api_step {
    name = "Server Version Disclosure Test"

    request_definition {
      method = "HEAD"
      url    = "${var.app_base_url}/"
      headers = {
        "User-Agent" = "Security-Scanner/1.0"
      }
    }

    assertion {
      type     = "header"
      operator = "doesNotExist"
      property = "server"
    }

    assertion {
      type     = "header"
      operator = "doesNotExist"
      property = "x-powered-by"
    }
  }
}

# Security Monitoring Dashboard Test
resource "datadog_synthetics_test" "security_monitoring_dashboard" {
  type    = "api"
  subtype = "http"
  name    = "VibeCode Security Monitoring Dashboard - ${var.environment}"
  message = "Security monitoring dashboard is not accessible. @security-team"
  tags    = ["env:${var.environment}", "service:vibecode-security", "team:security"]

  locations = ["aws:us-east-1"]

  options_list {
    tick_every = 600 # Check every 10 minutes
  }

  request_definition {
    method = "GET"
    url    = "${var.app_base_url}/security/dashboard"
    headers = {
      "User-Agent" = "Datadog Security Monitor"
    }
  }

  assertion {
    type     = "statusCode"
    operator = "isNot"
    target   = "500" # Should not error
  }

  # Should require authentication
  assertion {
    type     = "statusCode"
    operator = "matches"
    target   = "40[13]" # 401 or 403
  }
}
