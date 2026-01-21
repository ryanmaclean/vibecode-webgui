#!/bin/bash
START_TIME=$(date +%s)

# Send test start metric to correct StatsD port (8135)
echo "vibecode.test.started:1|c|#test:terminal,env:dev" | nc -u -w0 localhost 8135

# Run the test
node /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-terminal-functionality-post-build.js > /tmp/terminal-test-output.txt 2>&1
TEST_EXIT=$?

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Send metrics
echo "vibecode.test.duration:${DURATION}|ms|#test:terminal,env:dev" | nc -u -w0 localhost 8135

if [ $TEST_EXIT -eq 0 ]; then
  echo "vibecode.test.passed:1|c|#test:terminal,env:dev" | nc -u -w0 localhost 8135
  echo "Test PASSED"
else
  echo "vibecode.test.failed:1|c|#test:terminal,env:dev" | nc -u -w0 localhost 8135
  echo "Test FAILED"
fi

cat /tmp/terminal-test-output.txt
exit $TEST_EXIT
