package root

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

var clusterCmd = &cobra.Command{
	Use:   "cluster",
	Short: "Manage Tundra Dome clusters",
	Long: `Manage local and cloud Kubernetes clusters for Tundra Dome.

Supports:
  - KIND clusters for local development
  - AKS (Azure), EKS (AWS), GKE (Google) for production
  - Multi-cluster federation with bead sync
  - GitOps with ArgoCD`,
}

var clusterCreateCmd = &cobra.Command{
	Use:   "create [name]",
	Short: "Create a new cluster",
	Long: `Create a new Kubernetes cluster for Tundra Dome.

Examples:
  td cluster create                    # Create default KIND cluster
  td cluster create --type kind        # Create KIND cluster
  td cluster create --type aks         # Create AKS cluster (requires Terraform)
  td cluster create --type eks         # Create EKS cluster (requires Terraform)
  td cluster create --type gke         # Create GKE cluster (requires Terraform)
  td cluster create --full             # Full stack with all components`,
	Args: cobra.MaximumNArgs(1),
	RunE: runClusterCreate,
}

var clusterDeleteCmd = &cobra.Command{
	Use:   "delete [name]",
	Short: "Delete a cluster",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runClusterDelete,
}

var clusterListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all Tundra Dome clusters",
	RunE:  runClusterList,
}

var clusterStatusCmd = &cobra.Command{
	Use:   "status [name]",
	Short: "Show cluster status",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runClusterStatus,
}

var clusterSyncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Sync beads across federated clusters",
	Long: `Synchronize beads between federated Tundra Dome clusters.

This enables multi-cluster work distribution where beads can be
processed by polecats in any connected cluster.`,
	RunE: runClusterSync,
}

var clusterBootstrapCmd = &cobra.Command{
	Use:   "bootstrap",
	Short: "Full bootstrap from scratch",
	Long: `Bootstrap a complete Tundra Dome environment from scratch.

This includes:
  - KIND cluster creation
  - CRD installation
  - Controller deployment
  - Kafka & PostgreSQL
  - Airflow scheduler
  - Datadog agent
  - Example polecats and lanes`,
	RunE: runClusterBootstrap,
}

var clusterGitopsCmd = &cobra.Command{
	Use:   "gitops",
	Short: "Configure GitOps with ArgoCD",
	Long: `Set up GitOps-based cluster management with ArgoCD.

This enables declarative cluster state management where all
Tundra Dome resources are synced from a Git repository.`,
	RunE: runClusterGitops,
}

// Flags
var (
	clusterType     string
	clusterFull     bool
	clusterNodes    int
	clusterCloud    string
	clusterRegion   string
	clusterGitRepo  string
	clusterDryRun   bool
)

func init() {
	// Create flags
	clusterCreateCmd.Flags().StringVar(&clusterType, "type", "kind", "Cluster type: kind, aks, eks, gke")
	clusterCreateCmd.Flags().BoolVar(&clusterFull, "full", false, "Deploy full Tundra Dome stack")
	clusterCreateCmd.Flags().IntVar(&clusterNodes, "nodes", 3, "Number of worker nodes")
	clusterCreateCmd.Flags().StringVar(&clusterRegion, "region", "", "Cloud region (for aks/eks/gke)")
	clusterCreateCmd.Flags().BoolVar(&clusterDryRun, "dry-run", false, "Show what would be created")

	// GitOps flags
	clusterGitopsCmd.Flags().StringVar(&clusterGitRepo, "repo", "", "Git repository URL for GitOps")

	// Add subcommands
	clusterCmd.AddCommand(clusterCreateCmd)
	clusterCmd.AddCommand(clusterDeleteCmd)
	clusterCmd.AddCommand(clusterListCmd)
	clusterCmd.AddCommand(clusterStatusCmd)
	clusterCmd.AddCommand(clusterSyncCmd)
	clusterCmd.AddCommand(clusterBootstrapCmd)
	clusterCmd.AddCommand(clusterGitopsCmd)

	// Add to root
	rootCmd.AddCommand(clusterCmd)
}

func runClusterCreate(cmd *cobra.Command, args []string) error {
	name := "tundra-dome"
	if len(args) > 0 {
		name = args[0]
	}

	fmt.Printf("Creating %s cluster: %s\n", clusterType, name)

	switch clusterType {
	case "kind":
		return createKindCluster(name)
	case "aks":
		return createCloudCluster("aks", name)
	case "eks":
		return createCloudCluster("eks", name)
	case "gke":
		return createCloudCluster("gke", name)
	default:
		return fmt.Errorf("unknown cluster type: %s", clusterType)
	}
}

