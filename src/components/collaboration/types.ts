export interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  color: string;
  avatar?: string;
  isOnline?: boolean;
  lastActive?: Date;
  cursorPosition?: {
    line: number;
    ch: number;
  };
  selection?: {
    anchor: { line: number; ch: number };
    head: { line: number; ch: number };
  };
}

export interface EditorPosition {
  line: number;
  ch: number;
}

export interface EditorSelection {
  anchor: EditorPosition;
  head: EditorPosition;
}

export interface EditorChangeEvent {
  from: EditorPosition;
  to: EditorPosition;
  text: string[];
  removed: string[];
  origin: string;
}

export interface CollaborationSession {
  documentId: string;
  projectId: string;
  filePath: string;
  users: Map<string, CollaborationUser>;
  createdAt: Date;
  updatedAt: Date;
}
