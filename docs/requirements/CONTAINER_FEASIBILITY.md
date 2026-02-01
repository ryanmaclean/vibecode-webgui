# Feasibility Report: Apple Containers (Nice-to-Have)

## Status: DEFERRED
**Reason:** Apple Container Runtime API is not yet stable/publicly documented for this specific use case compared to the mature Virtualization.framework (VZ).

## Findings
- **Pros:** Significantly lower resource usage (shared kernel).
- **Cons:** Limited networking stack isolation compared to VM; requires newer macOS host (14+ vs 13+).
- **Recommendation:** Stick to "Tiny VM" (2GB/2CPU) for v1.0 to ensure Networking Reliability (REQ-02) and Tailscale compatibility (REQ-04).

## Integration Path
Code stubs exist in `platforms/macos/AppleContainerRuntime` for future v1.1 implementation.
