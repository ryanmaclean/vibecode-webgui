#!/usr/bin/env bash

#####################################################################
# VM Management Menu - Consolidates 48+ vfkit scripts
# Sections: vfkit Operations, Lima, Benchmarks, Quick Actions
#####################################################################

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="${PROJECT_ROOT}"
VFKIT_DIR="${SCRIPTS_DIR}/vfkit"
BENCHMARK_DIR="${SCRIPTS_DIR}/benchmarks"

#####################################################################
# VM Management Menu Display
#####################################################################

show_vm_menu() {
    while true; do
        clear
        echo -e "${CYAN}${BOLD}"
        echo "╔════════════════════════════════════════════════════════════════╗"
        echo "║                    VM MANAGEMENT SYSTEM                         ║"
        echo "║                  vfkit • Lima • Benchmarks                      ║"
        echo "╚════════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"

        print_section_header "Quick Actions"
        print_menu_item "1" "Create & Launch VibeCode VM (Quick)" "$GREEN"
        print_menu_item "2" "Launch Alpine VM" "$GREEN"
        print_menu_item "3" "VM Status Check" "$CYAN"
        print_menu_item "4" "Stop All VMs" "$RED"

        print_section_header "vfkit Setup & Installation"
        print_menu_item "11" "Setup vfkit (Initial)" "$BLUE"
        print_menu_item "12" "Install Alpine VM" "$BLUE"
        print_menu_item "13" "Install AI Tools VM" "$MAGENTA"
        print_menu_item "14" "Install VSCode Server VM" "$BLUE"

        print_section_header "Alpine-based VMs"
        print_menu_item "21" "Download Alpine Kernel" "$CYAN"
        print_menu_item "22" "Create Alpine Rootfs" "$CYAN"
        print_menu_item "23" "Launch Alpine VM" "$GREEN"
        print_menu_item "24" "Create Optimized Alpine VM" "$MAGENTA"
        print_menu_item "25" "Upgrade to Alpine 3.22" "$YELLOW"

        print_section_header "Specialized VMs"
        print_menu_item "31" "Create Node 24 VM" "$BLUE"
        print_menu_item "32" "Create VSCode Server VM" "$BLUE"
        print_menu_item "33" "Create Busybox VM" "$CYAN"
        print_menu_item "34" "Create Minimal VM" "$CYAN"
        print_menu_item "35" "Create Ultra-Minimal VM" "$MAGENTA"
        print_menu_item "36" "Create Fun Demo VM" "$GREEN"

        print_section_header "Advanced VM Operations"
        print_menu_item "41" "Build AI Tools VM (Complete)" "$MAGENTA"
        print_menu_item "42" "Create Persistent VM" "$BLUE"
        print_menu_item "43" "Create Preinstalled VM" "$BLUE"
        print_menu_item "44" "Build Minimal Kernel (Docker)" "$YELLOW"
        print_menu_item "45" "Build Busybox Node (Docker)" "$YELLOW"

        print_section_header "Performance & Benchmarks"
        print_menu_item "51" "Run Basic Performance Test" "$CYAN"
        print_menu_item "52" "Run Comprehensive Performance Test" "$MAGENTA"
        print_menu_item "53" "Compare Boot Times" "$CYAN"
        print_menu_item "54" "M-Series Performance Test" "$YELLOW"
        print_menu_item "55" "Continuous Performance Monitor" "$BLUE"
        print_menu_item "56" "Benchmark Validation" "$CYAN"
        print_menu_item "57" "All Benchmarks Menu" "$MAGENTA"

        print_section_header "Lima Operations"
        print_menu_item "61" "Lima Build" "$GREEN"
        print_menu_item "62" "Lima Kernel Build" "$YELLOW"
        print_menu_item "63" "Automate Lima VibeCode" "$MAGENTA"

        print_section_header "Kernel & Build Tools"
        print_menu_item "71" "Build Minimal Kernel" "$YELLOW"
        print_menu_item "72" "Analyze Kernel Optimization" "$CYAN"
        print_menu_item "73" "Build ARM64 Kernel (6.17)" "$YELLOW"
        print_menu_item "74" "Build ARMv7 Kernel (6.17)" "$YELLOW"

        print_section_header "Comparisons & Analysis"
        print_menu_item "81" "Compare Busybox vs Alpine" "$CYAN"
        print_menu_item "82" "Compare VSCode Builds" "$CYAN"
        print_menu_item "83" "Detailed Performance Test" "$MAGENTA"

        echo
        print_menu_item "0" "Back to Main Menu" "$RED"
        echo

        read -rp "Select VM operation: " choice

        case $choice in
            # Quick Actions
            1) run_vfkit_script "05-launch-vibecode-vm.sh" ;;
            2) run_vfkit_script "04-launch-alpine-vm.sh" ;;
            3) show_vm_status ;;
            4) stop_all_vms ;;

            # Setup & Installation
            11) run_vfkit_script "01-setup-vfkit.sh" ;;
            12) run_vfkit_script "install-alpine-vm.sh" ;;
            13) run_vfkit_script "install-ai-tools-vfkit.sh" ;;
            14) run_vfkit_script "install-vscode-server.sh" ;;

            # Alpine VMs
            21) run_vfkit_script "02-download-alpine-kernel.sh" ;;
            22) run_vfkit_script "03-create-alpine-rootfs.sh" ;;
            23) run_vfkit_script "04-launch-alpine-vm.sh" ;;
            24) run_vfkit_script "create-optimized-alpine-vm.sh" ;;
            25) run_vfkit_script "10-upgrade-to-alpine-3.22.sh" ;;

            # Specialized VMs
            31) run_vfkit_script "09-launch-node24-vm.sh" ;;
            32) run_vfkit_script "13-launch-vscode-server-vm.sh" ;;
            33) run_vfkit_script "create-busybox-vm.sh" ;;
            34) run_vfkit_script "create-minimal-alpine-vm.sh" ;;
            35) run_vfkit_script "create-ultra-minimal-vm.sh" ;;
            36) run_vfkit_script "14-create-fun-demo-rootfs.sh" ;;

            # Advanced Operations
            41) run_vfkit_script "build-ai-tools-vm-complete.sh" ;;
            42) run_vfkit_script "07-create-persistent-vm.sh" ;;
            43) run_vfkit_script "create-preinstalled-vm.sh" ;;
            44) run_vfkit_script "11-build-minimal-kernel-docker.sh" ;;
            45) run_vfkit_script "build-busybox-node-docker.sh" ;;

            # Performance & Benchmarks
            51) run_vfkit_script "basic-performance-test.sh" ;;
            52) run_vfkit_script "comprehensive-performance-test.sh" ;;
            53) run_vfkit_script "compare-boot-times.sh" ;;
            54) run_benchmark_script "m-series-performance-test.sh" ;;
            55) run_vfkit_script "continuous-performance-monitor.sh" ;;
            56) run_vfkit_script "benchmark-validation.sh" ;;
            57) show_benchmarks_menu ;;

            # Lima
            61) run_script "lima-build.sh" ;;
            62) run_script "lima-kernel-build.sh" ;;
            63) run_script "automate-lima-vibecode.sh" ;;

            # Kernel & Build
            71) run_vfkit_script "11-build-minimal-kernel.sh" ;;
            72) run_vfkit_script "analyze-kernel-optimization.sh" ;;
            73) run_benchmark_script "build-and-validate-arm64-6.17.sh" ;;
            74) run_benchmark_script "build-armv7-6.17-complete.sh" ;;

            # Comparisons
            81) run_vfkit_script "compare-busybox-alpine.sh" ;;
            82) run_benchmark_script "compare-vscode-builds.sh" ;;
            83) run_vfkit_script "detailed-performance-test.sh" ;;

            0) return ;;
            *)
                echo -e "${RED}Invalid option. Please try again.${NC}"
                sleep 1
                ;;
        esac
    done
}

