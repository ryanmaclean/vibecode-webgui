//
// DatadogProviderTests.swift
// SharedTests
//
// Created: 2025-11-25
// Purpose: Comprehensive unit tests for DatadogProvider
//

import XCTest
@testable import Shared

final class DatadogProviderTests: XCTestCase {

    // MARK: - Mock Dependencies

    class MockDatadogLogger: DatadogLogger {
        var logCalls: [(level: String, message: String, attributes: [String: Any])] = []
        var debugCalls: [(message: String, attributes: [String: Any])] = []
        var infoCalls: [(message: String, attributes: [String: Any])] = []
        var warningCalls: [(message: String, attributes: [String: Any])] = []
        var errorCalls: [(message: String, attributes: [String: Any])] = []

        override func log(_ level: String, _ message: String, _ attributes: [String: Any] = [:]) {
            logCalls.append((level, message, attributes))
        }

        override func debug(_ message: String, _ attributes: [String: Any] = [:]) {
            debugCalls.append((message, attributes))
        }

        override func info(_ message: String, _ attributes: [String: Any] = [:]) {
            infoCalls.append((message, attributes))
        }

        override func warning(_ message: String, _ attributes: [String: Any] = [:]) {
            warningCalls.append((message, attributes))
        }

        override func error(_ message: String, _ attributes: [String: Any] = [:]) {
            errorCalls.append((message, attributes))
        }
    }

    class MockDogStatsDClient: DogStatsDClient {
        var incrementCalls: [(metric: String, tags: [String])] = []
        var gaugeCalls: [(metric: String, value: Double, tags: [String])] = []
        var histogramCalls: [(metric: String, value: Double, tags: [String])] = []

        override func increment(_ metric: String, tags: [String] = []) {
            incrementCalls.append((metric, tags))
        }

        override func gauge(_ metric: String, value: Double, tags: [String] = []) {
            gaugeCalls.append((metric, value, tags))
        }

        override func histogram(_ metric: String, value: Double, tags: [String] = []) {
            histogramCalls.append((metric, value, tags))
        }
    }

    // MARK: - Setup

    var mockLogger: MockDatadogLogger!
    var mockMetrics: MockDogStatsDClient!
    var provider: DatadogProvider!

    override func setUp() {
        super.setUp()
        mockLogger = MockDatadogLogger()
        mockMetrics = MockDogStatsDClient()
        provider = DatadogProvider(logger: mockLogger, metrics: mockMetrics)
    }

    override func tearDown() {
        mockLogger = nil
        mockMetrics = nil
        provider = nil
        super.tearDown()
    }

    // MARK: - Test Logging

    func testLogging_DebugLevel() {
        provider.debug("test debug", ["key": "value"])

        XCTAssertEqual(mockLogger.debugCalls.count, 1)
        XCTAssertEqual(mockLogger.debugCalls[0].message, "test debug")
        XCTAssertEqual(mockLogger.debugCalls[0].attributes["key"] as? String, "value")
    }

    func testLogging_InfoLevel() {
        provider.info("test info", ["key": "value"])

        XCTAssertEqual(mockLogger.infoCalls.count, 1)
        XCTAssertEqual(mockLogger.infoCalls[0].message, "test info")
        XCTAssertEqual(mockLogger.infoCalls[0].attributes["key"] as? String, "value")
    }

    func testLogging_WarnLevel() {
        provider.warn("test warn", ["key": "value"])

        XCTAssertEqual(mockLogger.warningCalls.count, 1)
        XCTAssertEqual(mockLogger.warningCalls[0].message, "test warn")
        XCTAssertEqual(mockLogger.warningCalls[0].attributes["key"] as? String, "value")
    }

    func testLogging_ErrorLevel() {
        provider.error("test error", ["key": "value"])

        XCTAssertEqual(mockLogger.errorCalls.count, 1)
        XCTAssertEqual(mockLogger.errorCalls[0].message, "test error")
        XCTAssertEqual(mockLogger.errorCalls[0].attributes["key"] as? String, "value")
    }

