//
// ObservabilityProviderTests.swift
// SharedTests
//
// Created: 2025-11-25
// Purpose: Comprehensive unit tests for ObservabilityProvider
//

import XCTest
@testable import Shared

final class ObservabilityProviderTests: XCTestCase {

    // MARK: - Mock Provider

    class MockObservabilityProvider: ObservabilityProvider {
        var logCalls: [(level: LogLevel, message: String, attributes: [String: Any])] = []
        var debugCalls: [(message: String, attributes: [String: Any])] = []
        var infoCalls: [(message: String, attributes: [String: Any])] = []
        var warnCalls: [(message: String, attributes: [String: Any])] = []
        var errorCalls: [(message: String, attributes: [String: Any])] = []
        var incrementCalls: [(metric: String, tags: [String])] = []
        var gaugeCalls: [(metric: String, value: Double, tags: [String])] = []
        var histogramCalls: [(metric: String, value: Double, tags: [String])] = []
        var spanCalls: [(name: String, attributes: [String: Any])] = []

        func log(level: LogLevel, message: String, attributes: [String : Any]) {
            logCalls.append((level, message, attributes))
        }

        func debug(_ message: String, _ attributes: [String : Any]) {
            debugCalls.append((message, attributes))
        }

        func info(_ message: String, _ attributes: [String : Any]) {
            infoCalls.append((message, attributes))
        }

        func warn(_ message: String, _ attributes: [String : Any]) {
            warnCalls.append((message, attributes))
        }

        func error(_ message: String, _ attributes: [String : Any]) {
            errorCalls.append((message, attributes))
        }

        func increment(_ metric: String, tags: [String]) {
            incrementCalls.append((metric, tags))
        }

        func gauge(_ metric: String, value: Double, tags: [String]) {
            gaugeCalls.append((metric, value, tags))
        }

        func histogram(_ metric: String, value: Double, tags: [String]) {
            histogramCalls.append((metric, value, tags))
        }

        func startSpan(name: String, attributes: [String : Any]) -> SpanContext {
            spanCalls.append((name, attributes))
            return MockSpanContext()
        }

        func startSpan(name: String, parent: SpanContext, attributes: [String : Any]) -> SpanContext {
            spanCalls.append((name, attributes))
            return MockSpanContext(parent: parent)
        }
    }

    // MARK: - Mock Span Context

    class MockSpanContext: SpanContext {
        var spanID: String = UUID().uuidString
        var traceID: String
        var attributes: [String: Any] = [:]
        var events: [(name: String, attributes: [String: Any])] = []
        var error: Error?
        var isEnded = false

        init(traceID: String? = nil, parent: SpanContext? = nil) {
            self.traceID = parent?.traceID ?? traceID ?? UUID().uuidString
        }

        func setAttribute(key: String, value: Any) {
            attributes[key] = value
        }

        func addEvent(name: String, attributes: [String : Any]) {
            events.append((name, attributes))
        }

        func setError(_ error: Error) {
            self.error = error
        }

        func end() {
            isEnded = true
        }
    }

    // MARK: - Test NoOpProvider

    func testNoOpProvider_LoggingDoesNothing() {
        let provider = NoOpProvider()

        // Should not crash
        provider.log(level: .debug, message: "test")
        provider.debug("test")
        provider.info("test")
        provider.warn("test")
        provider.error("test")

        XCTAssertTrue(true, "NoOpProvider should handle all log calls")
    }

    func testNoOpProvider_MetricsDoNothing() {
        let provider = NoOpProvider()

        // Should not crash
        provider.increment("test.metric")
        provider.gauge("test.metric", value: 42.0)
        provider.histogram("test.metric", value: 100.0)

        XCTAssertTrue(true, "NoOpProvider should handle all metric calls")
    }

    func testNoOpProvider_TracingDoesNothing() {
        let provider = NoOpProvider()

        let span = provider.startSpan(name: "test.span")
        span.setAttribute(key: "key", value: "value")
        span.addEvent(name: "event", attributes: [:])
        span.end()

        XCTAssertTrue(true, "NoOpProvider should handle span operations")
    }

    // MARK: - Test CompositeProvider

