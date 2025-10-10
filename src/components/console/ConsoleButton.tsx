import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useConsoleMode } from '@/hooks/useConsoleMode';
import * as React from 'react';

interface ConsoleButtonProps {
  workspaceId: string;
  className?: string;
}

export const ConsoleButton = React.memo(({ workspaceId, className }: ConsoleButtonProps) => {
  const { openConsole, isLoading } = useConsoleMode();

  const handleClick = React.useCallback(() => {
    openConsole(workspaceId);
  }, [openConsole, workspaceId]);

  return (
    <Tooltip content="Open Terminal with Goose">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={isLoading}
        className={className}
        aria-label="Open terminal"
      >
        <Terminal className="h-4 w-4" />
      </Button>
    </Tooltip>
  );
});

ConsoleButton.displayName = 'ConsoleButton';
