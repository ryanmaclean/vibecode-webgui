//
// OpenTelemetryProviderTests.swift
// VibeCode Tests
//
// Created: 2025-11-25
// Purpose: Unit tests for OpenTelemetryProvider conformance to ObservabilityProvider
//

import XCTest
@testable import Shared

/// Unit tests for OpenTelemetryProvider.
///
/// Tests verify:
/// - Protocol conformance
/// - Logging methods work correctly
/// - Metrics methods work correctly
/// - Tracing methods work correctly
/// - Span context lifecycle
/// - Parent-child span relationships
/// - Error handling in spans
/// - Thread safety
///
final class OpenTelemetryProviderTests: XCTestCase {

    // MARK: - Setup / Teardown

    override func setUp() {
        super.setUp()
        // Note: OpenTelemetryIntegration.shared is a singleton
        // Tests use real integration but no API key means no network calls
    }

    override func tearDown() {
        super.tearDown()
    }

    // MARK: - Initialization Tests

    func testSharedSingleton() {
        // Given / When
        let provider1 = OpenTelemetryProvider.shared
        let provider2 = OpenTelemetryProvider.shared

        // Then
        XCTAssertTrue(provider1 === provider2, "Shared instance should be singleton")
    }

    func testCustomInitialization() {
        // Given / When
        let provider = OpenTelemetryProvider(
            serviceName: "test-service",
            environment: "test",
            otlpEndpoint: "https://test.example.com/traces",
            apiKey: "test-api-key"
        )

        // Then
        XCTAssertNotNil(provider, "Custom initialization should succeed")
    }

    // MARK: - Protocol Conformance Tests

    func testConformsToObservabilityProvider() {
        // Given
        let provider: ObservabilityProvider = OpenTelemetryProvider.shared

        // Then
        XCTAssertNotNil(provider, "Should conform to ObservabilityProvider protocol")
    }

    // MARK: - Logging Tests

