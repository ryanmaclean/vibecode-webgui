package root

import "td/cmd/td/sub"

func init() {
	Root().AddCommand(
		sub.SlingCmd(),
		sub.HookCmd(),
		sub.DoneCmd(),
		sub.NudgeCmd(),
		sub.WhisperCmd(),
		sub.MailCmd(),
		sub.ConvoyCmd(),
		sub.KafkaCmd(),
		sub.AirflowCmd(),
		sub.BDCmd(),
		sub.GTCmd(),
		sub.TUICmd(),
		sub.SessionCmd(),
	)
}