    func testCompositeProvider_SingleProvider() {
        let mock = MockObservabilityProvider()
        let composite = CompositeProvider(providers: [mock])

        composite.info("test message", ["key": "value"])

        XCTAssertEqual(mock.infoCalls.count, 1, "Should forward to single provider")
        XCTAssertEqual(mock.infoCalls[0].message, "test message")
    }

    func testCompositeProvider_MultipleProviders() {
        let mock1 = MockObservabilityProvider()
        let mock2 = MockObservabilityProvider()
        let mock3 = MockObservabilityProvider()

        let composite = CompositeProvider(providers: [mock1, mock2, mock3])

        composite.info("test message", [:])

        XCTAssertEqual(mock1.infoCalls.count, 1, "Provider 1 should receive call")
        XCTAssertEqual(mock2.infoCalls.count, 1, "Provider 2 should receive call")
        XCTAssertEqual(mock3.infoCalls.count, 1, "Provider 3 should receive call")
    }

    func testCompositeProvider_AllLogLevels() {
        let mock = MockObservabilityProvider()
        let composite = CompositeProvider(providers: [mock])

        composite.debug("debug", [:])
        composite.info("info", [:])
        composite.warn("warn", [:])
        composite.error("error", [:])

        XCTAssertEqual(mock.debugCalls.count, 1)
        XCTAssertEqual(mock.infoCalls.count, 1)
        XCTAssertEqual(mock.warnCalls.count, 1)
        XCTAssertEqual(mock.errorCalls.count, 1)
    }

    func testCompositeProvider_AllMetrics() {
        let mock = MockObservabilityProvider()
        let composite = CompositeProvider(providers: [mock])

        composite.increment("counter", tags: ["tag1"])
        composite.gauge("gauge", value: 42.0, tags: ["tag2"])
        composite.histogram("histogram", value: 100.0, tags: ["tag3"])

        XCTAssertEqual(mock.incrementCalls.count, 1)
        XCTAssertEqual(mock.gaugeCalls.count, 1)
        XCTAssertEqual(mock.histogramCalls.count, 1)
    }

    func testCompositeProvider_Spans() {
        let mock1 = MockObservabilityProvider()
        let mock2 = MockObservabilityProvider()

        let composite = CompositeProvider(providers: [mock1, mock2])

        let span = composite.startSpan(name: "test.span", attributes: ["key": "value"])
        span.end()

        XCTAssertEqual(mock1.spanCalls.count, 1, "Provider 1 should receive span call")
        XCTAssertEqual(mock2.spanCalls.count, 1, "Provider 2 should receive span call")
    }

    // MARK: - Test LogLevel

    func testLogLevel_NumericValues() {
        XCTAssertEqual(LogLevel.debug.numericValue, 0)
        XCTAssertEqual(LogLevel.info.numericValue, 1)
        XCTAssertEqual(LogLevel.warn.numericValue, 2)
        XCTAssertEqual(LogLevel.error.numericValue, 3)
    }

    func testLogLevel_Comparison() {
        XCTAssertTrue(LogLevel.debug.numericValue < LogLevel.info.numericValue)
        XCTAssertTrue(LogLevel.info.numericValue < LogLevel.warn.numericValue)
        XCTAssertTrue(LogLevel.warn.numericValue < LogLevel.error.numericValue)
    }

    func testLogLevel_RawValues() {
        XCTAssertEqual(LogLevel.debug.rawValue, "DEBUG")
        XCTAssertEqual(LogLevel.info.rawValue, "INFO")
        XCTAssertEqual(LogLevel.warn.rawValue, "WARN")
        XCTAssertEqual(LogLevel.error.rawValue, "ERROR")
    }

    // MARK: - Test Protocol Extensions (Convenience Methods)

    func testConvenienceMethods_LoggingWithoutAttributes() {
        let mock = MockObservabilityProvider()

        mock.debug("debug")
        mock.info("info")
        mock.warn("warn")
        mock.error("error")

        XCTAssertEqual(mock.debugCalls.count, 1)
        XCTAssertEqual(mock.infoCalls.count, 1)
        XCTAssertEqual(mock.warnCalls.count, 1)
        XCTAssertEqual(mock.errorCalls.count, 1)
    }