    func testLogging_GenericLogMethod() {
        provider.log(level: .debug, message: "debug", attributes: [:])
        provider.log(level: .info, message: "info", attributes: [:])
        provider.log(level: .warn, message: "warn", attributes: [:])
        provider.log(level: .error, message: "error", attributes: [:])

        XCTAssertEqual(mockLogger.logCalls.count, 4)
        XCTAssertEqual(mockLogger.logCalls[0].level, "debug")
        XCTAssertEqual(mockLogger.logCalls[1].level, "info")
        XCTAssertEqual(mockLogger.logCalls[2].level, "warning")
        XCTAssertEqual(mockLogger.logCalls[3].level, "error")
    }

    func testLogging_WithoutAttributes() {
        provider.info("message without attributes")

        XCTAssertEqual(mockLogger.infoCalls.count, 1)
        XCTAssertEqual(mockLogger.infoCalls[0].message, "message without attributes")
    }

    func testLogging_WithComplexAttributes() {
        let attributes: [String: Any] = [
            "string": "value",
            "int": 42,
            "double": 3.14,
            "bool": true,
            "array": [1, 2, 3],
            "dict": ["nested": "value"]
        ]

        provider.info("complex attributes", attributes)

        XCTAssertEqual(mockLogger.infoCalls.count, 1)
        XCTAssertEqual(mockLogger.infoCalls[0].attributes.count, 6)
    }

    // MARK: - Test Metrics

    func testMetrics_Increment() {
        provider.increment("test.counter", tags: ["env:test", "app:vibecode"])

        XCTAssertEqual(mockMetrics.incrementCalls.count, 1)
        XCTAssertEqual(mockMetrics.incrementCalls[0].metric, "test.counter")
        XCTAssertEqual(mockMetrics.incrementCalls[0].tags, ["env:test", "app:vibecode"])
    }

    func testMetrics_IncrementWithoutTags() {
        provider.increment("test.counter")

        XCTAssertEqual(mockMetrics.incrementCalls.count, 1)
        XCTAssertEqual(mockMetrics.incrementCalls[0].metric, "test.counter")
        XCTAssertEqual(mockMetrics.incrementCalls[0].tags.count, 0)
    }

    func testMetrics_Gauge() {
        provider.gauge("test.gauge", value: 42.5, tags: ["host:localhost"])

        XCTAssertEqual(mockMetrics.gaugeCalls.count, 1)
        XCTAssertEqual(mockMetrics.gaugeCalls[0].metric, "test.gauge")
        XCTAssertEqual(mockMetrics.gaugeCalls[0].value, 42.5)
        XCTAssertEqual(mockMetrics.gaugeCalls[0].tags, ["host:localhost"])
    }

    func testMetrics_GaugeWithoutTags() {
        provider.gauge("test.gauge", value: 100.0)

        XCTAssertEqual(mockMetrics.gaugeCalls.count, 1)
        XCTAssertEqual(mockMetrics.gaugeCalls[0].value, 100.0)
        XCTAssertEqual(mockMetrics.gaugeCalls[0].tags.count, 0)
    }

    func testMetrics_Histogram() {
        provider.histogram("test.histogram", value: 250.0, tags: ["endpoint:api"])

        XCTAssertEqual(mockMetrics.histogramCalls.count, 1)
        XCTAssertEqual(mockMetrics.histogramCalls[0].metric, "test.histogram")
        XCTAssertEqual(mockMetrics.histogramCalls[0].value, 250.0)
        XCTAssertEqual(mockMetrics.histogramCalls[0].tags, ["endpoint:api"])
    }

    func testMetrics_HistogramWithoutTags() {
        provider.histogram("test.histogram", value: 500.0)

        XCTAssertEqual(mockMetrics.histogramCalls.count, 1)
        XCTAssertEqual(mockMetrics.histogramCalls[0].value, 500.0)
        XCTAssertEqual(mockMetrics.histogramCalls[0].tags.count, 0)
    }

    // MARK: - Test Tracing

    func testTracing_StartSpan() {
        let span = provider.startSpan(name: "test.operation", attributes: ["key": "value"])

        XCTAssertFalse(span.spanID.isEmpty)
        XCTAssertFalse(span.traceID.isEmpty)
        XCTAssertEqual(span.spanID.count, 16, "Span ID should be 16 hex chars (64-bit)")
        XCTAssertEqual(span.traceID.count, 32, "Trace ID should be 32 hex chars (128-bit)")
    }

