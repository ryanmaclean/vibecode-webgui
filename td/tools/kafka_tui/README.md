# kafka_tui

Small Rust TUI to show Kafka consumer lag by group/topic.

## Build
```
cd td/tools/kafka_tui
cargo build --release
```

## Run
```
export TD_KAFKA_BROKERS=localhost:9092
export TD_CONSUMER_GROUPS=tundra-td-event-emitter,tundra-observer,gastown-bridge
./target/release/kafka_tui
```

Press `q` to quit.
