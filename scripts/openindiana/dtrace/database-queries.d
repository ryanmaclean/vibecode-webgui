#!/usr/sbin/dtrace -s

/*
 * PostgreSQL Query Performance Monitor
 * Tracks database query timing for VibeCode
 *
 * Usage: sudo ./database-queries.d -p $(pgrep postgres)
 * Or:    sudo ./database-queries.d (monitors all postgres processes)
 */

#pragma D option quiet
#pragma D option defaultargs
#pragma D option strsize=4096

dtrace:::BEGIN
{
    printf("Monitoring PostgreSQL queries for VibeCode...\n");
    printf("Hit Ctrl-C to end.\n\n");
    start_time = timestamp;
}

/*
 * Track query execution start
 */
pid$target:*:*exec_simple_query*:entry,
pid$target:*:*pg_plan_query*:entry,
pid$target:*:*ExecutorRun*:entry
{
    self->query_start = timestamp;
    self->in_query = 1;
    @total_queries = count();
}

/*
 * Track query completion
 */
pid$target:*:*exec_simple_query*:return,
pid$target:*:*pg_plan_query*:return,
pid$target:*:*ExecutorRun*:return
/self->query_start/
{
    this->latency = (timestamp - self->query_start) / 1000000; /* Convert to ms */

    @query_latency = quantize(this->latency);
    @avg_query_time = avg(this->latency);
    @min_query_time = min(this->latency);
    @max_query_time = max(this->latency);

    /* Categorize queries by performance */
    @fast_queries = sum(this->latency < 10 ? 1 : 0);      /* < 10ms */
    @medium_queries = sum(this->latency >= 10 && this->latency < 100 ? 1 : 0); /* 10-100ms */
    @slow_queries = sum(this->latency >= 100 ? 1 : 0);    /* >= 100ms */

    self->query_start = 0;
    self->in_query = 0;
}

/*
 * Alert on slow queries (> 100ms)
 */
pid$target:*:*exec_simple_query*:return,
pid$target:*:*ExecutorRun*:return
/self->query_start && ((timestamp - self->query_start) / 1000000) > 100/
{
    this->latency = (timestamp - self->query_start) / 1000000;
    printf("[%Y] SLOW QUERY: %d ms (PID: %d)\n", walltimestamp, this->latency, pid);
}

/*
 * Track vector similarity searches (pgvector)
 */
pid$target:*:*ivfflat*:entry,
pid$target:*:*vector_*:entry
{
    self->vector_start = timestamp;
    @vector_searches = count();
}

pid$target:*:*ivfflat*:return,
pid$target:*:*vector_*:return
/self->vector_start/
{
    this->latency = (timestamp - self->vector_start) / 1000000;
    @vector_latency = quantize(this->latency);
    @avg_vector_time = avg(this->latency);

    self->vector_start = 0;
}

/*
 * Track locks and waits
 */
pid$target:*:*LockAcquire*:entry
{
    self->lock_start = timestamp;
    @lock_attempts = count();
}

pid$target:*:*LockAcquire*:return
/self->lock_start/
{
    this->wait_time = (timestamp - self->lock_start) / 1000000;

    /* Track significant lock waits (> 10ms) */
    @lock_waits = sum(this->wait_time > 10 ? 1 : 0);
    @lock_wait_time = quantize(this->wait_time);

    self->lock_start = 0;
}

/*
 * Track I/O operations
 */
io:::start
/execname == "postgres"/
{
    self->io_start = timestamp;
    @io_ops = count();
}

io:::done
/execname == "postgres" && self->io_start/
{
    this->io_time = (timestamp - self->io_start) / 1000000;
    @io_latency = quantize(this->io_time);
    @avg_io_time = avg(this->io_time);

    /* Separate reads and writes */
    @reads = sum(args[0]->b_flags & B_READ ? 1 : 0);
    @writes = sum(!(args[0]->b_flags & B_READ) ? 1 : 0);

    self->io_start = 0;
}

/*
 * Report every 10 seconds
 */
tick-10s
{
    printf("\n=== Database Performance Report (10s) ===\n");
    printf("Timestamp: %Y\n\n", walltimestamp);

    printf("Query Statistics:\n");
    printf("  Total Queries: %@d\n", @total_queries);
    printf("  Average Time:  %@d ms\n", @avg_query_time);
    printf("  Minimum Time:  %@d ms\n", @min_query_time);
    printf("  Maximum Time:  %@d ms\n", @max_query_time);

    printf("\nQuery Performance Categories:\n");
    printf("  Fast (< 10ms):     %@d\n", @fast_queries);
    printf("  Medium (10-100ms): %@d\n", @medium_queries);
    printf("  Slow (>= 100ms):   %@d\n", @slow_queries);

    printf("\nQuery Latency Distribution:\n");
    printa(@query_latency);

    printf("\nVector Search Statistics:\n");
    printf("  Total Searches: %@d\n", @vector_searches);
    printf("  Average Time:   %@d ms\n", @avg_vector_time);

    printf("\nVector Search Latency Distribution:\n");
    printa(@vector_latency);

    printf("\nLock Statistics:\n");
    printf("  Lock Attempts: %@d\n", @lock_attempts);
    printf("  Lock Waits:    %@d\n", @lock_waits);

    printf("\nLock Wait Time Distribution:\n");
    printa(@lock_wait_time);

    printf("\nI/O Statistics:\n");
    printf("  Total I/O Ops: %@d\n", @io_ops);
    printf("  Reads:         %@d\n", @reads);
    printf("  Writes:        %@d\n", @writes);
    printf("  Average Time:  %@d ms\n", @avg_io_time);

    printf("\nI/O Latency Distribution:\n");
    printa(@io_latency);

    printf("\n");

    /* Clear aggregations */
    clear(@total_queries);
    clear(@query_latency);
    clear(@avg_query_time);
    clear(@min_query_time);
    clear(@max_query_time);
    clear(@fast_queries);
    clear(@medium_queries);
    clear(@slow_queries);
    clear(@vector_searches);
    clear(@vector_latency);
    clear(@avg_vector_time);
    clear(@lock_attempts);
    clear(@lock_waits);
    clear(@lock_wait_time);
    clear(@io_ops);
    clear(@reads);
    clear(@writes);
    clear(@io_latency);
    clear(@avg_io_time);
}

/*
 * Final summary
 */
dtrace:::END
{
    this->duration = (timestamp - start_time) / 1000000000;

    printf("\n=== Final Database Summary ===\n");
    printf("Monitoring Duration: %d seconds\n", this->duration);
    printf("Total Queries: %@d\n", @total_queries);
    printf("Total Vector Searches: %@d\n", @vector_searches);
    printf("Total I/O Operations: %@d\n", @io_ops);
}