    func testTracing_StartSpanWithoutAttributes() {
        let span = provider.startSpan(name: "test.operation")

        XCTAssertFalse(span.spanID.isEmpty)
        XCTAssertFalse(span.traceID.isEmpty)
    }

    func testTracing_NestedSpans() {
        let parentSpan = provider.startSpan(name: "parent.operation", attributes: ["parent": true])
        let childSpan = provider.startSpan(name: "child.operation", parent: parentSpan, attributes: ["child": true])

        XCTAssertEqual(childSpan.traceID, parentSpan.traceID, "Child should have same trace ID")
        XCTAssertNotEqual(childSpan.spanID, parentSpan.spanID, "Child should have different span ID")

        childSpan.end()
        parentSpan.end()
    }

    func testTracing_SpanAttributes() {
        let span = provider.startSpan(name: "test.operation", attributes: ["initial": "value"])
        let datadogSpan = span as! DatadogSpanContext

        datadogSpan.setAttribute(key: "added", value: "new_value")
        datadogSpan.setAttribute(key: "count", value: 42)

        let allAttributes = datadogSpan.getAllAttributes()
        XCTAssertEqual(allAttributes["initial"] as? String, "value")
        XCTAssertEqual(allAttributes["added"] as? String, "new_value")
        XCTAssertEqual(allAttributes["count"] as? Int, 42)

        span.end()
    }

    func testTracing_SpanEvents() {
        let span = provider.startSpan(name: "test.operation")
        let datadogSpan = span as! DatadogSpanContext

        datadogSpan.addEvent(name: "checkpoint1", attributes: ["stage": "start"])
        datadogSpan.addEvent(name: "checkpoint2", attributes: ["stage": "middle"])
        datadogSpan.addEvent(name: "checkpoint3", attributes: ["stage": "end"])

        XCTAssertEqual(datadogSpan.events.count, 3)
        XCTAssertEqual(datadogSpan.events[0].name, "checkpoint1")
        XCTAssertEqual(datadogSpan.events[1].name, "checkpoint2")
        XCTAssertEqual(datadogSpan.events[2].name, "checkpoint3")

        span.end()
    }

    func testTracing_SpanError() {
        let span = provider.startSpan(name: "test.operation")
        let datadogSpan = span as! DatadogSpanContext

        let testError = NSError(domain: "test", code: 500, userInfo: [NSLocalizedDescriptionKey: "Test error"])
        datadogSpan.setError(testError)

        XCTAssertNotNil(datadogSpan.error)
        let allAttributes = datadogSpan.getAllAttributes()
        XCTAssertNotNil(allAttributes["error.type"])
        XCTAssertEqual(allAttributes["error.message"] as? String, "Test error")

        span.end()
    }

    func testTracing_SpanEnd() {
        let span = provider.startSpan(name: "test.operation")
        let datadogSpan = span as! DatadogSpanContext

        let startTime = datadogSpan.startTime

        // Small delay to ensure measurable duration
        Thread.sleep(forTimeInterval: 0.001)

        span.end()

        let endTime = datadogSpan.endTime
        XCTAssertGreaterThan(endTime, startTime, "End time should be after start time")
    }

    func testTracing_SpanEndIdempotent() {
        let span = provider.startSpan(name: "test.operation")

        span.end()
        let firstEndTime = (span as! DatadogSpanContext).endTime

        // Call end again
        span.end()
        let secondEndTime = (span as! DatadogSpanContext).endTime

        XCTAssertEqual(firstEndTime, secondEndTime, "Multiple end() calls should not change end time")
    }

    // MARK: - Test Integration

    func testIntegration_LoggingAndMetrics() {
        provider.info("VM started", ["vm_id": "test-123"])
        provider.increment("vm.start", tags: ["result:success"])

        XCTAssertEqual(mockLogger.infoCalls.count, 1)
        XCTAssertEqual(mockMetrics.incrementCalls.count, 1)
    }

