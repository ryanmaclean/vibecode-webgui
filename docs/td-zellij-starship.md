# Tundra Dome: Zellij + Starship Console

This gives a live queue console without adding proprietary dependencies.

## Zellij layout
Use the provided layout:

```
zellij --layout td/config/zellij/layouts/tundra.kdl
```

## Starship prompt (optional)

1) Install starship
2) Link config:

```
mkdir -p ~/.config
ln -s $PWD/td/config/starship/starship.toml ~/.config/starship.toml
```

3) Ensure `td/scripts/kafka-queue-summary.sh` is executable.

## Scripts
- `td/scripts/kafka-queue-status.sh` : full group/topic status (for watch)
- `td/scripts/kafka-queue-summary.sh` : concise prompt summary

## Notes
- This assumes `kafka-consumer-groups` and `kafka-topics` are in PATH.
- Adjust `TD_QUEUE_TOPICS` and `TD_CONSUMER_GROUPS` to match your topology.
