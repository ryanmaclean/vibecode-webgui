/*
td - Tundra Dome CLI

A command-line interface for managing the Tundra Dome stack on KIND.

Usage:
    td deploy              # Full deployment
    td deploy --cluster    # Cluster only
    td deploy --stack      # Stack only
    td status              # Show status
    td destroy             # Tear down
    td beads               # List beads
    td lanes               # List lanes
    td polecats            # List polecats
    td playbooks           # List playbooks
    td stations            # List stations
*/
package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

const (
	clusterName     = "tundra-dome"
	namespaceTundra = "tundra-dome"
	namespaceDD     = "datadog"

	colorRed    = "\033[0;31m"
	colorGreen  = "\033[0;32m"
	colorYellow = "\033[1;33m"
	colorBlue   = "\033[0;34m"
	colorCyan   = "\033[0;36m"
	colorBold   = "\033[1m"
	colorReset  = "\033[0m"
)

func logInfo(msg string) {
	fmt.Printf("%s[INFO]%s %s\n", colorBlue, colorReset, msg)
}

func logSuccess(msg string) {
	fmt.Printf("%s[OK]%s %s\n", colorGreen, colorReset, msg)
}

func logWarn(msg string) {
	fmt.Printf("%s[WARN]%s %s\n", colorYellow, colorReset, msg)
}

func logError(msg string) {
	fmt.Printf("%s[ERROR]%s %s\n", colorRed, colorReset, msg)
}

func logHeader(msg string) {
	fmt.Printf("\n%s%s%s%s\n", colorCyan, colorBold, msg, colorReset)
}

