#!/usr/sbin/dtrace -s

/*
 * ZFS I/O Performance Monitor for VibeCode
 * Tracks ZFS I/O patterns, latency, and ARC effectiveness
 *
 * Usage: sudo ./zfs-io.d
 */

#pragma D option quiet

dtrace:::BEGIN
{
    printf("Monitoring ZFS I/O for VibeCode...\n");
    printf("Hit Ctrl-C to end.\n\n");
    start_time = timestamp;
}

/*
 * Track I/O requests to ZFS
 */
io:::start
/args[0]->b_file && stringof(args[0]->b_file->fi_pathname) == "<ZFS>"/
{
    self->io_start = timestamp;
    this->size = args[0]->b_bcount;

    /* Track reads vs writes */
    @total_ops = count();
    @reads = sum(args[0]->b_flags & B_READ ? 1 : 0);
    @writes = sum(!(args[0]->b_flags & B_READ) ? 1 : 0);

    /* Track I/O sizes */
    @io_size = quantize(this->size);
    @total_bytes = sum(this->size);
    @read_bytes = sum(args[0]->b_flags & B_READ ? this->size : 0);
    @write_bytes = sum(!(args[0]->b_flags & B_READ) ? this->size : 0);
}

/*
 * Track I/O completion and latency
 */
io:::done
/self->io_start/
{
    this->latency = (timestamp - self->io_start) / 1000000; /* Convert to ms */
    this->is_read = args[0]->b_flags & B_READ;

    /* Overall latency */
    @io_latency = quantize(this->latency);
    @avg_latency = avg(this->latency);
    @min_latency = min(this->latency);
    @max_latency = max(this->latency);

    /* Separate read and write latency */
    @read_latency = quantize(this->is_read ? this->latency : 0);
    @write_latency = quantize(!this->is_read ? this->latency : 0);
    @avg_read_latency = avg(this->is_read ? this->latency : 0);
    @avg_write_latency = avg(!this->is_read ? this->latency : 0);

    /* Alert on slow I/O (> 100ms) */
    this->slow = this->latency > 100 ? 1 : 0;
    @slow_io = sum(this->slow);

    self->io_start = 0;
}

/*
 * Alert on very slow I/O (> 100ms)
 */
io:::done
/self->io_start && ((timestamp - self->io_start) / 1000000) > 100/
{
    this->latency = (timestamp - self->io_start) / 1000000;
    this->type = args[0]->b_flags & B_READ ? "READ" : "WRITE";
    this->size = args[0]->b_bcount;

    printf("[%Y] SLOW I/O: %s %d bytes in %d ms\n",
           walltimestamp, this->type, this->size, this->latency);
}

/*
 * Track ZFS ARC hits and misses
 */
fbt::arc_read:entry
{
    self->arc_lookup = timestamp;
    @arc_lookups = count();
}

fbt::arc_read:return
/self->arc_lookup/
{
    /* arg1 contains hit/miss information in some contexts */
    @arc_activity = count();
    self->arc_lookup = 0;
}

/*
 * Track per-process I/O
 */
io:::start
/args[0]->b_file && stringof(args[0]->b_file->fi_pathname) == "<ZFS>"/
{
    @io_by_process[execname] = count();
    @bytes_by_process[execname] = sum(args[0]->b_bcount);
}

/*
 * Track I/O by zone (if applicable)
 */
io:::start
/args[0]->b_file && stringof(args[0]->b_file->fi_pathname) == "<ZFS>" && zonename != "global"/
{
    @io_by_zone[zonename] = count();
    @bytes_by_zone[zonename] = sum(args[0]->b_bcount);
}

/*
 * Track I/O patterns by size categories
 */
io:::start
/args[0]->b_file && stringof(args[0]->b_file->fi_pathname) == "<ZFS>"/
{
    this->size = args[0]->b_bcount;

    @small_io = sum(this->size < 4096 ? 1 : 0);          /* < 4KB */
    @medium_io = sum(this->size >= 4096 && this->size < 131072 ? 1 : 0); /* 4KB-128KB */
    @large_io = sum(this->size >= 131072 ? 1 : 0);       /* >= 128KB */
}

/*
 * Track synchronous vs asynchronous I/O
 */
io:::start
/args[0]->b_file && stringof(args[0]->b_file->fi_pathname) == "<ZFS>"/
{
    @sync_io = sum(args[0]->b_flags & B_ASYNC ? 0 : 1);
    @async_io = sum(args[0]->b_flags & B_ASYNC ? 1 : 0);
}

/*
 * Sample ZFS ARC statistics
 */