func createKindCluster(name string) error {
	infraDir := findInfraDir()
	configPath := filepath.Join(infraDir, "kind-config.yaml")

	if clusterDryRun {
		fmt.Printf("[DRY-RUN] Would create KIND cluster '%s' with config: %s\n", name, configPath)
		return nil
	}

	// Check if cluster exists
	checkCmd := exec.Command("kind", "get", "clusters")
	output, _ := checkCmd.Output()
	if strings.Contains(string(output), name) {
		fmt.Printf("Cluster '%s' already exists\n", name)
		return nil
	}

	// Create cluster
	args := []string{"create", "cluster", "--name", name}
	if _, err := os.Stat(configPath); err == nil {
		args = append(args, "--config", configPath)
	}
	args = append(args, "--wait", "2m")

	kindCmd := exec.Command("kind", args...)
	kindCmd.Stdout = os.Stdout
	kindCmd.Stderr = os.Stderr

	if err := kindCmd.Run(); err != nil {
		return fmt.Errorf("failed to create KIND cluster: %w", err)
	}

	fmt.Printf("KIND cluster '%s' created successfully\n", name)

	if clusterFull {
		return deployFullStack(name)
	}

	return nil
}

func createCloudCluster(provider, name string) error {
	infraDir := findInfraDir()
	tfDir := filepath.Join(infraDir, "terraform", provider)

	if _, err := os.Stat(tfDir); os.IsNotExist(err) {
		return fmt.Errorf("terraform module not found: %s\nRun 'td cluster init-terraform %s' first", tfDir, provider)
	}

	if clusterDryRun {
		fmt.Printf("[DRY-RUN] Would create %s cluster '%s' in %s\n", provider, name, clusterRegion)
		fmt.Printf("[DRY-RUN] Terraform dir: %s\n", tfDir)
		return nil
	}

	// Run terraform
	tfCmd := exec.Command("terraform", "apply", "-auto-approve",
		"-var", fmt.Sprintf("cluster_name=%s", name),
		"-var", fmt.Sprintf("region=%s", clusterRegion),
	)
	tfCmd.Dir = tfDir
	tfCmd.Stdout = os.Stdout
	tfCmd.Stderr = os.Stderr

	if err := tfCmd.Run(); err != nil {
		return fmt.Errorf("terraform apply failed: %w", err)
	}

	return nil
}

func runClusterDelete(cmd *cobra.Command, args []string) error {
	name := "tundra-dome"
	if len(args) > 0 {
		name = args[0]
	}

	fmt.Printf("Deleting cluster: %s\n", name)

	kindCmd := exec.Command("kind", "delete", "cluster", "--name", name)
	kindCmd.Stdout = os.Stdout
	kindCmd.Stderr = os.Stderr

	return kindCmd.Run()
}

func runClusterList(cmd *cobra.Command, args []string) error {
	fmt.Println("=== KIND Clusters ===")
	kindCmd := exec.Command("kind", "get", "clusters")
	kindCmd.Stdout = os.Stdout
	kindCmd.Stderr = os.Stderr
	kindCmd.Run()

	fmt.Println("\n=== Kubectl Contexts ===")
	kubectlCmd := exec.Command("kubectl", "config", "get-contexts", "-o", "name")
	kubectlCmd.Stdout = os.Stdout
	kubectlCmd.Stderr = os.Stderr
	return kubectlCmd.Run()
}

func runClusterStatus(cmd *cobra.Command, args []string) error {
	name := "tundra-dome"
	if len(args) > 0 {
		name = args[0]
	}

	context := fmt.Sprintf("kind-%s", name)

	fmt.Printf("=== Cluster Status: %s ===\n\n", name)

	// Nodes
	fmt.Println("Nodes:")
	exec.Command("kubectl", "--context", context, "get", "nodes", "-o", "wide").Run()

	// Tundra Dome namespace
	fmt.Println("\nTundra Dome Pods:")
	nodesCmd := exec.Command("kubectl", "--context", context, "get", "pods", "-n", "tundra-dome", "-o", "wide")
	nodesCmd.Stdout = os.Stdout
	nodesCmd.Stderr = os.Stderr
	nodesCmd.Run()

	// Polecats
	fmt.Println("\nPolecats:")
	exec.Command("kubectl", "--context", context, "get", "polecats", "-n", "tundra-dome").Run()

	// Lanes
	fmt.Println("\nLanes:")
	exec.Command("kubectl", "--context", context, "get", "lanes", "-n", "tundra-dome").Run()

	// Beads
	fmt.Println("\nBeads:")
	exec.Command("kubectl", "--context", context, "get", "beads", "-n", "tundra-dome").Run()

	return nil
}

