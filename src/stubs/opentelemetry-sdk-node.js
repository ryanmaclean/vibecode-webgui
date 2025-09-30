class NoopSDK {
  start() {}
  shutdown() {}
}

module.exports = {
  NodeSDK: NoopSDK,
}