profile:::tick-10s
{
    /* Sample ARC size */
    this->arc_size = `arc_stats.arcstat_size.value.ui64;
    this->arc_c = `arc_stats.arcstat_c.value.ui64;
    this->arc_hits = `arc_stats.arcstat_hits.value.ui64;
    this->arc_misses = `arc_stats.arcstat_misses.value.ui64;

    @arc_size_samples = avg(this->arc_size);
    @arc_c_samples = avg(this->arc_c);

    /* Calculate hit ratio */
    this->total = this->arc_hits + this->arc_misses;
    this->hit_ratio = this->total > 0 ? (this->arc_hits * 100) / this->total : 0;
    @arc_hit_ratio = avg(this->hit_ratio);
}

/*
 * Report every 10 seconds
 */
tick-10s
{
    printf("\n=== ZFS I/O Report (10s) ===\n");
    printf("Timestamp: %Y\n\n", walltimestamp);

    printf("I/O Statistics:\n");
    printf("  Total I/O Ops:  %@d\n", @total_ops);
    printf("  Reads:          %@d\n", @reads);
    printf("  Writes:         %@d\n", @writes);
    printf("  Slow I/O:       %@d (> 100ms)\n", @slow_io);

    printf("\nI/O Throughput:\n");
    printf("  Total Bytes:    %@d (%@d MB)\n", @total_bytes, @total_bytes / 1048576);
    printf("  Read Bytes:     %@d (%@d MB)\n", @read_bytes, @read_bytes / 1048576);
    printf("  Write Bytes:    %@d (%@d MB)\n", @write_bytes, @write_bytes / 1048576);

    printf("\nI/O Latency (ms):\n");
    printf("  Average:        %@d ms\n", @avg_latency);
    printf("  Minimum:        %@d ms\n", @min_latency);
    printf("  Maximum:        %@d ms\n", @max_latency);
    printf("  Avg Read:       %@d ms\n", @avg_read_latency);
    printf("  Avg Write:      %@d ms\n", @avg_write_latency);

    printf("\nI/O Latency Distribution:\n");
    printa(@io_latency);

    printf("\nI/O Size Distribution:\n");
    printa(@io_size);

    printf("\nI/O by Size Category:\n");
    printf("  Small (< 4KB):    %@d\n", @small_io);
    printf("  Medium (4-128KB): %@d\n", @medium_io);
    printf("  Large (>= 128KB): %@d\n", @large_io);

    printf("\nI/O by Type:\n");
    printf("  Synchronous:    %@d\n", @sync_io);
    printf("  Asynchronous:   %@d\n", @async_io);

    printf("\nZFS ARC Statistics:\n");
    printf("  Lookups:        %@d\n", @arc_lookups);
    printf("  Hit Ratio:      %@d%%\n", @arc_hit_ratio);
    printf("  ARC Size:       %@d MB\n", @arc_size_samples / 1048576);
    printf("  ARC Target:     %@d MB\n", @arc_c_samples / 1048576);

    printf("\nTop Processes by I/O:\n");
    printa("  %s: %@d ops (%@d bytes)\n", @io_by_process, @bytes_by_process);

    printf("\nI/O by Zone:\n");
    printa("  %s: %@d ops (%@d bytes)\n", @io_by_zone, @bytes_by_zone);

    printf("\n");

    /* Clear most aggregations (keep cumulative ones) */
    clear(@total_ops);
    clear(@reads);
    clear(@writes);
    clear(@slow_io);
    clear(@total_bytes);
    clear(@read_bytes);
    clear(@write_bytes);
    clear(@io_latency);
    clear(@avg_latency);
    clear(@min_latency);
    clear(@max_latency);
    clear(@read_latency);
    clear(@write_latency);
    clear(@avg_read_latency);
    clear(@avg_write_latency);
    clear(@io_size);
    clear(@small_io);
    clear(@medium_io);
    clear(@large_io);
    clear(@sync_io);
    clear(@async_io);
    clear(@arc_lookups);
    clear(@io_by_process);
    clear(@bytes_by_process);
    clear(@io_by_zone);
    clear(@bytes_by_zone);
}

/*
 * Final summary
 */
dtrace:::END
{
    this->duration = (timestamp - start_time) / 1000000000;

    printf("\n=== Final ZFS I/O Summary ===\n");
    printf("Monitoring Duration: %d seconds\n", this->duration);
    printf("Total I/O Operations: %@d\n", @total_ops);
    printf("Total Bytes: %@d (%@d MB)\n", @total_bytes, @total_bytes / 1048576);

    this->throughput_mbps = (@total_bytes / 1048576) / this->duration;
    printf("Average Throughput: %d MB/s\n", this->throughput_mbps);

    printf("\nFinal ARC Hit Ratio: %@d%%\n", @arc_hit_ratio);

    printf("\nRecommendations:\n");
    printf("  - If ARC hit ratio < 85%%: Consider increasing ARC size\n");
    printf("  - If slow I/O frequent: Check disk health and pool status\n");
    printf("  - If small I/O high: Consider increasing recordsize for datasets\n");
    printf("  - If sync I/O high: Review application sync settings\n");
}
