const React = require('react');

const Button = React.forwardRef((props, ref) => (
  <button ref={ref} {...props} data-testid="mock-button">
    {props.children}
  </button>
));
Button.displayName = 'Button';

const Textarea = React.forwardRef((props, ref) => (
  <textarea ref={ref} {...props} data-testid="mock-textarea" />
));
Textarea.displayName = 'Textarea';

const Card = ({ children, ...props }) => <div {...props} data-testid="mock-card">{children}</div>;
Card.displayName = 'Card';

const CardContent = ({ children, ...props }) => <div {...props} data-testid="mock-card-content">{children}</div>;
CardContent.displayName = 'CardContent';

const Badge = ({ children, ...props }) => <div {...props} data-testid="mock-badge">{children}</div>;
Badge.displayName = 'Badge';

const ScrollArea = ({ children, ...props }) => <div {...props} data-testid="mock-scroll-area">{children}</div>;
ScrollArea.displayName = 'ScrollArea';

module.exports = {
  Button,
  Textarea,
  Card,
  CardContent,
  Badge,
  ScrollArea,
};
