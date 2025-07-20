terraform {
  required_providers {
    datadog = {
      source  = "DataDog/datadog"
      version = ">= 3.0"
    }
  }
}

provider "datadog" {
  api_key = var.datadog_api_key
  app_key = var.datadog_app_key
}

resource "datadog_synthetics_test" "vibecode_user_journey" {
  name    = "VibeCode Critical User Journey"
  type    = "browser"
  status  = "live"
  message = "Notify @-mention if the critical user journey fails."
  tags    = ["env:production", "app:vibecode", "critical-journey"]

  locations = ["aws:us-east-1"]

  options_list {
    tick_every = 900 # Run every 15 minutes
  }

  request_definition {
    url = var.app_url
  }

  browser_step {
    name  = "Navigate to Login Page"
    type  = "goTo"
    params {
      url = "${var.app_url}/login"
    }
    allow_failure = false
  }

  browser_step {
    name  = "Enter Email"
    type  = "typeText"
    params {
      element = "{\"selector\":\"input[name='email']\",\"type\":\"css\"}"
      value   = "test-user@vibecode.io" # Replace with a test user email
    }
    allow_failure = false
  }

  browser_step {
    name  = "Enter Password"
    type  = "typeText"
    params {
      element = "{\"selector\":\"input[name='password']\",\"type\":\"css\"}"
      value   = "{{ _.secret.vibecode_test_password }}" # Reference to a Datadog secret
    }
    allow_failure = false
  }

  browser_step {
    name  = "Click Login Button"
    type  = "click"
    params {
      element = "{\"selector\":\"button[type='submit']\",\"type\":\"css\"}"
    }
    allow_failure = false
  }

  browser_step {
    name = "Assert Successful Login"
    type = "assertElementPresent"
    params {
       element = "{\"selector\":\"#dashboard-heading\",\"type\":\"css\"}" // Example selector
    }
    allow_failure = false
  }

  browser_step {
    name  = "Type in Chat Input"
    type  = "typeText"
    params {
      element = "{\"selector\":\"textarea[placeholder='Send a message...']\",\"type\":\"css\"}"
      value   = "Hello, can you generate a python script for me?"
    }
    allow_failure = false
  }

  browser_step {
    name = "Click Send Chat Message"
    type = "click"
    params {
      element = "{\"selector\":\"button#send-chat\",\"type\":\"css\"}"
    }
    allow_failure = false
  }

  browser_step {
    name = "Assert AI Response"
    type = "assertElementPresent"
    params {
      element = "{\"selector\":\".ai-response\",\"type\":\"css\"}" // Example selector for AI response container
    }
    allow_failure = false
  }

  browser_step {
    name = "Click Logout Button"
    type = "click"
    params {
      element = "{\"selector\":\"#logout-button\",\"type\":\"css\"}"
    }
    allow_failure = false
  }

  browser_step {
    name = "Assert Successful Logout"
    type = "assertElementPresent"
    params {
      element = "{\"selector\":\"h1:contains('Login')\",\"type\":\"css\"}" // Verify back on login page
    }
    allow_failure = false
  }
}