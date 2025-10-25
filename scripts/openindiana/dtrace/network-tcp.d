#!/usr/sbin/dtrace -s

/*
 * TCP Network Monitoring for VibeCode
 * Tracks TCP connections, throughput, and network patterns
 *
 * Usage: sudo ./network-tcp.d
 */

#pragma D option quiet
#pragma D option defaultargs

dtrace:::BEGIN
{
    printf("Monitoring TCP network activity for VibeCode...\n");
    printf("Hit Ctrl-C to end.\n\n");
    start_time = timestamp;
}

/*
 * Track TCP connection establishment
 */
tcp:::connect-request
{
    @connect_attempts = count();
    @connections_by_rhost[args[2]->ip_daddr] = count();
}

tcp:::connect-established
{
    @connections_established = count();
    printf("[%Y] Connection established: %s:%d -> %s:%d\n",
           walltimestamp,
           args[2]->ip_saddr, args[4]->tcp_sport,
           args[2]->ip_daddr, args[4]->tcp_dport);
}

tcp:::connect-refused
{
    @connections_refused = count();
    printf("[%Y] Connection refused: %s:%d\n",
           walltimestamp,
           args[2]->ip_daddr, args[4]->tcp_dport);
}

/*
 * Track TCP data transfer
 */
tcp:::send
{
    @bytes_sent = sum(args[2]->ip_plength);
    @packets_sent = count();
    @send_size = quantize(args[2]->ip_plength);
}

tcp:::receive
{
    @bytes_received = sum(args[2]->ip_plength);
    @packets_received = count();
    @recv_size = quantize(args[2]->ip_plength);
}

/*
 * Track TCP by port (application identification)
 */
tcp:::send
{
    @bytes_sent_by_port[args[4]->tcp_sport] = sum(args[2]->ip_plength);
    @packets_sent_by_port[args[4]->tcp_sport] = count();
}

tcp:::receive
{
    @bytes_received_by_port[args[4]->tcp_dport] = sum(args[2]->ip_plength);
    @packets_received_by_port[args[4]->tcp_dport] = count();
}

/*
 * Track TCP retransmissions
 */
tcp:::send
/args[4]->tcp_flags & TH_PUSH/
{
    @push_packets = count();
}

fbt::tcp_xmit_ctl:entry
{
    @retransmits = count();
    @retransmit_rate = count();
}

/*
 * Track connection termination
 */
tcp:::state-change
/args[3]->tcps_state == TCPS_FIN_WAIT_1/
{
    @fin_sent = count();
}

tcp:::state-change
/args[3]->tcps_state == TCPS_CLOSE_WAIT/
{
    @fin_received = count();
}

tcp:::state-change
/args[3]->tcps_state == TCPS_CLOSED/
{
    @connections_closed = count();
}

/*
 * Track connection states
 */
tcp:::state-change
{
    @state_changes = count();
    @states[args[3]->tcps_state] = count();
}

/*
 * Track TCP errors
 */
tcp:::send
/args[2]->ip_plength == 0/
{
    @zero_window_sent = count();
}

/*
 * Track round-trip time (RTT) - simplified
 */
tcp:::send
{
    self->send_time[args[2]->ip_daddr, args[4]->tcp_dport] = timestamp;
}

tcp:::receive
/self->send_time[args[2]->ip_saddr, args[4]->tcp_sport]/
{
    this->rtt = (timestamp - self->send_time[args[2]->ip_saddr, args[4]->tcp_sport]) / 1000000;
    @rtt = quantize(this->rtt);
    @avg_rtt = avg(this->rtt);
    @min_rtt = min(this->rtt);
    @max_rtt = max(this->rtt);

    self->send_time[args[2]->ip_saddr, args[4]->tcp_sport] = 0;
}

/*
 * Track connections by process
 */
tcp:::send,
tcp:::receive
{
    @traffic_by_process[execname] = count();
    @bytes_by_process[execname] = sum(args[2]->ip_plength);
}

/*
 * Track VNIC-specific traffic (vibecode0)
 */
tcp:::send,
tcp:::receive
{
    /* This would require VNIC context, simplified here */
    @vnic_traffic = count();
}

/*
 * Track connection duration (sampling)
 */
profile:::tick-1s
/curthread->t_procp->p_zone->zone_name == "vibecode-zone"/
{
    @active_connections = count();
}

/*
 * Alert on connection errors
 */
tcp:::connect-refused
{
    printf("[%Y] WARNING: Connection refused to %s:%d\n",
           walltimestamp,
           args[2]->ip_daddr, args[4]->tcp_dport);
}

/*
 * Report every 10 seconds
 */
