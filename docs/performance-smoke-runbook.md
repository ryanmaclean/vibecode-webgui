# Performance Smoke Runbook (KIND or AKS)

Use this checklist whenever you need quick response-time numbers after redeploying the WebGUI. It assumes the app is reachable inside the cluster under the service name `vibecode-webgui`.

## 1. Port-forward the service
```bash
kubectl port-forward svc/vibecode-webgui 8080:80 \
  --namespace vibecode --context <kube-context>
```
Leave this running in its own terminal. Replace `<kube-context>` with `kind-vibecode-local` (for KIND) or the AKS context.

## 2. Run the performance smoke tests
In a new terminal:
```bash
export BASE_URL=http://localhost:8080
npm run test:performance
```
The script writes timings to stdout. Capture the summary and store it in `TODO.md` (Agent #3 section) for the current session.

### Success thresholds (baseline targets)
- Build step: ≤ 15 seconds (matches CI performance gate)
- Smoke test end-to-end: API responses ≤ 500 ms average, page render (First Meaningful Paint) ≤ 2 s
- Memory usage: ≤ 1 GB reported by the suite
- Any failure or warning should be logged and escalated in TODO.md / follow-up issue

## 3. Collect observability evidence
While the tests run (or immediately after):
```bash
# Application traces / logs
kubectl logs deploy/vibecode-webgui -n vibecode \
  --context <kube-context> | grep "Response from the agent"

# Datadog trace agent tail (if installed)
kubectl logs -n datadog daemonset/datadog --container trace-agent \
  --context <kube-context> | tail
```
Attach notable spans or errors to `TODO.md`.

## 4. Optional follow-ups
- If any test exceeds its threshold, open an issue with the recorded timings and logs.
- For long runs, add `npm run test:performance -- --reporter=list` to gain extra detail.
