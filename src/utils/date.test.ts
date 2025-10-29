import { describe, it, expect } from "vitest";
import { formatDate } from "./date";

describe("formatDate", () => {
  it("labels yesterday correctly", () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    expect(formatDate(date)).toBe("yesterday");
  });

  it("handles past dates", () => {
    const date = new Date();
    date.setDate(date.getDate() - 3);
    expect(formatDate(date)).toBe("3 days ago");
  });

  it("handles future dates", () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    expect(formatDate(date)).toBe("in 3 days");
  });
});
