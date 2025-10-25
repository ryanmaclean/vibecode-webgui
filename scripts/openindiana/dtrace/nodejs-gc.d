#!/usr/sbin/dtrace -s

/*
 * Node.js Garbage Collection Monitor
 * Tracks GC pauses and memory patterns in VibeCode
 *
 * Usage: sudo ./nodejs-gc.d -p $(pgrep node)
 */

#pragma D option quiet
#pragma D option defaultargs

dtrace:::BEGIN
{
    printf("Monitoring Node.js Garbage Collection for VibeCode...\n");
    printf("Hit Ctrl-C to end.\n\n");
    start_time = timestamp;
}

/*
 * Track GC start (various GC types)
 */
pid$target:*:*gc*:entry,
pid$target:*:*GarbageCollection*:entry,
pid$target:*:*Scavenge*:entry,
pid$target:*:*MarkSweep*:entry
{
    self->gc_start = timestamp;
    self->in_gc = 1;
    @gc_count = count();
}

/*
 * Track GC completion
 */
pid$target:*:*gc*:return,
pid$target:*:*GarbageCollection*:return,
pid$target:*:*Scavenge*:return,
pid$target:*:*MarkSweep*:return
/self->gc_start/
{
    this->gc_time = (timestamp - self->gc_start) / 1000000; /* Convert to ms */

    @gc_latency = quantize(this->gc_time);
    @avg_gc_time = avg(this->gc_time);
    @min_gc_time = min(this->gc_time);
    @max_gc_time = max(this->gc_time);
    @total_gc_time = sum(this->gc_time);

    /* Categorize GC pauses */
    @minor_gc = sum(this->gc_time < 10 ? 1 : 0);      /* < 10ms (minor/scavenge) */
    @major_gc = sum(this->gc_time >= 10 ? 1 : 0);     /* >= 10ms (major/mark-sweep) */

    self->gc_start = 0;
    self->in_gc = 0;
}

/*
 * Alert on long GC pauses (> 50ms)
 */
pid$target:*:*gc*:return,
pid$target:*:*GarbageCollection*:return
/self->gc_start && ((timestamp - self->gc_start) / 1000000) > 50/
{
    this->gc_time = (timestamp - self->gc_start) / 1000000;
    printf("[%Y] LONG GC PAUSE: %d ms (PID: %d)\n", walltimestamp, this->gc_time, pid);
}

/*
 * Track memory allocation patterns
 */
pid$target:*:*Allocate*:entry,
pid$target:*:*malloc*:entry
/execname == "node"/
{
    @allocs = count();
    @alloc_size = sum(arg0);
}

/*
 * Track memory deallocation
 */
pid$target:*:*free*:entry,
pid$target:*:*Free*:entry
/execname == "node"/
{
    @frees = count();
}

/*
 * Track heap usage (sample-based)
 */
profile:::tick-1s
/execname == "node"/
{
    /* This is a simplified heap tracking */
    @heap_samples = count();
}

/*
 * Track V8 optimization/deoptimization events
 */
pid$target:*:*Optimize*:entry
{
    @optimizations = count();
}

pid$target:*:*Deoptimize*:entry
{
    @deoptimizations = count();
    printf("[%Y] Function deoptimized (PID: %d)\n", walltimestamp, pid);
}

/*
 * Report every 10 seconds
 */
tick-10s
{
    printf("\n=== Node.js GC Report (10s) ===\n");
    printf("Timestamp: %Y\n\n", walltimestamp);

    printf("Garbage Collection Statistics:\n");
    printf("  Total GC Runs:  %@d\n", @gc_count);
    printf("  Minor GCs:      %@d (< 10ms)\n", @minor_gc);
    printf("  Major GCs:      %@d (>= 10ms)\n", @major_gc);

    printf("\nGC Timing:\n");
    printf("  Average:        %@d ms\n", @avg_gc_time);
    printf("  Minimum:        %@d ms\n", @min_gc_time);
    printf("  Maximum:        %@d ms\n", @max_gc_time);
    printf("  Total GC Time:  %@d ms\n", @total_gc_time);

    printf("\nGC Latency Distribution:\n");
    printa(@gc_latency);

    printf("\nMemory Activity:\n");
    printf("  Allocations:    %@d\n", @allocs);
    printf("  Deallocations:  %@d\n", @frees);
    printf("  Bytes Allocated: %@d\n", @alloc_size);

    printf("\nV8 Optimization:\n");
    printf("  Optimizations:   %@d\n", @optimizations);
    printf("  Deoptimizations: %@d\n", @deoptimizations);

    /* Calculate GC overhead percentage */
    this->interval_ms = 10000;
    this->gc_overhead = (@total_gc_time * 100) / this->interval_ms;
    printf("\nGC Overhead: %d%%\n", this->gc_overhead);

    if (this->gc_overhead > 10) {
        printf("WARNING: GC overhead is high (> 10%%)\n");
    }

    printf("\n");

    /* Clear aggregations */
    clear(@gc_count);
    clear(@gc_latency);
    clear(@avg_gc_time);
    clear(@min_gc_time);
    clear(@max_gc_time);
    clear(@total_gc_time);
    clear(@minor_gc);
    clear(@major_gc);
    clear(@allocs);
    clear(@frees);
    clear(@alloc_size);
    clear(@optimizations);
    clear(@deoptimizations);
}

/*
 * Track specific V8 heap spaces (if symbols available)
 */
pid$target:*:*NewSpace*:*,
pid$target:*:*OldSpace*:*,
pid$target:*:*CodeSpace*:*
{
    @heap_space_activity = count();
}

/*
 * Track promise rejections and errors
 */
pid$target:*:*PromiseReject*:entry,
pid$target:*:*ThrowException*:entry
{
    @errors = count();
    printf("[%Y] Promise rejection or exception (PID: %d)\n", walltimestamp, pid);
}

/*
 * Final summary
 */
dtrace:::END
{
    this->duration = (timestamp - start_time) / 1000000000;

    printf("\n=== Final GC Summary ===\n");
    printf("Monitoring Duration: %d seconds\n", this->duration);
    printf("Total GC Runs: %@d\n", @gc_count);
    printf("Total GC Time: %@d ms\n", @total_gc_time);

    this->total_gc_sec = @total_gc_time / 1000;
    this->total_overhead = (this->total_gc_sec * 100) / this->duration;
    printf("Overall GC Overhead: %d%%\n", this->total_overhead);

    printf("\nFinal GC Latency Distribution:\n");
    printa(@gc_latency);

    printf("\nRecommendations:\n");
    printf("  - If GC overhead > 10%%: Increase heap size (--max-old-space-size)\n");
    printf("  - If Major GCs frequent: Review memory leaks\n");
    printf("  - If Deoptimizations occur: Check hot code paths\n");
}
