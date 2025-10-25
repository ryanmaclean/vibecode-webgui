#!/usr/bin/env bash

#####################################################################
# Deployment Menu - Consolidates 78+ deployment scripts
# Sections: Kind/K8s, Docker, Production (AKS), Monitoring
#####################################################################

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="${PROJECT_ROOT}"

#####################################################################
# Deployment Menu Display
#####################################################################

show_deploy_menu() {
    while true; do
        clear
        echo -e "${MAGENTA}${BOLD}"
        echo "╔════════════════════════════════════════════════════════════════╗"
        echo "║                    DEPLOYMENT MANAGEMENT                        ║"
        echo "╚════════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"

        print_section_header "Kind/Kubernetes Cluster Operations"
        print_menu_item "1" "Create Kind Cluster" "$GREEN"
        print_menu_item "2" "Deploy to Kind" "$GREEN"
        print_menu_item "3" "Kind Cluster Status" "$CYAN"
        print_menu_item "4" "Teardown Kind Cluster" "$RED"
        print_menu_item "5" "Kind Full Automation" "$MAGENTA"
        print_menu_item "6" "Deploy Services to Kind" "$GREEN"
        print_menu_item "7" "Kind Health Check" "$CYAN"

        print_section_header "Docker Operations"
        print_menu_item "11" "Build Docker Images" "$BLUE"
        print_menu_item "12" "Build and Push Codeserver" "$BLUE"
        print_menu_item "13" "Docker Build Optimized" "$BLUE"
        print_menu_item "14" "Docker Compose Operations" "$BLUE"
        print_menu_item "15" "Docker Doctor (Diagnostics)" "$YELLOW"

        print_section_header "Production Deployment (AKS)"
        print_menu_item "21" "Deploy to Production" "$MAGENTA"
        print_menu_item "22" "AKS Bootstrap" "$MAGENTA"
        print_menu_item "23" "AKS App Deploy" "$MAGENTA"
        print_menu_item "24" "Create AKS Cluster" "$CYAN"
        print_menu_item "25" "Production Deployment Validation" "$YELLOW"

        print_section_header "Monitoring & Observability"
        print_menu_item "31" "Deploy Monitoring Stack" "$CYAN"
        print_menu_item "32" "Setup Datadog (Kind)" "$CYAN"
        print_menu_item "33" "Setup Datadog (AKS)" "$CYAN"
        print_menu_item "34" "Deploy Database Monitoring (DBM)" "$CYAN"
        print_menu_item "35" "Deploy DBM + APM (All)" "$MAGENTA"
        print_menu_item "36" "Deploy Error Tracking" "$CYAN"

        print_section_header "Complete Platform Deployments"
        print_menu_item "41" "Deploy Complete Platform" "$MAGENTA"
        print_menu_item "42" "Deploy with Monitoring" "$MAGENTA"
        print_menu_item "43" "Deploy Comparison Environments" "$CYAN"
        print_menu_item "44" "Deploy Simple Local" "$GREEN"

        print_section_header "Additional Deployments"
        print_menu_item "51" "Deploy Authelia (SSO)" "$BLUE"
        print_menu_item "52" "Deploy AgentAPI" "$BLUE"
        print_menu_item "53" "Deploy Ingress Controller" "$BLUE"
        print_menu_item "54" "Deploy Database Migrations" "$YELLOW"
        print_menu_item "55" "Deploy Docs (Next.js)" "$GREEN"

        echo
        print_menu_item "0" "Back to Main Menu" "$RED"
        echo

        read -rp "Select deployment option: " choice

        case $choice in
            # Kind/K8s Operations
            1) run_script "kind-create-cluster.sh" ;;
            2) run_script "deploy-vibecode.sh" ;;
            3) run_script "kind-status.sh" ;;
            4) run_script "kind-cleanup.sh" ;;
            5) run_script "kind-full-automation.sh" ;;
            6) run_script "kind-deploy-services.sh" ;;
            7) run_script "kind-health-check.sh" ;;

            # Docker Operations
            11) run_script "build-production.sh" ;;
            12) run_script "build-and-push-codeserver.sh" ;;
            13) run_script "docker-build-optimized.sh" ;;
            14) show_docker_compose_submenu ;;
            15) run_script "docker-doctor.sh" ;;

            # Production (AKS)
            21) run_script "deploy-production.sh" ;;
            22) run_script "aks-bootstrap.sh" ;;
            23) run_script "aks-app-deploy.sh" ;;
            24) run_script "create-aks-cluster.sh" ;;
            25) run_script "azure-deployment-validation.sh" ;;

            # Monitoring
            31) run_script "deploy-monitoring.sh" ;;
            32) run_script "kind-datadog-core.sh" ;;
            33) run_script "setup-aks-datadog-monitoring.sh" ;;
            34) run_script "deploy-datadog-dbm.sh" ;;
            35) run_script "deploy-dbm-apm-all.sh" ;;
            36) run_script "deploy-with-error-tracking.sh" ;;

            # Complete Platforms
            41) run_script "deploy-complete-platform.sh" ;;
            42) run_script "deploy-kind-with-monitoring.sh" ;;
            43) run_script "deploy-comparison-environments.sh" ;;
            44) run_script "deploy-simple-local.sh" ;;

            # Additional Deployments
            51) run_script "deploy-authelia.sh" ;;
            52) run_script "deploy-agentapi.sh" ;;
            53) run_script "deploy-ingress-controller.sh" ;;
            54) run_script "deploy-database-migrations.sh" ;;
            55) run_script "deploy-docs-next.sh" ;;

            0) return ;;
            *)
                echo -e "${RED}Invalid option. Please try again.${NC}"
                sleep 1
                ;;
        esac
    done
}

#####################################################################
# Docker Compose Submenu
#####################################################################

show_docker_compose_submenu() {
    while true; do
        clear
        echo -e "${BLUE}${BOLD}Docker Compose Operations${NC}\n"
        print_menu_item "1" "Start Development Environment" "$GREEN"
        print_menu_item "2" "Start Docker (Simple)" "$GREEN"
        print_menu_item "3" "Stop All Services" "$RED"
        print_menu_item "0" "Back" "$YELLOW"
        echo

        read -rp "Select docker compose option: " choice

        case $choice in
            1) run_script "start-dev.sh" ;;
            2) run_script "start-docker.sh" ;;
            3)
                cd "${PROJECT_ROOT}" && docker-compose down
                echo -e "${GREEN}Services stopped${NC}"
                read -p "Press Enter to continue..."
                ;;
            0) return ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                sleep 1
                ;;
        esac
    done
}

#####################################################################
# Script Execution Helper
#####################################################################

run_script() {
    local script_name="$1"
    local script_path="${SCRIPTS_DIR}/${script_name}"

    if [[ ! -f "${script_path}" ]]; then
        echo -e "${RED}Error: Script not found: ${script_path}${NC}"
        read -p "Press Enter to continue..."
        return 1
    fi

    echo -e "${CYAN}Executing: ${script_name}${NC}\n"

    # Make script executable if not already
    chmod +x "${script_path}"

    # Execute script and capture result
    if bash "${script_path}"; then
        echo -e "\n${GREEN}✓ Script completed successfully${NC}"
    else
        echo -e "\n${RED}✗ Script failed with error code $?${NC}"
    fi

    read -p "Press Enter to continue..."
}
