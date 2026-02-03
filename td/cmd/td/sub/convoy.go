package sub

import (
	"github.com/spf13/cobra"
	"td/internal/tdkafka"
)

func ConvoyCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "convoy",
		Short: "Convoy operations",
	}
	cmd.AddCommand(convoyStartCmd(), convoyCompleteCmd())
	return cmd
}

func convoyStartCmd() *cobra.Command {
	var lane string
	cmd := &cobra.Command{
		Use:   "start <convoy-id>",
		Short: "Start a convoy",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			lane = normalizeLane(lane)
			evt := tdkafka.Event{Type: "convoy.started", Event: "convoy.started", Lane: lane, Bead: args[0], Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
			return tdkafka.Publish(envOr("TD_TOPIC_CONVOY", "tundra-audit-actions"), evt)
		},
	}
	cmd.Flags().StringVar(&lane, "lane", envOr("TD_LANE", "standard"), "lane: critical|standard|experimental")
	return cmd
}

func convoyCompleteCmd() *cobra.Command {
	var lane string
	cmd := &cobra.Command{
		Use:   "complete <convoy-id>",
		Short: "Complete a convoy",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			lane = normalizeLane(lane)
			evt := tdkafka.Event{Type: "convoy.completed", Event: "convoy.completed", Lane: lane, Bead: args[0], Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
			return tdkafka.Publish(envOr("TD_TOPIC_CONVOY", "tundra-audit-actions"), evt)
		},
	}
	cmd.Flags().StringVar(&lane, "lane", envOr("TD_LANE", "standard"), "lane: critical|standard|experimental")
	return cmd
}
