package sub

import (
	"github.com/spf13/cobra"
	"td/internal/tdkafka"
)

func NudgeCmd() *cobra.Command {
	var lane string
	var target string
	cmd := &cobra.Command{
		Use:   "nudge <message>",
		Short: "Send a nudge",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			message := args[0]
			lane = normalizeLane(lane)
			evt := tdkafka.Event{
				Type:    "nudge",
				Event:   "nudge.sent",
				Lane:    lane,
				Target:  target,
				Message: message,
				Rig:     envOr("TD_RIG", "local"),
				Role:    envOr("TD_ROLE", "mayor"),
				Source:  "td",
				Schema: map[string]string{
					"name":    envOr("TD_SCHEMA_NAME", "tundra.nudge"),
					"version": envOr("TD_SCHEMA_VERSION", "1"),
					"status":  envOr("TD_SCHEMA_STATUS", "ok"),
				},
			}
			return tdkafka.Publish(envOr("TD_TOPIC_NUDGES", "tundra-nudges"), evt)
		},
	}
	cmd.Flags().StringVar(&lane, "lane", envOr("TD_LANE", "standard"), "lane: critical|standard|experimental")
	cmd.Flags().StringVar(&target, "target", "", "target")
	return cmd
}
