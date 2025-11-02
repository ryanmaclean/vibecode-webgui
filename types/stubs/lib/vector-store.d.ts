export const vectorStore: {
  getContext(query: string, workspaceId: string, limit?: number, threshold?: number): Promise<string>;
};
