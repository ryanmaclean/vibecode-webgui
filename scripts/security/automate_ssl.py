#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from scripts.vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import argparse
import subprocess
import shutil
import platform
import logging
from pathlib import Path

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [SSL-AUTO] %(message)s')
logger = logging.getLogger()

def check_command(cmd):
    return shutil.which(cmd) is not None

def run_command(cmd, check=True, capture_output=False):
    logger.info(f"Executing: {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, check=check, capture_output=capture_output, text=True)
        return result
    except subprocess.CalledProcessError as e:
        logger.error(f"Command failed: {e}")
        if capture_output:
            logger.error(f"Stdout: {e.stdout}")
            logger.error(f"Stderr: {e.stderr}")
        if check:
            sys.exit(e.returncode)
        return e

def install_certbot():
    system = platform.system()
    if system == "Darwin":
        if check_command("brew"):
            logger.info("Installing certbot via Homebrew...")
            run_command(["brew", "install", "certbot"])
        else:
            logger.error("Homebrew not found. Please install certbot manually.")
            sys.exit(1)
    elif system == "Linux":
        # Assume Debian/Ubuntu for now
        logger.info("Installing certbot via apt...")
        run_command(["sudo", "apt-get", "update"], check=False)
        run_command(["sudo", "apt-get", "install", "-y", "certbot"])
    else:
        logger.error(f"Unsupported OS: {system}")
        sys.exit(1)

def setup_tailscale_cert(domain):
    if not check_command("tailscale"):
        logger.error("Tailscale CLI not found. Please install Tailscale.")
        return False

    logger.info(f"Requesting Tailscale certificate for {domain}...")
    # tailscale cert <domain>
    # Note: domain must be the machine name if using MagicDNS, or full domain
    cmd = ["tailscale", "cert", domain]
    
    # Check if we need sudo (usually yes for writing to current dir if protected, or accessing tailscale socket)
    # But tailscale cert writes to CWD.
    
    result = run_command(cmd, check=False)
    if result.returncode == 0:
        logger.info(f"✅ Certificate generated for {domain}")
        return True
    else:
        logger.warning("Tailscale cert failed. Is Tailscale running and authenticated?")
        return False

def setup_certbot_dns(domain, email, provider="manual"):
    if not check_command("certbot"):
        install_certbot()

    logger.info(f"Requesting Let's Encrypt certificate for {domain} via DNS challenge...")
    
    cmd = [
        "sudo", "certbot", "certonly",
        "--manual",
        "--preferred-challenges", "dns",
        "-d", domain,
        "--email", email,
        "--agree-tos",
        "--no-eff-email"
    ]
    
    if provider == "manual":
        logger.info("⚠️  Manual mode: You will need to create DNS TXT records manually.")
        # Interactive mode requires stdin
        subprocess.run(cmd) 
    else:
        logger.error(f"Provider '{provider}' automation not yet implemented. Use manual mode.")
        # Future: Add plugins for cloudflare, route53, etc.

def main():
    parser = argparse.ArgumentParser(description="Automate SSL Certificate Setup")
    parser.add_argument("--mode", choices=["tailscale", "custom"], default="tailscale", help="Certificate mode")
    parser.add_argument("--domain", help="Domain name (required for custom mode)")
    parser.add_argument("--email", help="Email for Let's Encrypt (required for custom mode)")
    parser.add_argument("--provider", choices=["manual", "cloudflare", "route53"], default="manual", help="DNS Provider for challenge")
    
    args = parser.parse_args()

    if args.mode == "tailscale":
        if not args.domain:
            # Try to guess tailscale domain?
            # tailscale status --json | jq ...
            logger.info("No domain provided. Attempting to determine Tailscale domain...")
            try:
                status = subprocess.check_output(["tailscale", "status", "--json"], text=True)
                import json
                data = json.loads(status)
                # Self is usually in "Self"
                self_node = data.get("Self", {})
                dns_name = self_node.get("DNSName", "").rstrip(".")
                if dns_name:
                    logger.info(f"Detected Tailscale domain: {dns_name}")
                    args.domain = dns_name
                else:
                    logger.error("Could not determine Tailscale domain. Please provide --domain.")
                    sys.exit(1)
            except Exception as e:
                logger.error(f"Failed to query Tailscale status: {e}")
                sys.exit(1)
        
        setup_tailscale_cert(args.domain)

    elif args.mode == "custom":
        if not args.domain or not args.email:
            logger.error("Custom mode requires --domain and --email.")
            sys.exit(1)
        
        setup_certbot_dns(args.domain, args.email, args.provider)

if __name__ == "__main__":
    main()
