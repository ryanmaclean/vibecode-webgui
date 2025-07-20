import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConsoleMode } from '@/hooks/useConsoleMode';

interface ConsoleButtonProps {
  workspaceId: string;
  className?: string;
}

export function ConsoleButton({ workspaceId, className }: ConsoleButtonProps) {
  const { openConsole, isLoading } = useConsoleMode();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openConsole(workspaceId)}
          disabled={isLoading}
          className={className}
          aria-label="Open terminal"
        >
          <Terminal className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Open Terminal with Goose</p>
      </TooltipContent>
    </Tooltip>
  );
}
