import { describe, expect, it } from "vitest";

import { compareUtf16CodeUnits } from "../src/main.js";

describe("compareUtf16CodeUnits", () => {
  it("sorts strings without locale or numeric collation", () => {
    const values = ["あ.txt", "file-2.txt", "b.txt", "file-10.txt", "A.txt"];

    expect([...values].sort(compareUtf16CodeUnits)).toEqual([
      "A.txt",
      "b.txt",
      "file-10.txt",
      "file-2.txt",
      "あ.txt",
    ]);
  });
});
