/**
 * Mock EventSource for SSE Client Tests
 *
 * This mock provides a complete EventSource implementation for testing
 * Server-Sent Events (SSE) functionality without requiring a real server.
 */

class MockEventSource {
  constructor(url, options) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.listeners = {};
    this.options = options || {};
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.withCredentials = this.options.withCredentials || false;
  }

  addEventListener(event, listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  removeEventListener(event, listener) {
    if (!this.listeners[event]) return;
    const index = this.listeners[event].indexOf(listener);
    if (index > -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  dispatchEvent(event) {
    const eventType = event.type || 'message';

    // Call property handlers (onopen, onmessage, onerror)
    if (eventType === 'open' && this.onopen) {
      this.onopen(event);
    } else if (eventType === 'message' && this.onmessage) {
      this.onmessage(event);
    } else if (eventType === 'error' && this.onerror) {
      this.onerror(event);
    }

    // Call addEventListener handlers
    if (this.listeners[eventType]) {
      this.listeners[eventType].forEach(listener => listener(event));
    }

    return true;
  }

  close() {
    this.readyState = 2; // CLOSED
  }
}

// EventSource constants
MockEventSource.CONNECTING = 0;
MockEventSource.OPEN = 1;
MockEventSource.CLOSED = 2;

module.exports = MockEventSource;