func runCmd(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func runCmdOutput(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	out, err := cmd.Output()
	return string(out), err
}

func commandExists(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

func checkPrerequisites() bool {
	logHeader("Checking Prerequisites")

	required := []string{"kind", "kubectl", "docker"}
	var missing []string

	for _, tool := range required {
		if !commandExists(tool) {
			missing = append(missing, tool)
		}
	}

	if len(missing) > 0 {
		logError(fmt.Sprintf("Missing required tools: %s", strings.Join(missing, ", ")))
		fmt.Println("Install them with:")
		fmt.Printf("  brew install %s\n", strings.Join(missing, " "))
		return false
	}

	// Check Docker
	if err := runCmd("docker", "info"); err != nil {
		logError("Docker is not running. Please start Docker first.")
		return false
	}

	// Check DD_API_KEY
	if os.Getenv("DD_API_KEY") == "" {
		logWarn("DD_API_KEY not set. Datadog integration will be limited.")
	}

	logSuccess("Prerequisites check passed")
	return true
}

func clusterExists() bool {
	out, err := runCmdOutput("kind", "get", "clusters")
	if err != nil {
		return false
	}
	for _, cluster := range strings.Split(strings.TrimSpace(out), "\n") {
		if cluster == clusterName {
			return true
		}
	}
	return false
}

func createCluster() error {
	logHeader("Creating KIND Cluster")

	if clusterExists() {
		logWarn(fmt.Sprintf("Cluster '%s' already exists, using it", clusterName))
		return nil
	}

	kindConfig := fmt.Sprintf(`
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: %s
nodes:
  - role: control-plane
  - role: worker
    extraPortMappings:
      - containerPort: 30080
        hostPort: 8080
        protocol: TCP
      - containerPort: 30092
        hostPort: 9092
        protocol: TCP
`, clusterName)

	configPath := "/tmp/kind-config.yaml"
	if err := os.WriteFile(configPath, []byte(kindConfig), 0644); err != nil {
		return err
	}
	defer os.Remove(configPath)

	if err := runCmd("kind", "create", "cluster", "--config", configPath); err != nil {
		return err
	}

	logSuccess(fmt.Sprintf("KIND cluster created: %s", clusterName))
	return nil
}

func createNamespaces() error {
	logHeader("Creating Namespaces")

	for _, ns := range []string{namespaceTundra, namespaceDD} {
		runCmd("kubectl", "create", "namespace", ns)
	}

	logSuccess("Namespaces created")
	return nil
}

func createSecrets() error {
	logHeader("Creating Secrets")

	apiKey := os.Getenv("DD_API_KEY")
	if apiKey == "" {
		apiKey = "placeholder-key"
	}

	for _, ns := range []string{namespaceTundra, namespaceDD} {
		runCmd("kubectl", "-n", ns, "delete", "secret", "tundra-dome-secrets", "--ignore-not-found")
		runCmd("kubectl", "-n", ns, "create", "secret", "generic",
			"tundra-dome-secrets", fmt.Sprintf("--from-literal=DD_API_KEY=%s", apiKey))
	}

	logSuccess("Secrets created")
	return nil
}

func installCRDs() error {
	logHeader("Installing CRDs")

	scriptDir := getScriptDir()
	crdsDir := scriptDir + "/crds"

	crds := []string{"bead.yaml", "polecat.yaml", "lane.yaml", "playbook.yaml", "station.yaml"}
	for _, crd := range crds {
		path := crdsDir + "/" + crd
		if _, err := os.Stat(path); err == nil {
			runCmd("kubectl", "apply", "-f", path)
		}
	}

	logSuccess("CRDs installed")
	return nil
}

func deployStack() error {
	logHeader("Deploying Tundra Dome Stack")

	scriptDir := getScriptDir()
	manifestPath := scriptDir + "/tundra-dome.clean.yaml"

	if _, err := os.Stat(manifestPath); err == nil {
		runCmd("kubectl", "apply", "-f", manifestPath)
	}

	logSuccess("Tundra Dome stack deployed")
	return nil
}

func deployExamples() error {
	logHeader("Deploying Example Resources")

	scriptDir := getScriptDir()
	examplesDir := scriptDir + "/examples"

	if _, err := os.Stat(examplesDir); err == nil {
		runCmd("kubectl", "apply", "-f", examplesDir)
	}

	logSuccess("Example resources deployed")
	return nil
}

func waitForReady() error {
	logHeader("Waiting for Pods")

	pods := []struct {
		namespace string
		selector  string
		name      string
	}{
		{namespaceDD, "app=datadog-agent", "Datadog Agent"},
		{namespaceTundra, "app=kafka", "Kafka"},
		{namespaceTundra, "app=airflow-scheduler", "Airflow Scheduler"},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	for _, pod := range pods {
		logInfo(fmt.Sprintf("Waiting for %s...", pod.name))
		cmd := exec.CommandContext(ctx, "kubectl", "wait", "--for=condition=ready",
			"pod", "-l", pod.selector, "-n", pod.namespace, "--timeout=60s")
		if err := cmd.Run(); err != nil {
			logWarn(fmt.Sprintf("%s not ready (continuing)", pod.name))
		} else {
			logSuccess(fmt.Sprintf("%s ready", pod.name))
		}
	}

	return nil
}

func showStatus() {
	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Printf("%s%s              TUNDRA DOME STATUS%s\n", colorCyan, colorBold, colorReset)
	fmt.Println(strings.Repeat("=", 70) + "\n")

	sections := []struct {
		title string
		args  []string
	}{
		{"PODS", []string{"get", "pods", "-n", namespaceTundra, "-o", "wide"}},
		{"DATADOG", []string{"get", "pods", "-n", namespaceDD, "-o", "wide"}},
		{"DEPLOYMENTS", []string{"get", "deployments", "-n", namespaceTundra, "-L", "tundra.dome/role,tundra.dome/crew"}},
		{"BEADS", []string{"get", "beads", "-n", namespaceTundra}},
		{"LANES", []string{"get", "lanes", "-n", namespaceTundra}},
		{"POLECATS", []string{"get", "polecats", "-n", namespaceTundra}},
		{"PLAYBOOKS", []string{"get", "playbooks", "-n", namespaceTundra}},
		{"STATIONS", []string{"get", "stations", "-n", namespaceTundra}},
	}

	for _, section := range sections {
		fmt.Printf("%s%s%s\n", colorBold, section.title, colorReset)
		fmt.Println(strings.Repeat("-", 70))
		runCmd("kubectl", section.args...)
		fmt.Println()
	}

	fmt.Println(strings.Repeat("=", 70))
	fmt.Printf("\n%sAccess Airflow:%s\n", colorGreen, colorReset)
	fmt.Println("  kubectl port-forward svc/airflow-api-service 8080:8080 -n tundra-dome")
	fmt.Println("  Then visit http://localhost:8080 (tundra/admin)\n")
}

func destroy() {
	logWarn("This will delete the KIND cluster and all resources!")
	fmt.Print("Are you sure? [y/N] ")

	var response string
	fmt.Scanln(&response)

	if strings.ToLower(response) == "y" {
		logInfo("Deleting KIND cluster...")
		runCmd("kind", "delete", "cluster", "--name", clusterName)
		logSuccess("Cluster deleted")
	} else {
		logInfo("Cancelled")
	}
}

func fullDeploy() {
	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Printf("%s%s       TUNDRA DOME - KIND DEPLOYMENT%s\n", colorCyan, colorBold, colorReset)
	fmt.Println(strings.Repeat("=", 70) + "\n")

	if !checkPrerequisites() {
		os.Exit(1)
	}

	createCluster()
	createNamespaces()
	createSecrets()
	installCRDs()
	deployStack()
	deployExamples()
	waitForReady()
	showStatus()

	logSuccess("Tundra Dome deployment complete!")
}

func getScriptDir() string {
	// Try to find the infra/tundra-dome directory
	candidates := []string{
		".",
		os.Getenv("TUNDRA_DOME_DIR"),
		os.Getenv("HOME") + "/gt/infra/tundra-dome",
		"/Users/studio/gt/infra/tundra-dome",
	}

	for _, dir := range candidates {
		if dir == "" {
			continue
		}
		if _, err := os.Stat(dir + "/crds"); err == nil {
			return dir
		}
	}

	return "."
}

func printUsage() {
	fmt.Println(`td - Tundra Dome CLI

Usage:
    td deploy              Full deployment
    td deploy --cluster    Create cluster only
    td deploy --stack      Deploy stack to existing cluster
    td deploy --crds       Install CRDs only
    td status              Show deployment status
    td destroy             Tear down cluster

    td beads               List beads
    td lanes               List lanes
    td polecats            List polecats
    td playbooks           List playbooks
    td stations            List stations

Environment Variables:
    DD_API_KEY             Datadog API key (optional)
    TUNDRA_DOME_DIR        Path to tundra-dome directory`)
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(0)
	}

	switch os.Args[1] {
	case "deploy":
		if len(os.Args) > 2 {
			switch os.Args[2] {
			case "--cluster":
				if checkPrerequisites() {
					createCluster()
					createNamespaces()
					createSecrets()
				}
			case "--stack":
				if checkPrerequisites() {
					installCRDs()
					deployStack()
					deployExamples()
					waitForReady()
					showStatus()
				}
			case "--crds":
				if checkPrerequisites() {
					installCRDs()
					deployExamples()
				}
			default:
				fullDeploy()
			}
		} else {
			fullDeploy()
		}

	case "status":
		showStatus()

	case "destroy":
		destroy()

	case "beads":
		runCmd("kubectl", "get", "beads", "-n", namespaceTundra, "-o", "wide")

	case "lanes":
		runCmd("kubectl", "get", "lanes", "-n", namespaceTundra, "-o", "wide")

	case "polecats":
		runCmd("kubectl", "get", "polecats", "-n", namespaceTundra, "-o", "wide")

	case "playbooks":
		runCmd("kubectl", "get", "playbooks", "-n", namespaceTundra, "-o", "wide")

	case "stations":
		runCmd("kubectl", "get", "stations", "-n", namespaceTundra, "-o", "wide")

	case "help", "-h", "--help":
		printUsage()

	default:
		fmt.Printf("Unknown command: %s\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}