func runClusterSync(cmd *cobra.Command, args []string) error {
	fmt.Println("=== Multi-Cluster Bead Sync ===")

	// Get all contexts
	output, err := exec.Command("kubectl", "config", "get-contexts", "-o", "name").Output()
	if err != nil {
		return err
	}

	contexts := strings.Split(strings.TrimSpace(string(output)), "\n")
	tundraClusters := []string{}

	for _, ctx := range contexts {
		if strings.Contains(ctx, "tundra") || strings.Contains(ctx, "gastown") {
			tundraClusters = append(tundraClusters, ctx)
		}
	}

	if len(tundraClusters) < 2 {
		fmt.Println("Need at least 2 Tundra Dome clusters for sync")
		fmt.Println("Found clusters:", tundraClusters)
		return nil
	}

	fmt.Printf("Found %d Tundra Dome clusters:\n", len(tundraClusters))
	for _, c := range tundraClusters {
		fmt.Printf("  - %s\n", c)
	}

	// TODO: Implement actual bead sync via Kafka federation
	fmt.Println("\nBead sync would connect these clusters via Kafka federation")

	return nil
}

func runClusterBootstrap(cmd *cobra.Command, args []string) error {
	fmt.Println("=== Tundra Dome Full Bootstrap ===")

	infraDir := findInfraDir()
	deployScript := filepath.Join(infraDir, "scripts", "deploy.sh")

	if _, err := os.Stat(deployScript); os.IsNotExist(err) {
		return fmt.Errorf("deploy script not found: %s", deployScript)
	}

	hostname, _ := os.Hostname()
	prefix := strings.Split(hostname, ".")[0]

	fmt.Printf("Bootstrapping with prefix: %s\n", prefix)

	bootstrapCmd := exec.Command("bash", deployScript, prefix)
	bootstrapCmd.Dir = infraDir
	bootstrapCmd.Stdout = os.Stdout
	bootstrapCmd.Stderr = os.Stderr

	return bootstrapCmd.Run()
}

func runClusterGitops(cmd *cobra.Command, args []string) error {
	if clusterGitRepo == "" {
		return fmt.Errorf("--repo is required")
	}

	fmt.Println("=== Setting up GitOps with ArgoCD ===")

	// Install ArgoCD
	fmt.Println("Installing ArgoCD...")
	exec.Command("kubectl", "create", "namespace", "argocd").Run()

	installCmd := exec.Command("kubectl", "apply", "-n", "argocd", "-f",
		"https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml")
	installCmd.Stdout = os.Stdout
	installCmd.Stderr = os.Stderr
	if err := installCmd.Run(); err != nil {
		return fmt.Errorf("failed to install ArgoCD: %w", err)
	}

	// Create Tundra Dome application
	appManifest := fmt.Sprintf(`
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tundra-dome
  namespace: argocd
spec:
  project: default
  source:
    repoURL: %s
    targetRevision: HEAD
    path: infra/tundra-dome/manifests
  destination:
    server: https://kubernetes.default.svc
    namespace: tundra-dome
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
`, clusterGitRepo)

	fmt.Println("Creating ArgoCD Application...")
	applyCmd := exec.Command("kubectl", "apply", "-f", "-")
	applyCmd.Stdin = strings.NewReader(appManifest)
	applyCmd.Stdout = os.Stdout
	applyCmd.Stderr = os.Stderr

	return applyCmd.Run()
}

func deployFullStack(clusterName string) error {
	context := fmt.Sprintf("kind-%s", clusterName)
	infraDir := findInfraDir()

	fmt.Println("\n=== Deploying Full Tundra Dome Stack ===")

	steps := []struct {
		name string
		fn   func() error
	}{
		{"Creating namespace", func() error {
			return exec.Command("kubectl", "--context", context, "create", "namespace", "tundra-dome").Run()
		}},
		{"Installing CRDs", func() error {
			crdDir := filepath.Join(infraDir, "crds")
			return exec.Command("kubectl", "--context", context, "apply", "-f", crdDir).Run()
		}},
		{"Deploying controllers", func() error {
			controllerManifest := filepath.Join(infraDir, "controllers", "controllers.yaml")
			return exec.Command("kubectl", "--context", context, "apply", "-f", controllerManifest).Run()
		}},
	}

	for _, step := range steps {
		fmt.Printf("  %s...\n", step.name)
		if err := step.fn(); err != nil {
			fmt.Printf("    Warning: %v\n", err)
		}
	}

	return nil
}

func findInfraDir() string {
	// Try common locations
	locations := []string{
		"/Users/studio/gt/crew/default/infra/tundra-dome",
		filepath.Join(os.Getenv("HOME"), "gt/crew/default/infra/tundra-dome"),
		"./infra/tundra-dome",
		"../infra/tundra-dome",
	}

	for _, loc := range locations {
		if _, err := os.Stat(loc); err == nil {
			return loc
		}
	}

	return locations[0]
}
