package sub

import (
	"github.com/spf13/cobra"
	"td/internal/tdkafka"
)

func HookCmd() *cobra.Command {
	var lane string
	cmd := &cobra.Command{
		Use:   "hook <bead>",
		Short: "Create/hook a bead",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			bead := args[0]
			lane = normalizeLane(lane)
			evt := tdkafka.Event{
				Type:  "bead.lifecycle",
				Stage: "hooked",
				Bead:  bead,
				Lane:  lane,
				Rig:   envOr("TD_RIG", "local"),
				Role:  envOr("TD_ROLE", "mayor"),
				Source:"td",
				Schema: map[string]string{
					"name":    envOr("TD_SCHEMA_NAME", "tundra.beads"),
					"version": envOr("TD_SCHEMA_VERSION", "1"),
					"status":  envOr("TD_SCHEMA_STATUS", "ok"),
				},
			}
			return tdkafka.Publish(envOr("TD_TOPIC_CREATED", "tundra-beads-created"), evt)
		},
	}
	cmd.Flags().StringVar(&lane, "lane", envOr("TD_LANE", "standard"), "lane: critical|standard|experimental")
	return cmd
}
