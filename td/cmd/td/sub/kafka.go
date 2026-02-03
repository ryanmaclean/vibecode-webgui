package sub

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

func KafkaCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "kafka",
		Short: "Kafka helpers for Tundra Dome",
	}
	cmd.AddCommand(kafkaStatusCmd(), kafkaSummaryCmd(), kafkaTopicsCmd())
	return cmd
}

func kafkaStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show Kafka group/topic status",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runExternal(tdKafkaStatusScript())
		},
	}
}

func kafkaSummaryCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "summary",
		Short: "Show concise Kafka queue summary",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runExternal(tdKafkaSummaryScript())
		},
	}
}

func kafkaTopicsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "topics",
		Short: "Print Kafka topic list",
		RunE: func(cmd *cobra.Command, args []string) error {
			topicsFile := tdKafkaTopicsFile()
			data, err := os.ReadFile(topicsFile)
			if err != nil {
				return fmt.Errorf("read topics file %s: %w", topicsFile, err)
			}
			fmt.Fprint(os.Stdout, string(data))
			return nil
		},
	}
}