    func testIntegration_LoggingMetricsAndTracing() {
        let span = provider.startSpan(name: "vm.start", attributes: ["vm_id": "test-123"])

        provider.info("VM starting", ["vm_id": "test-123"])
        provider.increment("vm.start.attempt", tags: ["vm_id:test-123"])

        Thread.sleep(forTimeInterval: 0.001)

        provider.info("VM started", ["vm_id": "test-123"])
        provider.increment("vm.start.success", tags: ["vm_id:test-123"])

        span.end()

        XCTAssertEqual(mockLogger.infoCalls.count, 2)
        XCTAssertEqual(mockMetrics.incrementCalls.count, 2)
    }

    func testIntegration_WithBaseVMManager() {
        class ObservableVMManager: BaseVMManager {
            let observability: ObservabilityProvider

            init(observability: ObservabilityProvider) {
                self.observability = observability
                super.init()
            }

            override func onVMStarted() {
                super.onVMStarted()
                observability.info("VM started", ["vm_id": "test-123"])
                observability.increment("vm.start", tags: ["result:success"])
            }

            override func onVMError(_ error: Error) {
                super.onVMError(error)
                observability.error("VM error", ["error": error.localizedDescription])
                observability.increment("vm.error", tags: ["error_type:startup"])
            }
        }

        let manager = ObservableVMManager(observability: provider)

        manager.onVMStarted()

        XCTAssertEqual(mockLogger.infoCalls.count, 1)
        XCTAssertEqual(mockMetrics.incrementCalls.count, 1)

        let testError = NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "Test error"])
        manager.onVMError(testError)

        XCTAssertEqual(mockLogger.errorCalls.count, 1)
        XCTAssertEqual(mockMetrics.incrementCalls.count, 2)
    }

    // MARK: - Test Edge Cases

    func testEdgeCase_EmptyMessage() {
        provider.info("", [:])

        XCTAssertEqual(mockLogger.infoCalls.count, 1)
        XCTAssertEqual(mockLogger.infoCalls[0].message, "")
    }

    func testEdgeCase_VeryLongMessage() {
        let longMessage = String(repeating: "a", count: 10000)

        provider.info(longMessage, [:])

        XCTAssertEqual(mockLogger.infoCalls.count, 1)
        XCTAssertEqual(mockLogger.infoCalls[0].message.count, 10000)
    }

    func testEdgeCase_SpecialCharacters() {
        provider.info("Test: \n\t\r\"'\\", ["key": "value: \n\t\r\"'\\"]])

        XCTAssertEqual(mockLogger.infoCalls.count, 1)
    }

    func testEdgeCase_UnicodeCharacters() {
        provider.info("Test: 🚀 ™ © ® ñ 中文", ["emoji": "🎉"])

        XCTAssertEqual(mockLogger.infoCalls.count, 1)
    }

    func testEdgeCase_EmptyMetricName() {
        provider.increment("", tags: [])

        XCTAssertEqual(mockMetrics.incrementCalls.count, 1)
        XCTAssertEqual(mockMetrics.incrementCalls[0].metric, "")
    }

    func testEdgeCase_EmptySpanName() {
        let span = provider.startSpan(name: "", attributes: [:])

        XCTAssertFalse(span.spanID.isEmpty)
        span.end()
    }

    func testEdgeCase_ZeroMetricValue() {
        provider.gauge("test.metric", value: 0.0, tags: [])

        XCTAssertEqual(mockMetrics.gaugeCalls.count, 1)
        XCTAssertEqual(mockMetrics.gaugeCalls[0].value, 0.0)
    }

    func testEdgeCase_NegativeMetricValue() {
        provider.gauge("test.metric", value: -100.0, tags: [])

        XCTAssertEqual(mockMetrics.gaugeCalls.count, 1)
        XCTAssertEqual(mockMetrics.gaugeCalls[0].value, -100.0)
    }

    func testEdgeCase_VeryLargeMetricValue() {
        provider.histogram("test.metric", value: Double.greatestFiniteMagnitude, tags: [])

        XCTAssertEqual(mockMetrics.histogramCalls.count, 1)
    }

    // MARK: - Test Thread Safety

    func testThreadSafety_ConcurrentLogging() {
        let group = DispatchGroup()

        for i in 0..<100 {
            group.enter()
            DispatchQueue.global().async {
                self.provider.info("message \(i)", ["index": i])
                group.leave()
            }
        }

        group.wait()

        XCTAssertEqual(mockLogger.infoCalls.count, 100, "All log calls should be captured")
    }

    func testThreadSafety_ConcurrentMetrics() {
        let group = DispatchGroup()

        for i in 0..<100 {
            group.enter()
            DispatchQueue.global().async {
                self.provider.increment("counter", tags: ["id:\(i)"])
                group.leave()
            }
        }

        group.wait()

        XCTAssertEqual(mockMetrics.incrementCalls.count, 100, "All metric calls should be captured")
    }

    func testThreadSafety_ConcurrentSpans() {
        let group = DispatchGroup()

        for i in 0..<100 {
            group.enter()
            DispatchQueue.global().async {
                let span = self.provider.startSpan(name: "operation.\(i)")
                span.end()
                group.leave()
            }
        }

        group.wait()

        // Should not crash and should complete successfully
        XCTAssertTrue(true)
    }

    // MARK: - Performance Tests

    func testPerformance_Logging() {
        measure {
            for i in 0..<1000 {
                provider.info("message \(i)", ["key": "value"])
            }
        }
    }

    func testPerformance_Metrics() {
        measure {
            for i in 0..<1000 {
                provider.increment("counter", tags: ["id:\(i)"])
                provider.gauge("gauge", value: Double(i), tags: ["id:\(i)"])
            }
        }
    }

    func testPerformance_Spans() {
        measure {
            for i in 0..<100 {
                let span = provider.startSpan(name: "operation.\(i)")
                span.end()
            }
        }
    }

    // MARK: - Test Span ID and Trace ID Generation

    func testSpanIDGeneration_Uniqueness() {
        let span1 = provider.startSpan(name: "test1")
        let span2 = provider.startSpan(name: "test2")

        XCTAssertNotEqual(span1.spanID, span2.spanID, "Span IDs should be unique")
        XCTAssertNotEqual(span1.traceID, span2.traceID, "Trace IDs should be unique for root spans")

        span1.end()
        span2.end()
    }

    func testSpanIDGeneration_Format() {
        let span = provider.startSpan(name: "test")

        // Span ID should be 16 hex chars
        XCTAssertEqual(span.spanID.count, 16)
        XCTAssertTrue(span.spanID.allSatisfy { $0.isHexDigit })

        // Trace ID should be 32 hex chars
        XCTAssertEqual(span.traceID.count, 32)
        XCTAssertTrue(span.traceID.allSatisfy { $0.isHexDigit })

        span.end()
    }

    // MARK: - Test Protocol Conformance

    func testProtocolConformance_ObservabilityProvider() {
        let observability: ObservabilityProvider = provider

        // Should be able to use as ObservabilityProvider
        observability.info("test", [:])
        observability.increment("test.metric", tags: [])
        let span = observability.startSpan(name: "test")
        span.end()

        XCTAssertEqual(mockLogger.infoCalls.count, 1)
        XCTAssertEqual(mockMetrics.incrementCalls.count, 1)
    }

    func testProtocolConformance_ConvenienceMethods() {
        let observability: ObservabilityProvider = provider

        // Test convenience methods
        observability.debug("debug")
        observability.info("info")
        observability.warn("warn")
        observability.error("error")

        observability.increment("counter")
        observability.gauge("gauge", value: 42.0)
        observability.histogram("histogram", value: 100.0)

        let span = observability.startSpan(name: "test")
        span.end()

        XCTAssertEqual(mockLogger.debugCalls.count, 1)
        XCTAssertEqual(mockLogger.infoCalls.count, 1)
        XCTAssertEqual(mockLogger.warningCalls.count, 1)
        XCTAssertEqual(mockLogger.errorCalls.count, 1)
    }
}

// MARK: - Character Extension

private extension Character {
    var isHexDigit: Bool {
        return self.isHexDigit || ("a"..."f").contains(self) || ("A"..."F").contains(self)
    }
}
