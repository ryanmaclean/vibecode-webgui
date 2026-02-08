package sub

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"td/internal/tdkafka"
)

// Registry cluster names
const (
	ClusterTundraDome   = "tundra-dome"
	ClusterGastown      = "gastown"
	ClusterVibecodeLocal = "vibecode-local"
	ClusterAll          = "all"
)

// ValidClusters lists all known cluster names
var ValidClusters = []string{ClusterTundraDome, ClusterGastown, ClusterVibecodeLocal}

// FederationTopic is the topic all clusters subscribe to for cross-cluster beads
const FederationTopic = "tundra-federation-beads"

func SlingCmd() *cobra.Command {
	var lane string
	var message string
	var target string
	var cluster string
	var clusters string
	cmd := &cobra.Command{
		Use:   "sling <bead>",
		Short: "Sling a bead into the Tundra fabric",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			bead := args[0]
			lane = normalizeLane(lane)

			// Resolve target clusters
			targetClusters := resolveTargetClusters(cluster, clusters)

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

			// Add cluster routing info to event payload
			if len(targetClusters) > 0 {
				evt.Payload = map[string]interface{}{
					"target_clusters": targetClusters,
				}
			}

			// Publish to federation topic if targeting all clusters
			if cluster == ClusterAll {
				if err := tdkafka.Publish(FederationTopic, evt); err != nil {
					return fmt.Errorf("failed to publish to federation topic: %w", err)
				}
			} else if len(targetClusters) > 0 {
				// Publish to each specific cluster's intake topic
				for _, c := range targetClusters {
					clusterTopic := fmt.Sprintf("tundra-%s-intake", c)
					if err := tdkafka.Publish(clusterTopic, evt); err != nil {
						return fmt.Errorf("failed to publish to cluster %s: %w", c, err)
					}
				}
			}

			// Always publish to standard topics for local processing
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
	cmd.Flags().StringVar(&cluster, "cluster", "", "target cluster: all, tundra-dome, gastown, vibecode-local")
	cmd.Flags().StringVar(&clusters, "clusters", "", "comma-separated list of target clusters")
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

// resolveTargetClusters determines target clusters from --cluster and --clusters flags
func resolveTargetClusters(cluster, clusters string) []string {
	var result []string

	// Handle --cluster flag
	if cluster != "" && cluster != ClusterAll {
		if isValidCluster(cluster) {
			result = append(result, cluster)
		}
	}

	// Handle --clusters flag (comma-separated)
	if clusters != "" {
		for _, c := range strings.Split(clusters, ",") {
			c = strings.TrimSpace(c)
			if c != "" && isValidCluster(c) && !contains(result, c) {
				result = append(result, c)
			}
		}
	}

	return result
}

// isValidCluster checks if a cluster name is in the registry
func isValidCluster(name string) bool {
	for _, valid := range ValidClusters {
		if name == valid {
			return true
		}
	}
	return false
}

// contains checks if a string slice contains a value
func contains(slice []string, val string) bool {
	for _, s := range slice {
		if s == val {
			return true
		}
	}
	return false
}
