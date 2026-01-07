/**
 * Partial mock for Node.js 'os' module
 * Provides consistent system information for tests
 */

// Import the actual os module
const actualOs = jest.requireActual('os');

// Export a partial mock that overrides system-specific functions
// with consistent test values while preserving the actual module structure
module.exports = {
  ...actualOs,

  // System information - provide consistent values across test environments
  platform: jest.fn(() => 'linux'),
  type: jest.fn(() => 'Linux'),
  release: jest.fn(() => '5.10.0'),
  arch: jest.fn(() => 'x64'),
  hostname: jest.fn(() => 'test-host'),

  // User information
  homedir: jest.fn(() => '/home/testuser'),
  tmpdir: jest.fn(() => '/tmp'),
  userInfo: jest.fn(() => ({
    username: 'testuser',
    uid: 1000,
    gid: 1000,
    shell: '/bin/bash',
    homedir: '/home/testuser'
  })),

  // Memory information (returns bytes)
  totalmem: jest.fn(() => 16 * 1024 * 1024 * 1024), // 16 GB
  freemem: jest.fn(() => 8 * 1024 * 1024 * 1024),   // 8 GB

  // CPU information
  cpus: jest.fn(() => [
    {
      model: 'Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz',
      speed: 2600,
      times: {
        user: 252020,
        nice: 0,
        sys: 30340,
        idle: 1070356870,
        irq: 0
      }
    },
    {
      model: 'Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz',
      speed: 2600,
      times: {
        user: 252020,
        nice: 0,
        sys: 30340,
        idle: 1070356870,
        irq: 0
      }
    }
  ]),

  // Network interfaces
  networkInterfaces: jest.fn(() => ({
    lo: [
      {
        address: '127.0.0.1',
        netmask: '255.0.0.0',
        family: 'IPv4',
        mac: '00:00:00:00:00:00',
        internal: true,
        cidr: '127.0.0.1/8'
      }
    ],
    eth0: [
      {
        address: '192.168.1.100',
        netmask: '255.255.255.0',
        family: 'IPv4',
        mac: '00:00:00:00:00:01',
        internal: false,
        cidr: '192.168.1.100/24'
      }
    ]
  })),

  // Load average (Unix only)
  loadavg: jest.fn(() => [0.5, 0.6, 0.7]),

  // Uptime
  uptime: jest.fn(() => 3600), // 1 hour in seconds

  // Endianness
  endianness: jest.fn(() => 'LE'),

  // Priority functions
  getPriority: jest.fn(() => 0),
  setPriority: jest.fn()
};