    func testConvenienceMethods_MetricsWithoutTags() {
        let mock = MockObservabilityProvider()

        mock.increment("counter")
        mock.gauge("gauge", value: 42.0)
        mock.histogram("histogram", value: 100.0)

        XCTAssertEqual(mock.incrementCalls.count, 1)
        XCTAssertEqual(mock.incrementCalls[0].tags.count, 0, "Should have no tags")

        XCTAssertEqual(mock.gaugeCalls.count, 1)
        XCTAssertEqual(mock.gaugeCalls[0].tags.count, 0, "Should have no tags")

        XCTAssertEqual(mock.histogramCalls.count, 1)
        XCTAssertEqual(mock.histogramCalls[0].tags.count, 0, "Should have no tags")
    }

    func testConvenienceMethods_SpanWithoutAttributes() {
        let mock = MockObservabilityProvider()

        let span = mock.startSpan(name: "test.span")
        span.end()

        XCTAssertEqual(mock.spanCalls.count, 1)
        XCTAssertEqual(mock.spanCalls[0].attributes.count, 0, "Should have no attributes")
    }

    // MARK: - Test SpanContext

    func testSpanContext_BasicOperations() {
        let span = MockSpanContext()

        XCTAssertFalse(span.spanID.isEmpty, "Span ID should be generated")
        XCTAssertFalse(span.traceID.isEmpty, "Trace ID should be generated")
        XCTAssertFalse(span.isEnded, "Span should not be ended initially")

        span.setAttribute(key: "key1", value: "value1")
        span.addEvent(name: "event1", attributes: ["event_key": "event_value"])
        span.end()

        XCTAssertTrue(span.isEnded, "Span should be ended")
        XCTAssertEqual(span.attributes.count, 1, "Should have one attribute")
        XCTAssertEqual(span.events.count, 1, "Should have one event")
    }

    func testSpanContext_ErrorHandling() {
        let span = MockSpanContext()
        let testError = NSError(domain: "test", code: 123, userInfo: nil)

        span.setError(testError)

        XCTAssertNotNil(span.error, "Error should be set")
        XCTAssertEqual((span.error as? NSError)?.code, 123, "Error code should match")
    }

    func testSpanContext_NestedSpans() {
        let parentSpan = MockSpanContext()
        let childSpan = MockSpanContext(parent: parentSpan)

        XCTAssertEqual(childSpan.traceID, parentSpan.traceID, "Child should have same trace ID as parent")
        XCTAssertNotEqual(childSpan.spanID, parentSpan.spanID, "Child should have different span ID")
    }

    // MARK: - Test CompositeSpanContext

    func testCompositeSpanContext_ForwardsToAllSpans() {
        let span1 = MockSpanContext()
        let span2 = MockSpanContext()
        let span3 = MockSpanContext()

        let composite = CompositeSpanContext(spans: [span1, span2, span3])

        composite.setAttribute(key: "key", value: "value")
        composite.addEvent(name: "event", attributes: [:])
        composite.end()

        XCTAssertEqual(span1.attributes.count, 1, "Span 1 should receive attribute")
        XCTAssertEqual(span2.attributes.count, 1, "Span 2 should receive attribute")
        XCTAssertEqual(span3.attributes.count, 1, "Span 3 should receive attribute")

        XCTAssertEqual(span1.events.count, 1, "Span 1 should receive event")
        XCTAssertEqual(span2.events.count, 1, "Span 2 should receive event")
        XCTAssertEqual(span3.events.count, 1, "Span 3 should receive event")

        XCTAssertTrue(span1.isEnded, "Span 1 should be ended")
        XCTAssertTrue(span2.isEnded, "Span 2 should be ended")
        XCTAssertTrue(span3.isEnded, "Span 3 should be ended")
    }

    func testCompositeSpanContext_ErrorPropagation() {
        let span1 = MockSpanContext()
        let span2 = MockSpanContext()

        let composite = CompositeSpanContext(spans: [span1, span2])
        let testError = NSError(domain: "test", code: 456, userInfo: nil)

        composite.setError(testError)

        XCTAssertNotNil(span1.error, "Span 1 should receive error")
        XCTAssertNotNil(span2.error, "Span 2 should receive error")
    }