#####################################################################
# Benchmarks Submenu
#####################################################################

show_benchmarks_menu() {
    while true; do
        clear
        echo -e "${MAGENTA}${BOLD}Benchmark & Performance Testing${NC}\n"

        print_menu_item "1" "Boot Latency Benchmark" "$CYAN"
        print_menu_item "2" "Firecracker Benchmark" "$CYAN"
        print_menu_item "3" "Build MiniVim Kernel" "$YELLOW"
        print_menu_item "4" "Build Neovim Initramfs" "$YELLOW"
        print_menu_item "5" "OpenVSCode Benchmark" "$CYAN"
        print_menu_item "6" "Docker MUSL vs GLIBC Comparison" "$CYAN"
        print_menu_item "7" "Noisy Neighbor Experiment" "$MAGENTA"
        print_menu_item "8" "Datadog Integration Test" "$BLUE"
        print_menu_item "0" "Back" "$RED"
        echo

        read -rp "Select benchmark: " choice

        case $choice in
            1) run_benchmark_script "boot_latency_bench.py" ;;
            2) run_benchmark_script "firecracker_bench.py" ;;
            3) run_benchmark_script "build-minivim-kernel-6.17.sh" ;;
            4) run_benchmark_script "build-neovim-initramfs.sh" ;;
            5) run_benchmark_script "openvscode-benchmark.sh" ;;
            6) run_benchmark_script "docker-musl-vs-glibc.sh" ;;
            7) run_benchmark_script "noisy-neighbor-experiment.sh" ;;
            8) run_benchmark_script "emit_to_datadog.py" ;;
            0) return ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                sleep 1
                ;;
        esac
    done
}

