# Agent 8: Let's Encrypt Automation

## Goal
Full automation of SSL/TLS certificates with Let's Encrypt, including renewal and OpenClaw gateway integration.

## Tasks
1. Implement DNS challenge automation (for private domains)
2. Create certificate renewal cron job
3. Integrate certificates with OpenClaw gateway (HTTPS)
4. Set up certificate storage and rotation
5. Create fallback to self-signed for .local domains
6. Test certificate renewal workflow

## Success Criteria
- Certificates automatically obtained
- Renewal happens before expiration
- OpenClaw gateway serves HTTPS
- Self-signed fallback works for .local
- Certificate rotation is seamless

## Files
- `scripts/vz/setup-letsencrypt-auto.sh` (enhance existing)
- `scripts/vz/renew-certificates.sh` (new)
- `scripts/vz/configure-openclaw-https.sh` (new)

## Dependencies
- Agent 3: Installation scripts (needs OpenClaw installed)
- Agent 4: Tailscale (for domain resolution)

## Notes
- DNS challenge needed for private networks
- HTTP challenge for public domains
- Certbot handles renewal automatically
- Gateway needs HTTPS configuration
