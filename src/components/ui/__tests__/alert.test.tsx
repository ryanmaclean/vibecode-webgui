import React from 'react';
import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '../alert';

describe('Alert', () => {
  describe('Alert component', () => {
    it('renders with default props', () => {
      render(<Alert>Alert content</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Alert content');
    });

    it('applies default styles', () => {
      render(<Alert>Content</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('relative');
      expect(alert).toHaveClass('w-full');
      expect(alert).toHaveClass('rounded-lg');
      expect(alert).toHaveClass('border');
      expect(alert).toHaveClass('p-4');
    });

    it('applies custom className', () => {
      render(<Alert className="custom-alert">Content</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-alert');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Alert ref={ref}>Content</Alert>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('variants', () => {
    it('applies default variant styles', () => {
      render(<Alert variant="default">Default</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-background');
      expect(alert).toHaveClass('text-foreground');
    });

    it('applies destructive variant styles', () => {
      render(<Alert variant="destructive">Destructive</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('border-destructive/50');
      expect(alert).toHaveClass('text-destructive');
    });

    it('uses default variant when not specified', () => {
      render(<Alert>No Variant</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-background');
    });
  });

  describe('AlertTitle component', () => {
    it('renders with default props', () => {
      render(<AlertTitle>Title</AlertTitle>);
      const title = screen.getByRole('heading', { level: 5 });
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('Title');
    });

    it('applies default styles', () => {
      render(<AlertTitle data-testid="title">Title</AlertTitle>);
      const title = screen.getByTestId('title');
      expect(title).toHaveClass('mb-1');
      expect(title).toHaveClass('font-medium');
      expect(title).toHaveClass('leading-none');
      expect(title).toHaveClass('tracking-tight');
    });

    it('applies custom className', () => {
      render(<AlertTitle data-testid="title" className="custom-title">Title</AlertTitle>);
      const title = screen.getByTestId('title');
      expect(title).toHaveClass('custom-title');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(<AlertTitle ref={ref}>Title</AlertTitle>);
      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    });
  });

  describe('AlertDescription component', () => {
    it('renders with default props', () => {
      render(<AlertDescription>Description text</AlertDescription>);
      expect(screen.getByText('Description text')).toBeInTheDocument();
    });

    it('applies default styles', () => {
      render(<AlertDescription data-testid="desc">Description</AlertDescription>);
      const desc = screen.getByTestId('desc');
      expect(desc).toHaveClass('text-sm');
    });

    it('applies custom className', () => {
      render(<AlertDescription data-testid="desc" className="custom-desc">Description</AlertDescription>);
      const desc = screen.getByTestId('desc');
      expect(desc).toHaveClass('custom-desc');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(<AlertDescription ref={ref}>Description</AlertDescription>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Alert composition', () => {
    it('renders full alert structure correctly', () => {
      render(
        <Alert>
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>Your action was completed successfully.</AlertDescription>
        </Alert>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Success!' })).toBeInTheDocument();
      expect(screen.getByText('Your action was completed successfully.')).toBeInTheDocument();
    });

    it('renders with icon correctly', () => {
      const TestIcon = () => <svg data-testid="icon" />;
      render(
        <Alert>
          <TestIcon />
          <AlertTitle>With Icon</AlertTitle>
          <AlertDescription>Alert with an icon</AlertDescription>
        </Alert>
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'With Icon' })).toBeInTheDocument();
    });

    it('applies icon padding styles correctly', () => {
      render(<Alert data-testid="alert">Content</Alert>);
      const alert = screen.getByTestId('alert');
      // The alert has styles for icon positioning
      expect(alert).toHaveClass('[&>svg~*]:pl-7');
      expect(alert).toHaveClass('[&>svg+div]:translate-y-[-3px]');
      expect(alert).toHaveClass('[&>svg]:absolute');
      expect(alert).toHaveClass('[&>svg]:left-4');
      expect(alert).toHaveClass('[&>svg]:top-4');
    });
  });

  describe('accessibility', () => {
    it('has correct role attribute', () => {
      render(<Alert>Accessible alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('supports aria-labelledby', () => {
      render(
        <Alert aria-labelledby="alert-title">
          <AlertTitle id="alert-title">Important</AlertTitle>
          <AlertDescription>Details here</AlertDescription>
        </Alert>
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-labelledby', 'alert-title');
    });

    it('supports aria-describedby', () => {
      render(
        <Alert aria-describedby="alert-desc">
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription id="alert-desc">Please read this</AlertDescription>
        </Alert>
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-describedby', 'alert-desc');
    });
  });

  describe('different alert types', () => {
    it('renders error alert', () => {
      render(
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Something went wrong.</AlertDescription>
        </Alert>
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('text-destructive');
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('renders info alert', () => {
      render(
        <Alert>
          <AlertTitle>Information</AlertTitle>
          <AlertDescription>Here is some useful information.</AlertDescription>
        </Alert>
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Information')).toBeInTheDocument();
    });
  });
});