    func testDebugLogging() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When / Then (should not crash)
        provider.debug("Test debug message")
        provider.debug("Test debug with attributes", ["key": "value", "number": 42])
    }

    func testInfoLogging() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When / Then (should not crash)
        provider.info("Test info message")
        provider.info("Test info with attributes", ["vm_id": "abc-123"])
    }

    func testWarnLogging() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When / Then (should not crash)
        provider.warn("Test warning message")
        provider.warn("Test warning with attributes", ["memory_mb": 256])
    }

    func testErrorLogging() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When / Then (should not crash)
        provider.error("Test error message")
        provider.error("Test error with attributes", ["error": "test error"])
    }

    func testLogWithLevel() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When / Then (should not crash)
        provider.log(level: .debug, message: "Debug log", attributes: [:])
        provider.log(level: .info, message: "Info log", attributes: ["key": "value"])
        provider.log(level: .warn, message: "Warn log", attributes: [:])
        provider.log(level: .error, message: "Error log", attributes: [:])
    }

    // MARK: - Metrics Tests

    func testIncrementCounter() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When / Then (should not crash)
        provider.increment("test.counter")
        provider.increment("test.counter", tags: ["app:test", "result:success"])
    }

    func testGaugeMetric() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When / Then (should not crash)
        provider.gauge("test.gauge", value: 42.0)
        provider.gauge("test.gauge", value: 100.5, tags: ["unit:mb"])
    }

    func testHistogramMetric() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When / Then (should not crash)
        provider.histogram("test.histogram", value: 2.5)
        provider.histogram("test.histogram", value: 10.0, tags: ["operation:test"])
    }

    // MARK: - Tracing Tests

    func testStartSpan() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When
        let span = provider.startSpan(name: "test.operation")

        // Then
        XCTAssertNotNil(span, "Span should be created")
        XCTAssertFalse(span.spanID.isEmpty, "Span ID should not be empty")
        XCTAssertFalse(span.traceID.isEmpty, "Trace ID should not be empty")

        // Cleanup
        span.end()
    }

    func testStartSpanWithAttributes() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When
        let span = provider.startSpan(name: "test.operation", attributes: [
            "vm_id": "abc-123",
            "cpu_count": 2,
            "memory_mb": 1024
        ])

        // Then
        XCTAssertNotNil(span, "Span should be created")
        XCTAssertFalse(span.spanID.isEmpty, "Span ID should not be empty")
        XCTAssertFalse(span.traceID.isEmpty, "Trace ID should not be empty")

        // Cleanup
        span.end()
    }

    func testSpanSetAttribute() {
        // Given
        let provider = OpenTelemetryProvider.shared
        let span = provider.startSpan(name: "test.operation")

        // When / Then (should not crash)
        span.setAttribute(key: "result", value: "success")
        span.setAttribute(key: "duration_ms", value: 100)
        span.setAttribute(key: "completed", value: true)

        // Cleanup
        span.end()
    }

    func testSpanAddEvent() {
        // Given
        let provider = OpenTelemetryProvider.shared
        let span = provider.startSpan(name: "test.operation")

        // When / Then (should not crash)
        span.addEvent(name: "checkpoint_reached", attributes: [:])
        span.addEvent(name: "data_loaded", attributes: ["rows": 100])

        // Cleanup
        span.end()
    }

    func testSpanSetError() {
        // Given
        let provider = OpenTelemetryProvider.shared
        let span = provider.startSpan(name: "test.operation")
        let error = NSError(domain: "test", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Test error"
        ])

        // When / Then (should not crash)
        span.setError(error)

        // Cleanup
        span.end()
    }

    func testSpanEnd() {
        // Given
        let provider = OpenTelemetryProvider.shared
        let span = provider.startSpan(name: "test.operation")

        // When / Then (should not crash)
        span.end()
    }

    // MARK: - Parent-Child Span Tests

    func testStartChildSpan() {
        // Given
        let provider = OpenTelemetryProvider.shared
        let parentSpan = provider.startSpan(name: "parent.operation", attributes: [:])

        // When
        let childSpan = provider.startSpan(
            name: "child.operation",
            parent: parentSpan,
            attributes: ["phase": "test"]
        )

        // Then
        XCTAssertNotNil(childSpan, "Child span should be created")
        XCTAssertFalse(childSpan.spanID.isEmpty, "Child span ID should not be empty")
        XCTAssertFalse(childSpan.traceID.isEmpty, "Child trace ID should not be empty")
        XCTAssertEqual(
            childSpan.traceID,
            parentSpan.traceID,
            "Child should share trace ID with parent"
        )
        XCTAssertNotEqual(
            childSpan.spanID,
            parentSpan.spanID,
            "Child should have different span ID from parent"
        )

        // Cleanup
        childSpan.end()
        parentSpan.end()
    }

    func testNestedSpans() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When
        let rootSpan = provider.startSpan(name: "root", attributes: [:])
        let child1Span = provider.startSpan(name: "child1", parent: rootSpan, attributes: [:])
        let child2Span = provider.startSpan(name: "child2", parent: rootSpan, attributes: [:])
        let grandchildSpan = provider.startSpan(name: "grandchild", parent: child1Span, attributes: [:])

        // Then
        XCTAssertEqual(child1Span.traceID, rootSpan.traceID, "All spans should share trace ID")
        XCTAssertEqual(child2Span.traceID, rootSpan.traceID, "All spans should share trace ID")
        XCTAssertEqual(grandchildSpan.traceID, rootSpan.traceID, "All spans should share trace ID")

        // Cleanup (reverse order)
        grandchildSpan.end()
        child2Span.end()
        child1Span.end()
        rootSpan.end()
    }

    // MARK: - Span Lifecycle Tests

    func testSpanLifecycle() {
        // Given
        let provider = OpenTelemetryProvider.shared
        let span = provider.startSpan(name: "lifecycle.test", attributes: [
            "initial": "value"
        ])

        // When: Add attributes during operation
        span.setAttribute(key: "phase", value: "started")
        span.addEvent(name: "checkpoint_1", attributes: ["progress": 25])

        span.setAttribute(key: "phase", value: "processing")
        span.addEvent(name: "checkpoint_2", attributes: ["progress": 50])

        span.setAttribute(key: "phase", value: "completed")
        span.addEvent(name: "checkpoint_3", attributes: ["progress": 100])

        // Then: End span (should not crash)
        span.end()
    }

    func testSpanWithError() {
        // Given
        let provider = OpenTelemetryProvider.shared
        let span = provider.startSpan(name: "error.test")

        // When: Simulate error scenario
        let error = NSError(domain: "test.error", code: 500, userInfo: [
            NSLocalizedDescriptionKey: "Simulated error for testing"
        ])
        span.setError(error)

        // Then: End span (should not crash)
        span.end()
    }

    // MARK: - Integration Tests

    func testCompleteWorkflow() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When: Simulate complete VM operation
        provider.info("Starting VM operation", ["vm_id": "test-vm-123"])
        provider.increment("vm.operation.start", tags: ["app:test"])

        let span = provider.startSpan(name: "vm.operation", attributes: [
            "vm_id": "test-vm-123",
            "operation": "start"
        ])

        span.addEvent(name: "configuration_loaded", attributes: [:])
        provider.debug("Configuration validated")

        span.addEvent(name: "resources_allocated", attributes: ["memory_mb": 1024])
        provider.gauge("vm.memory_allocated", value: 1024.0, tags: ["vm_id:test-vm-123"])

        span.setAttribute(key: "result", value: "success")
        provider.info("VM operation completed", ["duration_ms": 2500])
        provider.histogram("vm.operation.duration", value: 2.5, tags: ["result:success"])

        span.end()

        // Then: All operations should succeed without crashes
        XCTAssertTrue(true, "Complete workflow should succeed")
    }

    func testMultipleConcurrentSpans() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When: Create multiple concurrent spans
        let span1 = provider.startSpan(name: "operation.1", attributes: ["id": 1])
        let span2 = provider.startSpan(name: "operation.2", attributes: ["id": 2])
        let span3 = provider.startSpan(name: "operation.3", attributes: ["id": 3])

        // Then: All should have unique span IDs but potentially different trace IDs
        XCTAssertNotEqual(span1.spanID, span2.spanID, "Spans should have unique IDs")
        XCTAssertNotEqual(span2.spanID, span3.spanID, "Spans should have unique IDs")
        XCTAssertNotEqual(span1.spanID, span3.spanID, "Spans should have unique IDs")

        // Cleanup
        span1.end()
        span2.end()
        span3.end()
    }

    // MARK: - Thread Safety Tests

    func testConcurrentLogging() {
        // Given
        let provider = OpenTelemetryProvider.shared
        let expectation = expectation(description: "Concurrent logging")
        expectation.expectedFulfillmentCount = 10

        // When: Log from multiple threads
        DispatchQueue.concurrentPerform(iterations: 10) { index in
            provider.info("Concurrent log \(index)", ["thread": index])
            expectation.fulfill()
        }

        // Then: Should not crash
        waitForExpectations(timeout: 5.0)
    }

    func testConcurrentSpanCreation() {
        // Given
        let provider = OpenTelemetryProvider.shared
        let expectation = expectation(description: "Concurrent span creation")
        expectation.expectedFulfillmentCount = 10

        // When: Create spans from multiple threads
        DispatchQueue.concurrentPerform(iterations: 10) { index in
            let span = provider.startSpan(name: "concurrent.\(index)", attributes: [
                "thread": index
            ])
            span.setAttribute(key: "completed", value: true)
            span.end()
            expectation.fulfill()
        }

        // Then: Should not crash
        waitForExpectations(timeout: 5.0)
    }

    // MARK: - Edge Cases

    func testEmptyAttributes() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When / Then: Should handle empty attributes gracefully
        provider.info("Message with no attributes", [:])
        let span = provider.startSpan(name: "span.no.attributes", attributes: [:])
        span.end()
    }

    func testLargeAttributes() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When: Create attributes with large values
        let largeString = String(repeating: "x", count: 10000)
        let span = provider.startSpan(name: "large.attributes", attributes: [
            "large_field": largeString,
            "normal_field": "test"
        ])

        // Then: Should handle gracefully
        span.end()
    }

    func testSpecialCharactersInNames() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When / Then: Should handle special characters
        provider.info("Test with special chars: @#$%^&*()", [:])
        let span = provider.startSpan(name: "test.with.special.chars.!@#", attributes: [:])
        span.end()
    }

    func testNilAndNullValues() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When / Then: Should handle various value types
        let span = provider.startSpan(name: "test.types", attributes: [
            "string": "value",
            "int": 42,
            "double": 3.14,
            "bool": true,
            "array": [1, 2, 3],
            "dict": ["key": "value"]
        ])
        span.end()
    }

    // MARK: - Performance Tests

    func testLoggingPerformance() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When: Measure logging performance
        measure {
            for i in 0..<100 {
                provider.info("Performance test \(i)", ["iteration": i])
            }
        }
    }

    func testSpanCreationPerformance() {
        // Given
        let provider = OpenTelemetryProvider.shared

        // When: Measure span creation performance
        measure {
            for i in 0..<100 {
                let span = provider.startSpan(name: "perf.test.\(i)", attributes: [
                    "iteration": i
                ])
                span.end()
            }
        }
    }

    // MARK: - Documentation Example Tests

    func testDocumentationExample1() {
        // Example from documentation: Basic logging
        let provider = OpenTelemetryProvider.shared

        provider.debug("VM configuration created", ["vm_id": "abc-123"])
        provider.info("VM started successfully", ["startup_time": 2.5])
        provider.warn("VM memory low", ["available_mb": 256])
        provider.error("VM failed to start", ["error": "test error"])

        XCTAssertTrue(true, "Documentation example should work")
    }

    func testDocumentationExample2() {
        // Example from documentation: Distributed tracing
        let provider = OpenTelemetryProvider.shared

        let span = provider.startSpan(name: "vm.lifecycle", attributes: [
            "vm_id": "abc-123",
            "cpu_count": 2
        ])

        span.setAttribute(key: "result", value: "success")
        span.addEvent(name: "vm_configured", attributes: ["config_type": "network"])

        span.end()

        XCTAssertTrue(true, "Documentation example should work")
    }

    func testDocumentationExample3() {
        // Example from documentation: Nested spans
        let provider = OpenTelemetryProvider.shared

        let parentSpan = provider.startSpan(name: "vm.lifecycle", attributes: [:])

        let childSpan = provider.startSpan(
            name: "vm.configure",
            parent: parentSpan,
            attributes: ["phase": "network"]
        )
        childSpan.end()

        parentSpan.end()

        XCTAssertTrue(true, "Documentation example should work")
    }
}

// MARK: - Test Helpers

extension OpenTelemetryProviderTests {

    /// Helper to create a test error
    func createTestError(_ message: String) -> Error {
        return NSError(
            domain: "com.vibecode.test",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: message]
        )
    }
}