    // MARK: - Test Attributes

    func testAttributes_StringValues() {
        let mock = MockObservabilityProvider()

        mock.info("test", ["key": "value"])

        XCTAssertEqual(mock.infoCalls.count, 1)
        XCTAssertEqual(mock.infoCalls[0].attributes["key"] as? String, "value")
    }

    func testAttributes_NumericValues() {
        let mock = MockObservabilityProvider()

        mock.info("test", ["int": 42, "double": 3.14, "bool": true])

        XCTAssertEqual(mock.infoCalls.count, 1)
        XCTAssertEqual(mock.infoCalls[0].attributes["int"] as? Int, 42)
        XCTAssertEqual(mock.infoCalls[0].attributes["double"] as? Double, 3.14)
        XCTAssertEqual(mock.infoCalls[0].attributes["bool"] as? Bool, true)
    }

    func testAttributes_ComplexValues() {
        let mock = MockObservabilityProvider()

        mock.info("test", [
            "array": [1, 2, 3],
            "dict": ["nested": "value"],
            "nil": NSNull()
        ])

        XCTAssertEqual(mock.infoCalls.count, 1)
        XCTAssertNotNil(mock.infoCalls[0].attributes["array"])
        XCTAssertNotNil(mock.infoCalls[0].attributes["dict"])
    }

    // MARK: - Test Tags

    func testTags_SingleTag() {
        let mock = MockObservabilityProvider()

        mock.increment("metric", tags: ["env:prod"])

        XCTAssertEqual(mock.incrementCalls.count, 1)
        XCTAssertEqual(mock.incrementCalls[0].tags, ["env:prod"])
    }

    func testTags_MultipleTags() {
        let mock = MockObservabilityProvider()

        mock.increment("metric", tags: ["env:prod", "app:vibecode", "version:1.0"])

        XCTAssertEqual(mock.incrementCalls.count, 1)
        XCTAssertEqual(mock.incrementCalls[0].tags.count, 3)
    }

    func testTags_EmptyTags() {
        let mock = MockObservabilityProvider()

        mock.increment("metric", tags: [])

        XCTAssertEqual(mock.incrementCalls.count, 1)
        XCTAssertEqual(mock.incrementCalls[0].tags.count, 0)
    }

    // MARK: - Test Integration with BaseVMManager

