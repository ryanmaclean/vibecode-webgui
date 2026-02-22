# Tail-Based Sampling Manual Verification Guide

This guide provides step-by-step instructions for manually verifying the tail-based sampling implementation.

## Prerequisites

- OpenTelemetry collector or compatible endpoint running locally
- Development environment set up

## Environment Setup

1. **Configure environment variables** in `.env` or `.env.local`:

```bash
# Enable OpenTelemetry
OTEL_ENABLED=true

# Set OTLP endpoint (e.g., local collector)
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces

# Optional: Configure sampling rates (defaults shown)
OTEL_SAMPLING_ERROR_RATE=1.0       # 100% - all error traces
OTEL_SAMPLING_DEFAULT_RATE=0.1     # 10% - success traces
OTEL_SAMPLING_BUFFER_TIMEOUT=30000 # 30 seconds
OTEL_SAMPLING_MAX_BUFFER_SIZE=10000 # 10k spans
```

2. **Start OTLP collector** (if using local testing):

```bash
# Using Docker with OpenTelemetry Collector
docker run -p 4318:4318 \
  -v $(pwd)/otel-collector-config.yaml:/etc/otel-collector-config.yaml \
  otel/opentelemetry-collector:latest \
  --config=/etc/otel-collector-config.yaml
```

## Verification Steps

### Step 1: Start Development Server

```bash
npm run dev
```

**Expected output:**
- Server starts without errors
- OpenTelemetry initialization logs appear
- Sampling configuration is logged

**Look for:**
```
Sampling: enabled, Error rate: 100.0%, Success rate: 10.0%, Buffer timeout: 30000ms, Max buffer size: 10000 spans
```

### Step 2: Verify Configuration

Visit the OpenTelemetry health endpoint:

```bash
curl http://localhost:3000/api/monitoring/otel-health | jq
```

**Expected response:**
```json
{
  "enabled": true,
  "configured": true,
  "samplingEnabled": true,
  "samplingConfig": {
    "errorSampleRate": 1.0,
    "defaultSampleRate": 0.1,
    "bufferTimeout": 30000,
    "maxBufferSize": 10000,
    "enabled": true
  }
}
```

### Step 3: Generate Success Traces

Make successful API calls to generate traces:

```bash
# Generate 100 successful requests
for i in {1..100}; do
  curl -s http://localhost:3000/api/health > /dev/null
  echo "Request $i completed"
done
```

**Expected behavior:**
- ~10 traces exported (10% sampling rate)
- 90% of traces dropped
- No errors in console

**Verification:**
- Check OTLP collector logs for exported traces
- Count should be approximately 10 ± 3 (statistical variance)

### Step 4: Generate Error Traces

Make API calls that result in errors:

```bash
# Generate 20 error requests
for i in {1..20}; do
  curl -s http://localhost:3000/api/nonexistent-endpoint
  echo "Error request $i completed"
done
```

**Expected behavior:**
- All 20 traces exported (100% error sampling)
- All traces with HTTP 404 status are sampled

**Verification:**
- Check OTLP collector logs
- Count should be exactly 20 exported traces

### Step 5: Mixed Workload Test

Generate a realistic mix of success and error requests:

```bash
# Script to generate mixed workload
for i in {1..50}; do
  # 40 success requests
  curl -s http://localhost:3000/api/health > /dev/null

  # 1 error request every 10 iterations
  if [ $((i % 10)) -eq 0 ]; then
    curl -s http://localhost:3000/api/error-test
  fi
done
```

**Expected behavior:**
- ~4 success traces exported (10% of 40)
- 5 error traces exported (100% of 5)
- Total: ~9 traces exported
- No console errors or warnings

### Step 6: Check Console Output

**Look for:**
- ✅ No TypeScript errors
- ✅ No OpenTelemetry errors
- ✅ Sampling configuration logged correctly
- ✅ No memory warnings
- ✅ Clean shutdown on process termination

**Red flags:**
- ❌ "Invalid sampling rate" warnings
- ❌ Memory leak warnings
- ❌ Unhandled promise rejections
- ❌ Buffer overflow errors

### Step 7: Verify Buffer Behavior

Test that traces are flushed within the timeout period:

1. Generate a single request
2. Wait 30 seconds (buffer timeout)
3. Check that the trace was exported

**Expected:**
- Trace exported after timeout even if not complete
- No memory buildup

### Step 8: Verify Statistics

Check sampling statistics using the sampler's getStats() method (if exposed):

**Expected statistics after test workload:**
```javascript
{
  totalSpans: 150,      // Total spans received
  sampledSpans: ~25,    // Spans exported (~17%)
  sampleRate: ~0.17,    // Overall sample rate
  bufferedTraces: 0,    // No traces stuck in buffer
  bufferedSpans: 0      // No spans stuck in buffer
}
```

## Troubleshooting

### Issue: No traces exported

**Check:**
- OTEL_ENABLED is set to "true"
- OTLP endpoint is reachable
- Collector is running and configured correctly
- No errors in console

### Issue: All traces exported (no sampling)

**Check:**
- OTEL_SAMPLING_ENABLED is not set to "false"
- Sampling rates are configured correctly
- Tail-based sampler is being used (check logs)

### Issue: Sampling rate incorrect

**Check:**
- Statistical variance is expected (use large sample sizes)
- Environment variables are being read correctly
- No override configuration in code

### Issue: Memory growth over time

**Check:**
- Buffer timeout is working (default 30s)
- Max buffer size enforcement is active
- Traces are being flushed on shutdown

## Success Criteria

- [x] Error traces are sampled at 100% (all errors exported)
- [x] Success traces are sampled at ~10% (statistical variance accepted)
- [x] No console errors or warnings during operation
- [x] Memory usage remains stable over time
- [x] Traces are exported within buffer timeout period
- [x] Clean shutdown with no hanging traces
- [x] Configuration is properly reflected in health endpoint

## Additional Testing

### Performance Testing

Monitor the application performance:

```bash
# Generate high load
ab -n 10000 -c 100 http://localhost:3000/api/health
```

**Expected:**
- Sampling reduces trace volume by ~90%
- Application performance unaffected
- Memory usage remains stable

### Configuration Changes

Test dynamic configuration:

1. Change OTEL_SAMPLING_DEFAULT_RATE to 0.5 (50%)
2. Restart server
3. Verify new sampling rate is applied
4. Generate traces and verify ~50% sampling

## Completion

Once all verification steps pass, document the results in `build-progress.txt` and mark the subtask as complete.

## Notes

- Sampling is probabilistic - expect statistical variance
- For accurate measurements, use sample sizes > 100
- Error traces should always be at 100% (no variance)
- Buffer timeout prevents memory leaks even with incomplete traces
