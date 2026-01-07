const { exec } = require('child_process');
const { promisify } = require('util');

// Create a mock
const mockExec = jest.fn();
jest.mock('child_process', () => ({
  exec: mockExec
}));

const execAsync = promisify(exec);

describe('Mock Debug', () => {
  it('should work with 2 params', async () => {
    mockExec.mockImplementation((cmd, callback) => {
      console.log('mockExec called with args:', arguments.length, 'args');
      console.log('Arg 0:', typeof cmd, cmd);
      console.log('Arg 1:', typeof callback);
      console.log('Arg 2:', typeof arguments[2]);

      if (typeof callback === 'function') {
        callback(null, { stdout: 'test output', stderr: '' });
      } else {
        console.log('callback is not a function!');
      }
      return {};
    });

    const { stdout } = await execAsync('test command');
    expect(stdout).toBe('test output');
  });
});
