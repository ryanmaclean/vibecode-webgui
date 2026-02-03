# Kafka Message Format Compatibility

Datadog DSM for Kafka uses message headers, which require:
- `log.message.format.version` >= `0.11.0.0`

## Check current broker config
```bash
kafka-configs --bootstrap-server localhost:9092 --describe --entity-type brokers --all | rg -n "log.message.format.version"
```

## If not set, add to broker config (Homebrew)
```bash
sudo rg -n "log.message.format.version" /opt/homebrew/etc/kafka/server.properties || true
sudo sh -c 'echo "log.message.format.version=4.1" >> /opt/homebrew/etc/kafka/server.properties'
sudo brew services restart kafka
```

Adjust the version to your broker’s major/minor if needed.
