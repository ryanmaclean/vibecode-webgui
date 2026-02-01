// vibecode - One command to rule them all
// Consolidates 195 Python scripts into a single binary
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

var Version = "1.0.0"

func main() {
	// Start Datadog tracer
	tracer.Start(
		tracer.WithService("vibecode"),
		tracer.WithEnv(os.Getenv("DD_ENV")),
		tracer.WithServiceVersion(Version),
	)
	defer tracer.Stop()

	root := &cobra.Command{
		Use:   "vibecode [action] [target]",
		Short: "One command for all vibecode operations",
		Long: `vibecode - Consolidates 195 scripts into one command.

  vibecode start <vm>      Start a VM
  vibecode stop <vm>       Stop a VM
  vibecode list            List all VMs
  vibecode build           Build everything
  vibecode bench           Run benchmarks
  vibecode setup           Setup services
  vibecode dev             Start dev environment
  vibecode run <script>    Run legacy Python script`,
		Run: func(cmd *cobra.Command, args []string) {
			if len(args) == 0 {
				interactiveMode()
				return
			}
			cmd.Help()
		},
	}

	// Simple verbs - no nested subcommands
	root.AddCommand(startCmd())
	root.AddCommand(stopCmd())
	root.AddCommand(listCmd())
	root.AddCommand(buildCmd())
	root.AddCommand(benchCmd())
	root.AddCommand(setupCmd())
	root.AddCommand(devCmd())
	root.AddCommand(runCmd())

	root.Execute()
}

// ============================================================
// START - Start VMs, services, anything
// ============================================================
func startCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "start [target]",
		Short: "Start VM, service, or dev environment",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			target := args[0]
			span, _ := tracer.StartSpanFromContext(context.Background(), "start")
			span.SetTag("target", target)
			defer span.Finish()

			switch target {
			case "dev", "openvscode", "code":
				fmt.Println("Starting OpenVSCode Server...")
				exec.Command("limactl", "shell", "default", "--", "code-server", "--bind-addr", "0.0.0.0:8080").Run()
			case "docker":
				fmt.Println("Starting Docker Compose...")
				run("docker", "compose", "up", "-d")
			default:
				// Try Lima first, then vfkit
				fmt.Printf("Starting %s...\n", target)
				if err := run("limactl", "start", target); err != nil {
					run("vfkit", "--config", fmt.Sprintf("~/.vibecode/vms/%s/config.json", target))
				}
			}
		},
	}
}

// ============================================================
// STOP - Stop VMs, services, anything
// ============================================================
func stopCmd() *cobra.Command {
	var force bool
	cmd := &cobra.Command{
		Use:   "stop [target]",
		Short: "Stop VM or service",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			target := args[0]
			span, _ := tracer.StartSpanFromContext(context.Background(), "stop")
			span.SetTag("target", target)
			defer span.Finish()

			fmt.Printf("Stopping %s...\n", target)

			if target == "all" {
				run("limactl", "stop", "--all")
				run("docker", "compose", "down")
				return
			}

			if force {
				run("limactl", "stop", "--force", target)
			} else {
				if err := run("limactl", "stop", target); err != nil {
					run("docker", "stop", target)
				}
			}
		},
	}
	cmd.Flags().BoolVarP(&force, "force", "f", false, "Force stop")
	return cmd
}

// ============================================================
// LIST - List VMs, services, scripts
// ============================================================
func listCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List VMs and services",
		Run: func(cmd *cobra.Command, args []string) {
			span, _ := tracer.StartSpanFromContext(context.Background(), "list")
			defer span.Finish()

			w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "NAME\tSTATUS\tTYPE")
			fmt.Fprintln(w, "----\t------\t----")

			// Lima VMs
			if out, err := exec.Command("limactl", "list", "--json").Output(); err == nil {
				for _, line := range strings.Split(string(out), "\n") {
					if line == "" {
						continue
					}
					var vm map[string]interface{}
					if json.Unmarshal([]byte(line), &vm) == nil {
						fmt.Fprintf(w, "%s\t%s\tlima\n", vm["name"], vm["status"])
					}
				}
			}

			// Docker containers
			if out, err := exec.Command("docker", "ps", "--format", "{{.Names}}\t{{.Status}}").Output(); err == nil {
				for _, line := range strings.Split(string(out), "\n") {
					if line != "" {
						fmt.Fprintf(w, "%s\tdocker\n", line)
					}
				}
			}

			w.Flush()
		},
	}
}

// ============================================================
// BUILD - Build everything
// ============================================================
func buildCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "build [target]",
		Short: "Build docker, kernel, initramfs, or desktop",
		Run: func(cmd *cobra.Command, args []string) {
			span, _ := tracer.StartSpanFromContext(context.Background(), "build")
			defer span.Finish()

			target := "all"
			if len(args) > 0 {
				target = args[0]
			}

			switch target {
			case "docker":
				fmt.Println("Building Docker image...")
				run("docker", "build", "-t", "vibecode", ".")
			case "kernel":
				fmt.Println("Building minimal kernel...")
				runScript("build_minivim_kernel.py")
			case "initramfs":
				fmt.Println("Building initramfs...")
				runScript("build_initramfs.py")
			case "neovim":
				fmt.Println("Building Neovim initramfs...")
				runScript("build_neovim_avante_initramfs.py")
			case "all":
				fmt.Println("Building everything...")
				run("docker", "build", "-t", "vibecode", ".")
			default:
				fmt.Printf("Unknown target: %s\n", target)
			}
		},
	}
}

