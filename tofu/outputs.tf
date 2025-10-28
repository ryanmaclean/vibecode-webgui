output "synthetics_test_id" {
  description = "The ID of the VibeCode critical user journey synthetic test."
  value       = datadog_synthetics_test.vibecode_user_journey.id
}