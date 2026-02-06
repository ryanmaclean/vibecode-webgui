package sub

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/spf13/cobra"
)

func SessionCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "session",
		Short: "Manage td sessions (zellij)",
	}
	cmd.AddCommand(sessionListCmd(), sessionStartCmd(), sessionKillCmd())
	return cmd
}

func zellijBin() string {
	return envOr("TD_ZELLIJ_BIN", "zellij")
}

func sessionListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List zellij sessions",
		RunE: func(cmd *cobra.Command, args []string) error {
			c := exec.Command(zellijBin(), "list-sessions")
			c.Stdout = os.Stdout
			c.Stderr = os.Stderr
			return c.Run()
		},
	}
}

func sessionStartCmd() *cobra.Command {
	var name string
	var cmdline string
	cmd := &cobra.Command{
		Use:   "start",
		Short: "Start a zellij session",
		RunE: func(cmd *cobra.Command, args []string) error {
			if name == "" {
				return fmt.Errorf("--name required")
			}
			zargs := []string{"-s", name}
			if cmdline != "" {
				zargs = append(zargs, "--", "sh", "-lc", cmdline)
			}
			c := exec.Command(zellijBin(), zargs...)
			c.Stdout = os.Stdout
			c.Stderr = os.Stderr
			c.Stdin = os.Stdin
			return c.Run()
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "session name")
	cmd.Flags().StringVar(&cmdline, "cmd", "", "command to run in session")
	return cmd
}

func sessionKillCmd() *cobra.Command {
	var name string
	cmd := &cobra.Command{
		Use:   "kill",
		Short: "Kill a zellij session",
		RunE: func(cmd *cobra.Command, args []string) error {
			if name == "" {
				return fmt.Errorf("--name required")
			}
			c := exec.Command(zellijBin(), "kill-session", name)
			c.Stdout = os.Stdout
			c.Stderr = os.Stderr
			return c.Run()
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "session name")
	return cmd
}
