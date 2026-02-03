package sub

import (
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"td/internal/tdkafka"
)

func MailCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "mail",
		Short: "Mail operations",
	}
	cmd.AddCommand(mailSendCmd(), mailReadCmd(), mailInboxCmd())
	return cmd
}

func mailSendCmd() *cobra.Command {
	var lane string
	cmd := &cobra.Command{
		Use:   "send <message>",
		Short: "Send mail",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			lane = normalizeLane(lane)
			evt := tdkafka.Event{Type: "mail", Event: "mail.sent", Lane: lane, Message: args[0], Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
			return tdkafka.Publish(envOr("TD_TOPIC_MAIL_OUT", "tundra-mail-outbox"), evt)
		},
	}
	cmd.Flags().StringVar(&lane, "lane", envOr("TD_LANE", "standard"), "lane: critical|standard|experimental")
	return cmd
}

func mailReadCmd() *cobra.Command {
	var lane string
	cmd := &cobra.Command{
		Use:   "read <message>",
		Short: "Record mail read",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			lane = normalizeLane(lane)
			evt := tdkafka.Event{Type: "mail", Event: "mail.read", Lane: lane, Message: args[0], Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
			return tdkafka.Publish(envOr("TD_TOPIC_MAIL_IN", "tundra-mail-inbox"), evt)
		},
	}
	cmd.Flags().StringVar(&lane, "lane", envOr("TD_LANE", "standard"), "lane: critical|standard|experimental")
	return cmd
}

func mailInboxCmd() *cobra.Command {
	var limit int
	cmd := &cobra.Command{
		Use:   "inbox",
		Short: "Show recent inbox mail events",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if limit <= 0 {
				limit = 20
			}
			events, err := tdkafka.FetchRecent(envOr("TD_TOPIC_MAIL_IN", "tundra-mail-inbox"), limit, 2*time.Second)
			if err != nil {
				return err
			}
			if len(events) == 0 {
				fmt.Println("no inbox mail events found")
				return nil
			}
			for i := len(events) - 1; i >= 0; i-- {
				evt := events[i]
				fmt.Printf("%s | %s | %s | %s | %s\n", evt.TS, evt.Event, evt.Lane, evt.Role, evt.Message)
			}
			return nil
		},
	}
	cmd.Flags().IntVar(&limit, "limit", 20, "maximum number of messages to display")
	return cmd
}
