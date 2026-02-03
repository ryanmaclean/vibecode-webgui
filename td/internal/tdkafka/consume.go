package tdkafka

import (
	"context"
	"encoding/json"
	"time"

	"github.com/segmentio/kafka-go"
)

func FetchRecent(topic string, limit int, timeout time.Duration) ([]Event, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     brokers(),
		Topic:       topic,
		StartOffset: kafka.LastOffset,
		MaxBytes:    10e6,
	})
	defer r.Close()

	events := make([]Event, 0, limit)
	for len(events) < limit {
		m, err := r.ReadMessage(ctx)
		if err != nil {
			break
		}
		var evt Event
		if err := json.Unmarshal(m.Value, &evt); err != nil {
			continue
		}
		events = append(events, evt)
	}
	return events, nil
}
