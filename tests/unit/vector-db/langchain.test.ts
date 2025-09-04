import { createLangChainRetriever } from "../../../../src/lib/vector-db/langchain";
import type { EnhancedVectorStore } from "../../../../src/lib/vector-db/enhanced-vector-store";

// Mock implementation of EnhancedVectorStore
const mockStore: EnhancedVectorStore = {
  async search(_query: string) {
    return ["result1", "result2"];
  },
};

test("LangChain retriever returns store results", async () => {
  const retriever = createLangChainRetriever(mockStore);
  const results = await retriever.invoke("test query");
  expect(results).toEqual(["result1", "result2"]);
});