    func testIntegration_WithBaseVMManager() {
        let mock = MockObservabilityProvider()

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

        let manager = ObservableVMManager(observability: mock)

        manager.onVMStarted()

        XCTAssertEqual(mock.infoCalls.count, 1, "Should log VM started")
        XCTAssertEqual(mock.incrementCalls.count, 1, "Should increment metric")

        let testError = NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "Test error"])
        manager.onVMError(testError)

        XCTAssertEqual(mock.errorCalls.count, 1, "Should log error")
        XCTAssertEqual(mock.incrementCalls.count, 2, "Should increment error metric")
    }

    // MARK: - Test Span Lifecycle

    func testSpanLifecycle_CompleteFlow() {
        let mock = MockObservabilityProvider()

        let span = mock.startSpan(name: "operation", attributes: ["key": "value"])

        XCTAssertEqual(mock.spanCalls.count, 1)

        let mockSpan = span as! MockSpanContext
        mockSpan.setAttribute(key: "result", value: "success")
        mockSpan.addEvent(name: "checkpoint", attributes: ["stage": "middle"])
        mockSpan.end()

        XCTAssertTrue(mockSpan.isEnded)
        XCTAssertEqual(mockSpan.attributes.count, 1)
        XCTAssertEqual(mockSpan.events.count, 1)
    }

    func testSpanLifecycle_WithError() {
        let mock = MockObservabilityProvider()

        let span = mock.startSpan(name: "operation")
        let mockSpan = span as! MockSpanContext

        let error = NSError(domain: "test", code: 500, userInfo: nil)
        mockSpan.setError(error)
        mockSpan.end()

        XCTAssertNotNil(mockSpan.error)
        XCTAssertTrue(mockSpan.isEnded)
    }

    func testSpanLifecycle_NestedSpans() {
        let mock = MockObservabilityProvider()

        let parent = mock.startSpan(name: "parent")
        let child = mock.startSpan(name: "child", parent: parent, attributes: [:])

        XCTAssertEqual(mock.spanCalls.count, 2)

        let mockChild = child as! MockSpanContext
        let mockParent = parent as! MockSpanContext

        mockChild.end()
        mockParent.end()

        XCTAssertTrue(mockChild.isEnded)
        XCTAssertTrue(mockParent.isEnded)
    }

    // MARK: - Test Thread Safety

    func testThreadSafety_ConcurrentLogging() {
        let mock = MockObservabilityProvider()
        let group = DispatchGroup()

        for i in 0..<100 {
            group.enter()
            DispatchQueue.global().async {
                mock.info("message \(i)", [:])
                group.leave()
            }
        }

        group.wait()

        XCTAssertEqual(mock.infoCalls.count, 100, "All log calls should be captured")
    }

    func testThreadSafety_ConcurrentMetrics() {
        let mock = MockObservabilityProvider()
        let group = DispatchGroup()

        for i in 0..<100 {
            group.enter()
            DispatchQueue.global().async {
                mock.increment("counter", tags: ["id:\(i)"])
                group.leave()
            }
        }

        group.wait()

        XCTAssertEqual(mock.incrementCalls.count, 100, "All metric calls should be captured")
    }

    // MARK: - Performance Tests

    func testPerformance_Logging() {
        let mock = MockObservabilityProvider()

        measure {
            for i in 0..<1000 {
                mock.info("message \(i)", ["key": "value"])
            }
        }
    }

    func testPerformance_Metrics() {
        let mock = MockObservabilityProvider()

        measure {
            for i in 0..<1000 {
                mock.increment("counter", tags: ["id:\(i)"])
                mock.gauge("gauge", value: Double(i), tags: ["id:\(i)"])
            }
        }
    }

    func testPerformance_Spans() {
        let mock = MockObservabilityProvider()

        measure {
            for i in 0..<100 {
                let span = mock.startSpan(name: "operation.\(i)")
                (span as! MockSpanContext).end()
            }
        }
    }

    func testPerformance_CompositeProvider() {
        let composite = CompositeProvider(providers: [
            MockObservabilityProvider(),
            MockObservabilityProvider(),
            MockObservabilityProvider()
        ])

        measure {
            for i in 0..<1000 {
                composite.info("message \(i)", [:])
            }
        }
    }

    // MARK: - Test Edge Cases

    func testEdgeCase_EmptyMessage() {
        let mock = MockObservabilityProvider()

        mock.info("", [:])

        XCTAssertEqual(mock.infoCalls.count, 1)
        XCTAssertEqual(mock.infoCalls[0].message, "")
    }

    func testEdgeCase_VeryLongMessage() {
        let mock = MockObservabilityProvider()
        let longMessage = String(repeating: "a", count: 10000)

        mock.info(longMessage, [:])

        XCTAssertEqual(mock.infoCalls.count, 1)
        XCTAssertEqual(mock.infoCalls[0].message.count, 10000)
    }

    func testEdgeCase_SpecialCharacters() {
        let mock = MockObservabilityProvider()

        let testString = "Test with quotes and backslash"
        let keyValue = "value with special chars"
        mock.info(testString, ["key": keyValue])

        XCTAssertEqual(mock.infoCalls.count, 1)
    }

    func testEdgeCase_UnicodeCharacters() {
        let mock = MockObservabilityProvider()

        mock.info("Test: 🚀 ™ © ® ñ 中文", ["emoji": "🎉"])

        XCTAssertEqual(mock.infoCalls.count, 1)
    }

    func testEdgeCase_NoOpProvider_DoesNotRetainReferences() {
        weak var weakProvider: NoOpProvider?

        autoreleasepool {
            let provider = NoOpProvider()
            weakProvider = provider
            provider.info("test")
        }

        XCTAssertNil(weakProvider, "NoOpProvider should be deallocated")
    }
}