// ============================================================
// BENCH - Run benchmarks
// ============================================================
func benchCmd() *cobra.Command {
	var iterations int
	cmd := &cobra.Command{
		Use:   "bench [type]",
		Short: "Run boot, vim, or firecracker benchmarks",
		Run: func(cmd *cobra.Command, args []string) {
			span, _ := tracer.StartSpanFromContext(context.Background(), "bench")
			span.SetTag("iterations", iterations)
			defer span.Finish()

			benchType := "boot"
			if len(args) > 0 {
				benchType = args[0]
			}

			fmt.Printf("Running %s benchmark (%d iterations)...\n\n", benchType, iterations)

			switch benchType {
			case "boot":
				var total time.Duration
				for i := 0; i < iterations; i++ {
					start := time.Now()
					exec.Command("limactl", "shell", "default", "--", "echo", "ok").Run()
					elapsed := time.Since(start)
					total += elapsed
					fmt.Printf("  [%d/%d] %v\n", i+1, iterations, elapsed)
				}
				fmt.Printf("\nMean: %v\n", total/time.Duration(iterations))

			case "vim":
				runScript("vim_hypervisor_bench.py", "--iterations", fmt.Sprint(iterations))

			case "firecracker":
				runScript("firecracker_bench.py", "--iterations", fmt.Sprint(iterations))

			default:
				runScript(benchType + "_bench.py")
			}
		},
	}
	cmd.Flags().IntVarP(&iterations, "iterations", "n", 5, "Number of iterations")
	return cmd
}

// ============================================================
// SETUP - Setup services
// ============================================================
func setupCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "setup [service]",
		Short: "Setup datadog, postgres, vfkit, or all",
		Run: func(cmd *cobra.Command, args []string) {
			span, _ := tracer.StartSpanFromContext(context.Background(), "setup")
			defer span.Finish()

			service := "all"
			if len(args) > 0 {
				service = args[0]
			}

			switch service {
			case "datadog":
				fmt.Println("Setting up Datadog...")
				run("brew", "install", "datadog-agent")
			case "postgres":
				fmt.Println("Setting up PostgreSQL...")
				run("brew", "install", "postgresql@16")
				run("brew", "services", "start", "postgresql@16")
			case "vfkit":
				fmt.Println("Setting up vfkit...")
				run("brew", "install", "vfkit")
			case "all":
				fmt.Println("Running full setup...")
				run("brew", "install", "vfkit", "postgresql@16", "lima")
				run("brew", "services", "start", "postgresql@16")
			default:
				runScript("setup_" + service + ".py")
			}
		},
	}
}

// ============================================================
// DEV - Start dev environment
// ============================================================
func devCmd() *cobra.Command {
	var port int
	cmd := &cobra.Command{
		Use:   "dev [type]",
		Short: "Start openvscode, neovim, or chromium",
		Run: func(cmd *cobra.Command, args []string) {
			span, _ := tracer.StartSpanFromContext(context.Background(), "dev")
			defer span.Finish()

			devType := "openvscode"
			if len(args) > 0 {
				devType = args[0]
			}

			switch devType {
			case "openvscode", "code", "vscode":
				fmt.Printf("Starting OpenVSCode on port %d...\n", port)
				fmt.Printf("Open: http://localhost:%d\n", port)
				c := exec.Command("limactl", "shell", "default", "--",
					"code-server", "--bind-addr", fmt.Sprintf("0.0.0.0:%d", port))
				c.Stdout = os.Stdout
				c.Stderr = os.Stderr
				c.Run()

			case "neovim", "nvim":
				fmt.Println("Starting Neovim...")
				c := exec.Command("limactl", "shell", "default", "--", "nvim")
				c.Stdin = os.Stdin
				c.Stdout = os.Stdout
				c.Stderr = os.Stderr
				c.Run()

			case "chromium":
				fmt.Println("Starting Chromium IDE...")
				exec.Command("open", "-a", "Chromium", fmt.Sprintf("http://localhost:%d", port)).Run()

			default:
				runScript("start_" + devType + ".py")
			}
		},
	}
	cmd.Flags().IntVarP(&port, "port", "p", 8080, "Port")
	return cmd
}

// ============================================================
// RUN - Run legacy Python script
// ============================================================
func runCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "run <script> [args...]",
		Short: "Run a legacy Python script",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			runScript(args[0], args[1:]...)
		},
	}
}

// ============================================================
// HELPERS
// ============================================================

func run(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func runScript(name string, args ...string) {
	// Find script in scripts directory
	scriptPaths := []string{
		filepath.Join("scripts", name),
		filepath.Join("scripts", "benchmarks", name),
		filepath.Join("scripts", "vfkit", name),
		name,
	}

	for _, p := range scriptPaths {
		if _, err := os.Stat(p); err == nil {
			cmdArgs := append([]string{p}, args...)
			cmd := exec.Command("python3", cmdArgs...)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			cmd.Run()
			return
		}
	}
	fmt.Printf("Script not found: %s\n", name)
}

func interactiveMode() {
	fmt.Println(`
╔═══════════════════════════════════════════════════════════╗
║                      VIBECODE CLI                         ║
║         195 Python scripts → 1 simple command             ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   vibecode start <vm>     Start a VM                      ║
║   vibecode stop <vm>      Stop a VM                       ║
║   vibecode stop all       Stop everything                 ║
║   vibecode list           List all VMs/services           ║
║                                                           ║
║   vibecode build          Build docker image              ║
║   vibecode build kernel   Build minimal kernel            ║
║   vibecode bench          Run boot benchmark              ║
║   vibecode bench -n 20    Run 20 iterations               ║
║                                                           ║
║   vibecode setup          Setup all services              ║
║   vibecode setup datadog  Setup Datadog only              ║
║                                                           ║
║   vibecode dev            Start OpenVSCode                ║
║   vibecode dev neovim     Start Neovim in VM              ║
║                                                           ║
║   vibecode run <script>   Run legacy Python script        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`)
}
