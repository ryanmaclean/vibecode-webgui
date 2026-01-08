/**
 * Mock for y-leveldb module (not installed in dependencies)
 */

class LeveldbPersistence {
  constructor(path, doc) {
    this.path = path;
    this.doc = doc;
    this.whenSynced = Promise.resolve();
  }

  destroy() {
    // Mock destroy
  }
}

module.exports = {
  LeveldbPersistence
};
