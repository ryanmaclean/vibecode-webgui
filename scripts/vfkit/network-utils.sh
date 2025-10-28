#!/usr/bin/env bash
# Network utilities for Alpine VM setup
# Includes fast downloads with aria2c and DNS testing

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# DNS Testing Functions
# =============================================================================

test_dns_server() {
    local dns_server=$1
    local test_domain=${2:-"google.com"}
    
    if command -v dig &>/dev/null; then
        if dig @"$dns_server" "$test_domain" +time=2 +tries=1 &>/dev/null; then
            return 0
        fi
    elif command -v host &>/dev/null; then
        if timeout 2 host "$test_domain" "$dns_server" &>/dev/null 2>&1; then
            return 0
        fi
    elif command -v nslookup &>/dev/null; then
        if timeout 2 nslookup "$test_domain" "$dns_server" &>/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

test_dns_performance() {
    local dns_server=$1
    local test_domain=${2:-"google.com"}
    
    if ! command -v dig &>/dev/null; then
        echo "N/A"
        return
    fi
    
    local total_time=0
    local successful_queries=0
    
    for i in {1..3}; do
        local query_time=$(dig @"$dns_server" "$test_domain" +time=2 +tries=1 2>/dev/null | \
            grep "Query time:" | awk '{print $4}')
        
        if [[ -n "$query_time" ]]; then
            total_time=$((total_time + query_time))
            ((successful_queries++))
        fi
    done
    
    if [[ $successful_queries -gt 0 ]]; then
        echo $((total_time / successful_queries))
    else
        echo "N/A"
    fi
}

setup_optimal_dns() {
    echo -e "${BLUE}=== Testing DNS Servers ===${NC}"
    echo ""
    
    # DNS servers to test
    declare -A dns_servers=(
        ["Cloudflare"]="1.1.1.1"
        ["Cloudflare_Alt"]="1.0.0.1"
        ["Google"]="8.8.8.8"
        ["Google_Alt"]="8.8.4.4"
        ["Quad9"]="9.9.9.9"
        ["OpenDNS"]="208.67.222.222"
    )
    
    local fastest_dns=""
    local fastest_time=9999
    local working_dns=()
    
    echo "Testing DNS servers for speed and reliability..."
    echo ""
    
    for name in "${!dns_servers[@]}"; do
        local server="${dns_servers[$name]}"
        
        if test_dns_server "$server"; then
            local avg_time=$(test_dns_performance "$server")
            
            if [[ "$avg_time" != "N/A" ]]; then
                echo -e "  ${GREEN}✓${NC} $name ($server): ${avg_time}ms"
                working_dns+=("$server")
                
                if [[ $avg_time -lt $fastest_time ]]; then
                    fastest_time=$avg_time
                    fastest_dns=$server
                fi
            else
                echo -e "  ${GREEN}✓${NC} $name ($server): working (no timing)"
                working_dns+=("$server")
            fi
        else
            echo -e "  ${RED}✗${NC} $name ($server): failed"
        fi
    done
    
    echo ""
    
    if [[ -n "$fastest_dns" ]]; then
        echo -e "${GREEN}Fastest DNS server: $fastest_dns (${fastest_time}ms)${NC}"
        echo "export DNS_PRIMARY=$fastest_dns"
        
        # Find second fastest
        for server in "${working_dns[@]}"; do
            if [[ "$server" != "$fastest_dns" ]]; then
                echo "export DNS_SECONDARY=$server"
                break
            fi
        done
    else
        echo -e "${YELLOW}Using default DNS servers${NC}"
        echo "export DNS_PRIMARY=1.1.1.1"
        echo "export DNS_SECONDARY=8.8.8.8"
    fi
}

# =============================================================================
# Network Speed Testing
# =============================================================================

test_network_speed() {
    echo -e "${BLUE}=== Testing Network Speed ===${NC}"
    echo ""
    
    # Test download speed with a small file
    local test_url="https://speed.cloudflare.com/__down?bytes=10000000"  # 10MB
    
    if command -v aria2c &>/dev/null; then
        echo "Testing download speed with aria2c..."
        local start_time=$(date +%s)
        aria2c --quiet=true --download-result=hide \
            --max-connection-per-server=8 \
            --min-split-size=1M \
            --dir=/tmp \
            --out=speedtest.tmp \
            "$test_url" 2>/dev/null || true
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        if [[ -f /tmp/speedtest.tmp ]]; then
            local size=$(stat -f%z /tmp/speedtest.tmp 2>/dev/null || echo 0)
            rm -f /tmp/speedtest.tmp
            
            if [[ $duration -gt 0 && $size -gt 0 ]]; then
                local speed_mbps=$(awk "BEGIN {printf \"%.2f\", ($size / $duration) / 1048576}")
                echo -e "${GREEN}Download speed: ${speed_mbps} MB/s${NC}"
            fi
        fi
    elif command -v curl &>/dev/null; then
        echo "Testing download speed with curl..."
        curl -o /tmp/speedtest.tmp -w "\nSpeed: %{speed_download} bytes/sec\n" \
            "$test_url" 2>&1 | grep "Speed:" | awk '{printf "%.2f MB/s\n", $2/1048576}'
        rm -f /tmp/speedtest.tmp
    fi
    
    echo ""
}

test_connectivity() {
    echo -e "${BLUE}=== Testing Connectivity ===${NC}"
    echo ""
    
    local test_hosts=(
        "1.1.1.1:cloudflare"
        "8.8.8.8:google"
        "github.com:github"
        "dl-cdn.alpinelinux.org:alpine"
    )
    
    for host_entry in "${test_hosts[@]}"; do
        IFS=':' read -r host label <<< "$host_entry"
        
        if ping -c 1 -W 2 "$host" &>/dev/null; then
            local latency=$(ping -c 3 -W 2 "$host" 2>/dev/null | \
                tail -1 | awk -F'/' '{print $5}' | awk '{print $1}')
            
            if [[ -n "$latency" ]]; then
                echo -e "  ${GREEN}✓${NC} $label ($host): ${latency}ms"
            else
                echo -e "  ${GREEN}✓${NC} $label ($host): reachable"
            fi
        else
            echo -e "  ${RED}✗${NC} $label ($host): unreachable"
        fi
    done
    
    echo ""
}

# =============================================================================
# Fast Download Function using aria2c
# =============================================================================

fast_download() {
    local url=$1
    local output=$2
    local connections=${3:-8}  # Default 8 connections
    
    if ! command -v aria2c &>/dev/null; then
        echo -e "${YELLOW}aria2c not installed, falling back to curl${NC}"
        curl -L -o "$output" "$url"
        return $?
    fi
    
    echo "📥 Downloading with aria2c (${connections} connections)..."
    echo "   URL: $url"
    
    aria2c \
        --max-connection-per-server="$connections" \
        --min-split-size=1M \
        --split="$connections" \
        --file-allocation=none \
        --continue=true \
        --max-tries=3 \
        --retry-wait=2 \
        --timeout=60 \
        --connect-timeout=30 \
        --summary-interval=0 \
        --console-log-level=warn \
        --dir="$(dirname "$output")" \
        --out="$(basename "$output")" \
        "$url"
    
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}✓${NC} Download complete: $(du -h "$output" | cut -f1)"
    else
        echo -e "${RED}✗${NC} Download failed (exit code: $exit_code)"
    fi
    
    return $exit_code
}

