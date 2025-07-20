const React = require('react');

const Button = React.forwardRef(({ children, ...props }, ref) => (
  <button ref={ref} {...props} data-testid="mock-button">
    {children}
  </button>
));
Button.displayName = 'Button';

const Textarea = React.forwardRef((props, ref) => (
  <textarea ref={ref} {...props} data-testid="mock-textarea" />
));
Textarea.displayName = 'Textarea';

const Card = ({ children, ...props }) => <div {...props} data-testid="mock-card">{children}</div>;
const CardContent = ({ children, ...props }) => <div {...props} data-testid="mock-card-content">{children}</div>;
const Badge = ({ children, ...props }) => <div {...props} data-testid="mock-badge">{children}</div>;
const ScrollArea = ({ children, ...props }) => <div {...props} data-testid="mock-scroll-area">{children}</div>;

module.exports = {
  Button,
  Textarea,
  Card,
  CardContent,
  Badge,
  ScrollArea,
};
