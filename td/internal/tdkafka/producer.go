package tdkafka

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
)

type Event struct {
	TS       string                 `json:"ts"`
	Type     string                 `json:"type"`
	Event    string                 `json:"event,omitempty"`
	Lane     string                 `json:"lane,omitempty"`
	Bead     string                 `json:"bead,omitempty"`
	Target   string                 `json:"target,omitempty"`
	Message  string                 `json:"message,omitempty"`
	Rig      string                 `json:"rig,omitempty"`
	Role     string                 `json:"role,omitempty"`
	Stage    string                 `json:"stage,omitempty"`
	Schema   map[string]string      `json:"schema,omitempty"`
	Payload  map[string]interface{} `json:"payload,omitempty"`
	Source   string                 `json:"source,omitempty"`
	Severity string                 `json:"severity,omitempty"`
}

func brokers() []string {
	val := os.Getenv("TD_KAFKA_BROKERS")
	if val == "" {
		// Accept KAFKA_BROKERS for compatibility with DSM shell scripts and env files.
		val = os.Getenv("KAFKA_BROKERS")
	}
	if val == "" {
		val = "localhost:9092"
	}
	parts := strings.Split(val, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func write(topic string, evt Event) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	w := &kafka.Writer{
		Addr:                   kafka.TCP(brokers()...),
		Topic:                  topic,
		AllowAutoTopicCreation: true,
		Balancer:               &kafka.LeastBytes{},
	}
	defer w.Close()

	if evt.TS == "" {
		evt.TS = time.Now().UTC().Format(time.RFC3339)
	}
	payload, err := json.Marshal(evt)
	if err != nil {
		return err
	}
	return w.WriteMessages(ctx, kafka.Message{Value: payload})
}

func Publish(topic string, evt Event) error {
	return write(topic, evt)
}
