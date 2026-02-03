package sub

import (
	"sort"
	"time"

	"td/internal/tdkafka"
)

type beadItem struct {
	ID   string
	Lane string
}

func listBeads() []beadItem {
	topics := []string{"tundra-beads-in-progress", "tundra-beads-created", "tundra-beads-escalated"}
	seen := map[string]beadItem{}
	for _, t := range topics {
		events, _ := tdkafka.FetchRecent(t, 20, 1*time.Second)
		for _, evt := range events {
			if evt.Bead == "" {
				continue
			}
			lane := evt.Lane
			if lane == "" {
				lane = "standard"
			}
			seen[evt.Bead] = beadItem{ID: evt.Bead, Lane: lane}
		}
	}
	items := make([]beadItem, 0, len(seen))
	for _, v := range seen {
		items = append(items, v)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}