tick-10s
{
    printf("\n=== TCP Network Report (10s) ===\n");
    printf("Timestamp: %Y\n\n", walltimestamp);

    printf("Connection Statistics:\n");
    printf("  Attempts:       %@d\n", @connect_attempts);
    printf("  Established:    %@d\n", @connections_established);
    printf("  Refused:        %@d\n", @connections_refused);
    printf("  Closed:         %@d\n", @connections_closed);

    printf("\nData Transfer:\n");
    printf("  Bytes Sent:     %@d (%@d MB)\n", @bytes_sent, @bytes_sent / 1048576);
    printf("  Bytes Received: %@d (%@d MB)\n", @bytes_received, @bytes_received / 1048576);
    printf("  Packets Sent:   %@d\n", @packets_sent);
    printf("  Packets Rcvd:   %@d\n", @packets_received);

    /* Calculate throughput */
    this->interval_sec = 10;
    this->send_mbps = (@bytes_sent * 8 / 1048576) / this->interval_sec;
    this->recv_mbps = (@bytes_received * 8 / 1048576) / this->interval_sec;
    printf("\nThroughput:\n");
    printf("  Send:           %d Mbps\n", this->send_mbps);
    printf("  Receive:        %d Mbps\n", this->recv_mbps);

    printf("\nSend Size Distribution:\n");
    printa(@send_size);

    printf("\nReceive Size Distribution:\n");
    printa(@recv_size);

    printf("\nRound-Trip Time (ms):\n");
    printf("  Average:        %@d ms\n", @avg_rtt);
    printf("  Minimum:        %@d ms\n", @min_rtt);
    printf("  Maximum:        %@d ms\n", @max_rtt);

    printf("\nRTT Distribution:\n");
    printa(@rtt);

    printf("\nNetwork Quality:\n");
    printf("  Retransmits:    %@d\n", @retransmits);
    printf("  Zero Windows:   %@d\n", @zero_window_sent);

    /* Calculate packet loss approximation */
    this->total_packets = @packets_sent + @packets_received;
    this->loss_pct = this->total_packets > 0 ?
        (@retransmits * 100) / this->total_packets : 0;
    printf("  Est. Loss Rate: %d%%\n", this->loss_pct);

    printf("\nTop Remote Hosts:\n");
    printa("  %s: %@d connections\n", @connections_by_rhost);

    printf("\nTraffic by Port (Sent):\n");
    printa("  Port %d: %@d packets (%@d bytes)\n",
           @packets_sent_by_port, @bytes_sent_by_port);

    printf("\nTraffic by Port (Received):\n");
    printa("  Port %d: %@d packets (%@d bytes)\n",
           @packets_received_by_port, @bytes_received_by_port);

    printf("\nTraffic by Process:\n");
    printa("  %s: %@d operations (%@d bytes)\n",
           @traffic_by_process, @bytes_by_process);

    printf("\nTCP State Distribution:\n");
    printa("  State %d: %@d\n", @states);

    printf("\n");

    /* Clear aggregations */
    clear(@connect_attempts);
    clear(@connections_established);
    clear(@connections_refused);
    clear(@connections_closed);
    clear(@bytes_sent);
    clear(@bytes_received);
    clear(@packets_sent);
    clear(@packets_received);
    clear(@send_size);
    clear(@recv_size);
    clear(@rtt);
    clear(@avg_rtt);
    clear(@min_rtt);
    clear(@max_rtt);
    clear(@retransmits);
    clear(@zero_window_sent);
    clear(@connections_by_rhost);
    clear(@packets_sent_by_port);
    clear(@bytes_sent_by_port);
    clear(@packets_received_by_port);
    clear(@bytes_received_by_port);
    clear(@traffic_by_process);
    clear(@bytes_by_process);
    clear(@states);
    clear(@state_changes);
}

/*
 * Track listen ports (application servers)
 */
tcp:::accept-established
{
    @listen_ports[args[4]->tcp_dport] = count();
    printf("[%Y] Connection accepted on port %d from %s:%d\n",
           walltimestamp,
           args[4]->tcp_dport,
           args[2]->ip_saddr,
           args[4]->tcp_sport);
}

/*
 * Final summary
 */
dtrace:::END
{
    this->duration = (timestamp - start_time) / 1000000000;

    printf("\n=== Final TCP Summary ===\n");
    printf("Monitoring Duration: %d seconds\n", this->duration);
    printf("Total Connections Established: %@d\n", @connections_established);
    printf("Total Connections Closed: %@d\n", @connections_closed);
    printf("Total Bytes Sent: %@d (%@d MB)\n", @bytes_sent, @bytes_sent / 1048576);
    printf("Total Bytes Received: %@d (%@d MB)\n", @bytes_received, @bytes_received / 1048576);

    this->total_mb = (@bytes_sent + @bytes_received) / 1048576;
    this->avg_mbps = (this->total_mb * 8) / this->duration;
    printf("Average Throughput: %d Mbps\n", this->avg_mbps);

    printf("\nListen Ports:\n");
    printa("  Port %d: %@d connections accepted\n", @listen_ports);

    printf("\nRecommendations:\n");
    printf("  - If retransmit rate > 1%%: Check network quality\n");
    printf("  - If RTT > 100ms: Investigate network latency\n");
    printf("  - If connection refused: Check firewall and service status\n");
    printf("  - Monitor port 3000 for VibeCode application traffic\n");
}
