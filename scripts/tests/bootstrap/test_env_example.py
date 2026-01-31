"""Default environment values for bootstrap-focused pytest suites."""

DEFAULT_TEST_ENV = {
    "CLUSTER_NAME": "vibecode-test",
    "RESOURCE_GROUP": "vibecode-rg",
    "ACR_NAME": "vibecodeacr",
    "NAMESPACE": "vibecode",
    "LOCATION": "eastus2",
    "STORAGE_CLASS": "default",
    "DD_API_KEY": "test_datadog_api_key_here",
    "DD_SITE": "datadoghq.com",
}
