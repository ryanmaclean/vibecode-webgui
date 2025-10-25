#!/usr/sbin/dtrace -s

/*
 * HTTP Request Latency Monitor for VibeCode
 * Tracks HTTP request timing in Node.js application
 *
 * Usage: sudo ./http-latency.d -p $(pgrep node)
 * Or:    sudo ./http-latency.d (monitors all node processes)
 */

#pragma D option quiet
#pragma D option defaultargs

dtrace:::BEGIN
{
    printf("Monitoring HTTP request latency for VibeCode...\n");
    printf("Hit Ctrl-C to end.\n\n");
    start_time = timestamp;
}

/*
 * Track HTTP request start
 * This captures when an HTTP request handler begins
 */
pid$target:*:*http*request*:entry,
pid$target:*:*handleRequest*:entry
{
    self->req_start = timestamp;
    self->in_request = 1;
    @requests = count();
}

/*
 * Track HTTP request completion
 */
pid$target:*:*http*request*:return,
pid$target:*:*handleRequest*:return
/self->req_start/
{
    this->latency = (timestamp - self->req_start) / 1000000; /* Convert to milliseconds */

    @latency_dist = quantize(this->latency);
    @avg_latency = avg(this->latency);
    @min_latency = min(this->latency);
    @max_latency = max(this->latency);

    /* Categorize latency */
    @fast = sum(this->latency < 100 ? 1 : 0);      /* < 100ms */
    @medium = sum(this->latency >= 100 && this->latency < 500 ? 1 : 0); /* 100-500ms */
    @slow = sum(this->latency >= 500 && this->latency < 1000 ? 1 : 0);  /* 500-1000ms */
    @very_slow = sum(this->latency >= 1000 ? 1 : 0); /* >= 1000ms */

    self->req_start = 0;
    self->in_request = 0;
}

/*
 * Track slow queries (> 1 second)
 */
pid$target:*:*http*request*:return,
pid$target:*:*handleRequest*:return
/self->req_start && ((timestamp - self->req_start) / 1000000) > 1000/
{
    this->latency = (timestamp - self->req_start) / 1000000;
    printf("[%Y] SLOW REQUEST: %d ms\n", walltimestamp, this->latency);
}

/*
 * Report every 10 seconds
 */
tick-10s
{
    printf("\n=== HTTP Request Latency Report (10s) ===\n");
    printf("Timestamp: %Y\n", walltimestamp);
    printf("Total Requests: %@d\n\n", @requests);

    printf("Latency Statistics (ms):\n");
    printf("  Average: %@d ms\n", @avg_latency);
    printf("  Minimum: %@d ms\n", @min_latency);
    printf("  Maximum: %@d ms\n", @max_latency);

    printf("\nLatency Categories:\n");
    printf("  Fast (< 100ms):       %@d requests\n", @fast);
    printf("  Medium (100-500ms):   %@d requests\n", @medium);
    printf("  Slow (500-1000ms):    %@d requests\n", @slow);
    printf("  Very Slow (>= 1000ms): %@d requests\n", @very_slow);

    printf("\nLatency Distribution:\n");
    printa(@latency_dist);

    printf("\n");

    /* Clear aggregations for next interval */
    clear(@requests);
    clear(@latency_dist);
    clear(@avg_latency);
    clear(@min_latency);
    clear(@max_latency);
    clear(@fast);
    clear(@medium);
    clear(@slow);
    clear(@very_slow);
}

/*
 * Final summary on exit
 */
dtrace:::END
{
    this->duration = (timestamp - start_time) / 1000000000; /* Convert to seconds */

    printf("\n=== Final Summary ===\n");
    printf("Monitoring Duration: %d seconds\n", this->duration);
    printf("Total Requests: %@d\n", @requests);

    printf("\nFinal Latency Distribution:\n");
    printa(@latency_dist);
}
