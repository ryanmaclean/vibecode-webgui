package sub

import (
	"github.com/spf13/cobra"
)

func BDCmd() *cobra.Command {
	return &cobra.Command{
		Use:                "bd",
		Short:              "Run beads (bd) commands",
		DisableFlagParsing: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runExternal(envOr("TD_BD_BIN", "bd"), args...)
		},
	}
}