#####################################################################
# VM Status & Control
#####################################################################

show_vm_status() {
    echo -e "${CYAN}Checking VM status...${NC}\n"

    # Check for running vfkit processes
    if command -v vfkit &> /dev/null; then
        echo -e "${BOLD}Running VMs:${NC}"
        pgrep -fl vfkit || echo "No vfkit VMs running"
    else
        echo -e "${YELLOW}vfkit not installed${NC}"
    fi

    echo

    # Check for Lima VMs
    if command -v lima &> /dev/null || command -v limactl &> /dev/null; then
        echo -e "${BOLD}Lima VMs:${NC}"
        limactl list 2>/dev/null || echo "No Lima VMs found"
    else
        echo -e "${YELLOW}Lima not installed${NC}"
    fi

    read -p "Press Enter to continue..."
}

stop_all_vms() {
    echo -e "${RED}Stopping all VMs...${NC}\n"

    # Stop vfkit VMs
    pkill -f vfkit && echo -e "${GREEN}✓ vfkit VMs stopped${NC}" || echo -e "${YELLOW}No vfkit VMs to stop${NC}"

    # Stop Lima VMs
    if command -v limactl &> /dev/null; then
        limactl stop --all && echo -e "${GREEN}✓ Lima VMs stopped${NC}"
    fi

    echo
    read -p "Press Enter to continue..."
}

#####################################################################
# Script Execution Helpers
#####################################################################

run_vfkit_script() {
    local script_name="$1"
    local script_path="${VFKIT_DIR}/${script_name}"

    if [[ ! -f "${script_path}" ]]; then
        echo -e "${RED}Error: vfkit script not found: ${script_path}${NC}"
        read -p "Press Enter to continue..."
        return 1
    fi

    echo -e "${CYAN}Executing vfkit script: ${script_name}${NC}\n"
    chmod +x "${script_path}"

    # Change to vfkit directory for execution context
    (cd "${VFKIT_DIR}" && bash "${script_path}")
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        echo -e "\n${GREEN}✓ Script completed successfully${NC}"
    else
        echo -e "\n${RED}✗ Script failed with error code ${exit_code}${NC}"
    fi

    read -p "Press Enter to continue..."
}

run_benchmark_script() {
    local script_name="$1"
    local script_path="${BENCHMARK_DIR}/${script_name}"

    if [[ ! -f "${script_path}" ]]; then
        echo -e "${RED}Error: Benchmark script not found: ${script_path}${NC}"
        read -p "Press Enter to continue..."
        return 1
    fi

    echo -e "${CYAN}Executing benchmark: ${script_name}${NC}\n"
    chmod +x "${script_path}"

    # Execute with appropriate interpreter
    if [[ "${script_name}" =~ \.py$ ]]; then
        (cd "${BENCHMARK_DIR}" && python3 "${script_path}")
    else
        (cd "${BENCHMARK_DIR}" && bash "${script_path}")
    fi
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        echo -e "\n${GREEN}✓ Benchmark completed successfully${NC}"
    else
        echo -e "\n${RED}✗ Benchmark failed with error code ${exit_code}${NC}"
    fi

    read -p "Press Enter to continue..."
}

run_script() {
    local script_name="$1"
    local script_path="${SCRIPTS_DIR}/${script_name}"

    if [[ ! -f "${script_path}" ]]; then
        echo -e "${RED}Error: Script not found: ${script_path}${NC}"
        read -p "Press Enter to continue..."
        return 1
    fi

    echo -e "${CYAN}Executing: ${script_name}${NC}\n"
    chmod +x "${script_path}"

    if bash "${script_path}"; then
        echo -e "\n${GREEN}✓ Script completed successfully${NC}"
    else
        echo -e "\n${RED}✗ Script failed with error code $?${NC}"
    fi

    read -p "Press Enter to continue..."
}
