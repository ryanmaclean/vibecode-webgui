package sub

import (
	"github.com/spf13/cobra"
)

func GTCmd() *cobra.Command {
	return &cobra.Command{
		Use:                "gt",
		Short:              "Run Gas Town (gt) commands",
		DisableFlagParsing: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runExternal(envOr("TD_GT_BIN", "gt"), args...)
		},
	}
}
