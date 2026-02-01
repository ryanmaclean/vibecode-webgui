import fs from "fs";
import path from "path";

describe("feature audit doc for issue 1386", () => {
  it("exists and has TODO scaffolding", () => {
    const docPath = path.join(process.cwd(), "docs/feature-audit/issue-1386.md");
    const contents = fs.readFileSync(docPath, "utf8");
    expect(contents).toContain("Issue: #1386");
    expect(contents).toContain("TODO:");
  });
});
