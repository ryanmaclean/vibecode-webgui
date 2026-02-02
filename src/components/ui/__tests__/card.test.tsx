import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from '../card';

describe('Card', () => {
  describe('Card component', () => {
    it('renders with default props', () => {
      render(<Card data-testid="card">Card content</Card>);
      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('Card content');
    });

    it('applies default styles', () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('bg-card');
      expect(card).toHaveClass('shadow-sm');
    });

    it('applies custom className', () => {
      render(<Card data-testid="card" className="custom-card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-card');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Card ref={ref}>Content</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardHeader component', () => {
    it('renders with default props', () => {
      render(<CardHeader data-testid="header">Header content</CardHeader>);
      const header = screen.getByTestId('header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('Header content');
    });

    it('applies default styles', () => {
      render(<CardHeader data-testid="header">Header</CardHeader>);
      const header = screen.getByTestId('header');
      expect(header).toHaveClass('flex');
      expect(header).toHaveClass('flex-col');
      expect(header).toHaveClass('space-y-1.5');
      expect(header).toHaveClass('p-6');
    });

    it('applies custom className', () => {
      render(<CardHeader data-testid="header" className="custom-header">Header</CardHeader>);
      const header = screen.getByTestId('header');
      expect(header).toHaveClass('custom-header');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardHeader ref={ref}>Header</CardHeader>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardTitle component', () => {
    it('renders with default props', () => {
      render(<CardTitle>Title</CardTitle>);
      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('Title');
    });

    it('applies default styles', () => {
      render(<CardTitle data-testid="title">Title</CardTitle>);
      const title = screen.getByTestId('title');
      expect(title).toHaveClass('text-2xl');
      expect(title).toHaveClass('font-semibold');
      expect(title).toHaveClass('tracking-tight');
    });

    it('applies custom className', () => {
      render(<CardTitle data-testid="title" className="custom-title">Title</CardTitle>);
      const title = screen.getByTestId('title');
      expect(title).toHaveClass('custom-title');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(<CardTitle ref={ref}>Title</CardTitle>);
      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    });
  });

  describe('CardDescription component', () => {
    it('renders with default props', () => {
      render(<CardDescription>Description text</CardDescription>);
      expect(screen.getByText('Description text')).toBeInTheDocument();
    });

    it('applies default styles', () => {
      render(<CardDescription data-testid="desc">Description</CardDescription>);
      const desc = screen.getByTestId('desc');
      expect(desc).toHaveClass('text-sm');
      expect(desc).toHaveClass('text-muted-foreground');
    });

    it('applies custom className', () => {
      render(<CardDescription data-testid="desc" className="custom-desc">Description</CardDescription>);
      const desc = screen.getByTestId('desc');
      expect(desc).toHaveClass('custom-desc');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(<CardDescription ref={ref}>Description</CardDescription>);
      expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
    });
  });

  describe('CardContent component', () => {
    it('renders with default props', () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      const content = screen.getByTestId('content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent('Content');
    });

    it('applies default styles', () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      const content = screen.getByTestId('content');
      expect(content).toHaveClass('p-6');
      expect(content).toHaveClass('pt-0');
    });

    it('applies custom className', () => {
      render(<CardContent data-testid="content" className="custom-content">Content</CardContent>);
      const content = screen.getByTestId('content');
      expect(content).toHaveClass('custom-content');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardContent ref={ref}>Content</CardContent>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardFooter component', () => {
    it('renders with default props', () => {
      render(<CardFooter data-testid="footer">Footer content</CardFooter>);
      const footer = screen.getByTestId('footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveTextContent('Footer content');
    });

    it('applies default styles', () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      const footer = screen.getByTestId('footer');
      expect(footer).toHaveClass('flex');
      expect(footer).toHaveClass('items-center');
      expect(footer).toHaveClass('p-6');
      expect(footer).toHaveClass('pt-0');
    });

    it('applies custom className', () => {
      render(<CardFooter data-testid="footer" className="custom-footer">Footer</CardFooter>);
      const footer = screen.getByTestId('footer');
      expect(footer).toHaveClass('custom-footer');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardFooter ref={ref}>Footer</CardFooter>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Card composition', () => {
    it('renders full card structure correctly', () => {
      render(
        <Card data-testid="card">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>Main content here</CardContent>
          <CardFooter>Footer actions</CardFooter>
        </Card>
      );

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Card Title' })).toBeInTheDocument();
      expect(screen.getByText('Card Description')).toBeInTheDocument();
      expect(screen.getByText('Main content here')).toBeInTheDocument();
      expect(screen.getByText('Footer actions')).toBeInTheDocument();
    });
  });
});
