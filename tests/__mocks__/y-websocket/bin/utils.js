/**
 * Mock for y-websocket/bin/utils module
 * Used in collaboration server tests
 */

const setPersistence = jest.fn();
const setContentInitializor = jest.fn();
const messageSync = 0;
const messageAwareness = 1;

module.exports = {
  setPersistence,
  setContentInitializor,
  messageSync,
  messageAwareness,
};
