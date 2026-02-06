package sub

import (
	"fmt"

	"github.com/spf13/cobra"
	"td/internal/tdkafka"
)

func SlingCmd() *cobra.Command {
	var lane string
	var message string
	var target string
	cmd := &cobra.Command{
		Use:   "sling <bead>",
		Short: "Sling a bead into the Tundra fabric",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			bead := args[0]
			lane = normalizeLane(lane)
			evt := tdkafka.Event{
				Type:    "bead.lifecycle",
				Stage:   "in_progress",
				Bead:    bead,
				Lane:    lane,
				Target:  target,
				Message: message,
				Rig:     envOr("TD_RIG", "local"),
				Role:    envOr("TD_ROLE", "mayor"),
				Source:  "td",
				Schema: map[string]string{
					"name":    envOr("TD_SCHEMA_NAME", "tundra.beads"),
					"version": envOr("TD_SCHEMA_VERSION", "1"),
					"status":  envOr("TD_SCHEMA_STATUS", "ok"),
				},
			}
			if err := tdkafka.Publish(envOr("TD_TOPIC_WORK", "tundra-work-intake"), evt); err != nil {
				return err
			}
			if err := tdkafka.Publish(fmt.Sprintf("tundra-lane-%s-beads", lane), evt); err != nil {
				return err
			}
			return tdkafka.Publish(envOr("TD_TOPIC_IN_PROGRESS", "tundra-beads-in-progress"), evt)
		},
	}
	cmd.Flags().StringVar(&lane, "lane", envOr("TD_LANE", "standard"), "lane: critical|standard|experimental")
	cmd.Flags().StringVar(&message, "message", "", "message")
	cmd.Flags().StringVar(&target, "target", "", "target")
	return cmd
}

func normalizeLane(lane string) string {
	switch lane {
	case "critical", "experimental", "standard":
		return lane
	default:
		return "standard"
	}
}
