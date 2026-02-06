package sub

import (
	"github.com/spf13/cobra"
	"td/internal/tdkafka"
)

func WhisperCmd() *cobra.Command {
	var lane string
	var target string
	cmd := &cobra.Command{
		Use:   "whisper <message>",
		Short: "Send a whisper",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			message := args[0]
			lane = normalizeLane(lane)
			evt := tdkafka.Event{Type: "whisper", Event: "whisper.sent", Lane: lane, Target: target, Message: message, Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
			return tdkafka.Publish(envOr("TD_TOPIC_WHISPERS", "tundra-whispers"), evt)
		},
	}
	cmd.Flags().StringVar(&lane, "lane", envOr("TD_LANE", "standard"), "lane: critical|standard|experimental")
	cmd.Flags().StringVar(&target, "target", "", "target")
	return cmd
}
