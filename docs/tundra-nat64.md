# Tundra NAT64

This repo vendors `tundra-nat64` as a module for polecat IP scaling and per-role address pools.

## Module

Path: `plugins/tundra-nat64`

Use this module as the NAT64 gateway implementation for polecat clusters. It should be deployed as a shared gateway per rig (recommended) or per lane if isolation is required.

## Deployment (local/dev)

1) Build the module from `plugins/tundra-nat64`.
2) Configure `settings/nat64/nat64.env`.
3) Start with launchd (macOS) or systemd (Linux) using the templates in `settings/nat64/`.

## Telemetry

All NAT64 instances must emit tags: `rig`, `lane`, `role`, `host`, `service=nat64`, `component=tundra-nat64`.

## DD Networking

Use Datadog Network Monitoring to track NAT64 flows per rig/lane. Ensure flow logs include:
- source role/polecat id
- target address/port
- lane

## Notes

- For production, run NAT64 as a shared gateway per rig; avoid per-pod NAT64 unless required for strict isolation.
- Pair with overlay network (WireGuard/Tailscale/VXLAN) so each polecat has a stable identity.
