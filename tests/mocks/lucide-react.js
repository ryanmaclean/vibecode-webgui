const React = require('react');

// Create a proxy to mock all named exports from lucide-react
const lucideMock = new Proxy({}, {
  get: function(target, prop) {
    // Return a simple mock component for any icon requested
    return (props) => React.createElement('svg', { ...props, 'data-testid': `lucide-icon-${String(prop)}` });
  }
});

module.exports = lucideMock;