# =============================================================================
# Parallel Downloads
# =============================================================================

parallel_downloads() {
    echo -e "${BLUE}=== Parallel Downloads with aria2c ===${NC}"
    echo ""
    
    if ! command -v aria2c &>/dev/null; then
        echo -e "${RED}aria2c is not installed${NC}"
        return 1
    fi
    
    # Input format: "url1|output1 url2|output2 ..."
    local downloads=("$@")
    
    for download in "${downloads[@]}"; do
        IFS='|' read -r url output <<< "$download"
        echo "Queued: $(basename "$output")"
    done
    
    echo ""
    echo "Starting parallel downloads..."
    
    # Create aria2 input file
    local input_file="/tmp/aria2_downloads_$$.txt"
    for download in "${downloads[@]}"; do
        IFS='|' read -r url output <<< "$download"
        echo "$url" >> "$input_file"
        echo "  dir=$(dirname "$output")" >> "$input_file"
        echo "  out=$(basename "$output")" >> "$input_file"
    done
    
    aria2c \
        --input-file="$input_file" \
        --max-concurrent-downloads="${#downloads[@]}" \
        --max-connection-per-server=4 \
        --min-split-size=1M \
        --split=4 \
        --file-allocation=none \
        --continue=true
    
    rm -f "$input_file"
}

# =============================================================================
# Main Function
# =============================================================================

main() {
    case "${1:-}" in
        test-dns)
            setup_optimal_dns
            ;;
        test-speed)
            test_network_speed
            ;;
        test-connectivity)
            test_connectivity
            ;;
        test-all)
            test_connectivity
            echo ""
            setup_optimal_dns
            echo ""
            test_network_speed
            ;;
        download)
            shift
            fast_download "$@"
            ;;
        parallel)
            shift
            parallel_downloads "$@"
            ;;
        *)
            echo "Usage: $0 {test-dns|test-speed|test-connectivity|test-all|download|parallel}"
            echo ""
            echo "Commands:"
            echo "  test-dns           - Test DNS servers and find fastest"
            echo "  test-speed         - Test download speed"
            echo "  test-connectivity  - Test connectivity to common hosts"
            echo "  test-all           - Run all tests"
            echo "  download URL OUT [CONN]  - Fast download with aria2c"
            echo "  parallel URL1|OUT1 URL2|OUT2 ...  - Parallel downloads"
            echo ""
            echo "Examples:"
            echo "  $0 test-all"
            echo "  $0 download https://example.com/file.tar.gz /tmp/file.tar.gz 16"
            echo "  $0 parallel 'https://url1|/tmp/file1' 'https://url2|/tmp/file2'"
            ;;
    esac
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

