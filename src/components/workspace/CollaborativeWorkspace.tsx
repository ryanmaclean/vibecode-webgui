import { useCollaboration } from "@/hooks/useCollaboration";
import { FC } from "react";

//
// Minimal props for the collaborative workspace component.
// The real implementation contains many more features,
// but for type‑checking we only need the fields that
// other parts of the app reference.
//
export interface CollaborativeWorkspaceProps {
  workspaceId?: string;
  userId?: string;
  userName?: string;
  initialProject?: unknown; // placeholder type
  onCreateTerminal?: () => void;
  onCreateDebugSession?: () => void;
  className?: string;
}

//
// A very small stub component that satisfies the
// TypeScript compiler and can be rendered in tests.
//
// It intentionally avoids importing or referencing any
// modules that are missing from the current codebase.
// The `useCollaboration` hook is imported for type safety,
// but its result is not used.
//
const CollaborativeWorkspace: FC<CollaborativeWorkspaceProps> = ({
  workspaceId = "",
  userId = "",
  userName = "",
  className,
}) => {
  // Hook is imported only to keep the external API stable.
  useCollaboration({
    workspaceId,
    conversationId: undefined, // not needed for the stub
    userId,
    userName,
  });

  return <div className={className}>Collaborative Workspace</div>;
};

export default CollaborativeWorkspace;
