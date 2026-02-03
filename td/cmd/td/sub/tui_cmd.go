package sub

import (
	"fmt"

	"github.com/spf13/cobra"
	"td/internal/tdkafka"
)

func TUICmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "tui",
		Short: "Interactive Tundra Dome console",
		RunE: func(cmd *cobra.Command, args []string) error {
			printBanner()
			menu := []item{
				{title: "Sling", desc: "Send bead to lane"},
				{title: "Hook", desc: "Create/hook bead"},
				{title: "Done", desc: "Complete bead"},
				{title: "Nudge", desc: "Send nudge"},
				{title: "Whisper", desc: "Send whisper"},
				{title: "Mail Send", desc: "Send mail"},
				{title: "Mail Read", desc: "Record mail read"},
				{title: "Convoy Start", desc: "Start convoy"},
				{title: "Convoy Complete", desc: "Complete convoy"},
				{title: "Session List", desc: "List zellij sessions"},
				{title: "Session Start", desc: "Start zellij session"},
				{title: "Session Kill", desc: "Kill zellij session"},
			}
			choice, ok := runMenu(menu, "Tundra Dome")
			if !ok {
				return nil
			}
			switch choice.title {
			case "Sling":
				return tuiSling()
			case "Hook":
				return tuiHook()
			case "Done":
				return tuiDone()
			case "Nudge":
				return tuiNudge()
			case "Whisper":
				return tuiWhisper()
			case "Mail Send":
				return tuiMailSend()
			case "Mail Read":
				return tuiMailRead()
			case "Convoy Start":
				return tuiConvoyStart()
			case "Convoy Complete":
				return tuiConvoyComplete()
			case "Session List":
				return sessionListCmd().Execute()
			case "Session Start":
				return sessionStartCmd().Execute()
			case "Session Kill":
				return sessionKillCmd().Execute()
			default:
				return nil
			}
		},
	}
	return cmd
}

func tuiSling() error {
	lane := chooseLane()
	bead := chooseBead()
	evt := tdkafka.Event{Type: "bead.lifecycle", Stage: "in_progress", Bead: bead, Lane: lane, Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
	if err := tdkafka.Publish(envOr("TD_TOPIC_WORK", "tundra-work-intake"), evt); err != nil {
		return err
	}
	return tdkafka.Publish(fmt.Sprintf("tundra-lane-%s-beads", lane), evt)
}

func tuiHook() error {
	lane := chooseLane()
	bead := chooseBead()
	evt := tdkafka.Event{Type: "bead.lifecycle", Stage: "hooked", Bead: bead, Lane: lane, Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
	return tdkafka.Publish(envOr("TD_TOPIC_CREATED", "tundra-beads-created"), evt)
}

func tuiDone() error {
	lane := chooseLane()
	bead := chooseBead()
	evt := tdkafka.Event{Type: "bead.lifecycle", Stage: "completed", Bead: bead, Lane: lane, Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
	return tdkafka.Publish(envOr("TD_TOPIC_COMPLETED", "tundra-beads-completed"), evt)
}

func tuiNudge() error {
	lane := chooseLane()
	evt := tdkafka.Event{Type: "nudge", Event: "nudge.sent", Lane: lane, Message: "nudge", Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
	return tdkafka.Publish(envOr("TD_TOPIC_NUDGES", "tundra-nudges"), evt)
}

func tuiWhisper() error {
	lane := chooseLane()
	evt := tdkafka.Event{Type: "whisper", Event: "whisper.sent", Lane: lane, Message: "whisper", Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
	return tdkafka.Publish(envOr("TD_TOPIC_WHISPERS", "tundra-whispers"), evt)
}

func tuiMailSend() error {
	lane := chooseLane()
	evt := tdkafka.Event{Type: "mail", Event: "mail.sent", Lane: lane, Message: "mail", Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
	return tdkafka.Publish(envOr("TD_TOPIC_MAIL_OUT", "tundra-mail-outbox"), evt)
}

func tuiMailRead() error {
	lane := chooseLane()
	evt := tdkafka.Event{Type: "mail", Event: "mail.read", Lane: lane, Message: "mail", Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
	return tdkafka.Publish(envOr("TD_TOPIC_MAIL_IN", "tundra-mail-inbox"), evt)
}

func tuiConvoyStart() error {
	lane := chooseLane()
	bead := chooseBead()
	evt := tdkafka.Event{Type: "convoy.started", Event: "convoy.started", Lane: lane, Bead: bead, Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
	return tdkafka.Publish(envOr("TD_TOPIC_CONVOY", "tundra-audit-actions"), evt)
}

func tuiConvoyComplete() error {
	lane := chooseLane()
	bead := chooseBead()
	evt := tdkafka.Event{Type: "convoy.completed", Event: "convoy.completed", Lane: lane, Bead: bead, Rig: envOr("TD_RIG", "local"), Role: envOr("TD_ROLE", "mayor"), Source: "td"}
	return tdkafka.Publish(envOr("TD_TOPIC_CONVOY", "tundra-audit-actions"), evt)
}

func chooseLane() string {
	laneItems := []item{{"Critical", ""}, {"Standard", ""}, {"Experimental", ""}}
	laneChoice, ok := runMenu(laneItems, "Lane")
	if !ok {
		return "standard"
	}
	return parseLaneLabel(laneChoice.title)
}

func chooseBead() string {
	items := listBeads()
	if len(items) == 0 {
		return "bead-unknown"
	}
	menu := make([]item, 0, len(items))
	for _, it := range items {
		menu = append(menu, item{title: it.ID, desc: it.Lane})
	}
	choice, ok := runMenu(menu, "Bead")
	if !ok || choice.title == "" {
		return items[0].ID
	}
	return choice.title
}
