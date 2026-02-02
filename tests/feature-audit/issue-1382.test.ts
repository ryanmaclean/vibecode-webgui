import fs from "fs";
import path from "path";

describe("feature audit doc for issue 1382", () => {
  it("exists and has TODO scaffolding", () => {
    const docPath = path.join(process.cwd(), "docs/feature-audit/issue-1382.md");
    const contents = fs.readFileSync(docPath, "utf8");
    expect(contents).toContain("Issue: #1382");
    expect(contents).toContain("TODO:");
  });
});
