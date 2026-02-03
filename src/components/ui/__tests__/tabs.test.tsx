import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs';

// Helper to render a basic tabs component
const renderTabs = (props: {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
} = {}) => {
  const { defaultValue = 'tab1', onValueChange } = props;
  return render(
    <Tabs defaultValue={defaultValue} onValueChange={onValueChange}>
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content 1</TabsContent>
      <TabsContent value="tab2">Content 2</TabsContent>
      <TabsContent value="tab3">Content 3</TabsContent>
    </Tabs>
  );
};

describe('Tabs', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      renderTabs();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('renders tab triggers', () => {
      renderTabs();
      expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tab 3' })).toBeInTheDocument();
    });

    it('renders default tab content', () => {
      renderTabs({ defaultValue: 'tab1' });
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });

    it('shows correct content for default value', () => {
      renderTabs({ defaultValue: 'tab2' });
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });

  describe('TabsList', () => {
    it('applies default styles', () => {
      renderTabs();
      const tabsList = screen.getByRole('tablist');
      expect(tabsList).toHaveClass('inline-flex');
      expect(tabsList).toHaveClass('h-10');
      expect(tabsList).toHaveClass('items-center');
      expect(tabsList).toHaveClass('justify-center');
      expect(tabsList).toHaveClass('rounded-md');
      expect(tabsList).toHaveClass('bg-muted');
    });

    it('applies custom className', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList className="custom-list">
            <TabsTrigger value="tab1">Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      const tabsList = screen.getByRole('tablist');
      expect(tabsList).toHaveClass('custom-list');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Tabs defaultValue="tab1">
          <TabsList ref={ref}>
            <TabsTrigger value="tab1">Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('TabsTrigger', () => {
    it('applies default styles', () => {
      renderTabs();
      const trigger = screen.getByRole('tab', { name: 'Tab 1' });
      expect(trigger).toHaveClass('inline-flex');
      expect(trigger).toHaveClass('items-center');
      expect(trigger).toHaveClass('justify-center');
      expect(trigger).toHaveClass('whitespace-nowrap');
      expect(trigger).toHaveClass('rounded-sm');
    });

    it('applies custom className', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" className="custom-trigger">Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      const trigger = screen.getByRole('tab');
      expect(trigger).toHaveClass('custom-trigger');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" ref={ref}>Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('marks active tab correctly', () => {
      renderTabs({ defaultValue: 'tab1' });
      const activeTab = screen.getByRole('tab', { name: 'Tab 1' });
      expect(activeTab).toHaveAttribute('data-state', 'active');
    });

    it('marks inactive tabs correctly', () => {
      renderTabs({ defaultValue: 'tab1' });
      const inactiveTab = screen.getByRole('tab', { name: 'Tab 2' });
      expect(inactiveTab).toHaveAttribute('data-state', 'inactive');
    });
  });

  describe('TabsContent', () => {
    it('applies default styles', () => {
      renderTabs();
      const content = screen.getByRole('tabpanel');
      expect(content).toHaveClass('mt-2');
    });

    it('applies custom className', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" className="custom-content">Content</TabsContent>
        </Tabs>
      );
      const content = screen.getByRole('tabpanel');
      expect(content).toHaveClass('custom-content');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" ref={ref}>Content</TabsContent>
        </Tabs>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('interaction', () => {
    it('switches content on tab click', async () => {
      const user = userEvent.setup();
      renderTabs();

      expect(screen.getByText('Content 1')).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Tab 2' }));

      await waitFor(() => {
        expect(screen.getByText('Content 2')).toBeInTheDocument();
      });
    });

    it('calls onValueChange when tab changes', async () => {
      const handleValueChange = jest.fn();
      const user = userEvent.setup();
      renderTabs({ onValueChange: handleValueChange });

      await user.click(screen.getByRole('tab', { name: 'Tab 2' }));
      expect(handleValueChange).toHaveBeenCalledWith('tab2');
    });

    it('updates active state on tab change', async () => {
      const user = userEvent.setup();
      renderTabs();

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });

      expect(tab1).toHaveAttribute('data-state', 'active');
      expect(tab2).toHaveAttribute('data-state', 'inactive');

      await user.click(tab2);

      await waitFor(() => {
        expect(tab1).toHaveAttribute('data-state', 'inactive');
        expect(tab2).toHaveAttribute('data-state', 'active');
      });
    });
  });

  describe('disabled state', () => {
    it('does not switch to disabled tab', async () => {
      const handleValueChange = jest.fn();
      const user = userEvent.setup();
      render(
        <Tabs defaultValue="tab1" onValueChange={handleValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled>Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const disabledTab = screen.getByRole('tab', { name: 'Tab 2' });
      expect(disabledTab).toBeDisabled();

      await user.click(disabledTab);
      expect(handleValueChange).not.toHaveBeenCalled();
    });

    it('applies disabled styles', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled>Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
      const disabledTab = screen.getByRole('tab', { name: 'Tab 2' });
      expect(disabledTab).toHaveClass('disabled:pointer-events-none');
      expect(disabledTab).toHaveClass('disabled:opacity-50');
    });
  });

  describe('keyboard navigation', () => {
    it('supports keyboard navigation between tabs', async () => {
      const user = userEvent.setup();
      renderTabs();

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });

      // Click to focus instead of direct focus to avoid act() warnings
      await user.click(tab1);
      await user.keyboard('{ArrowRight}');

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveFocus();
      });
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes on tablist', () => {
      renderTabs();
      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
    });

    it('has correct ARIA attributes on tabs', () => {
      renderTabs();
      const tab = screen.getByRole('tab', { name: 'Tab 1' });
      expect(tab).toHaveAttribute('aria-selected', 'true');
    });

    it('has correct ARIA attributes on tabpanel', () => {
      renderTabs();
      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toBeInTheDocument();
    });
  });
});
