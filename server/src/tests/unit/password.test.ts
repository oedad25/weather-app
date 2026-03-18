import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "../../utils/password.js";

describe("password utils", () => {
  it("hashes a password and verifies it", async () => {
    const hash = await hashPassword("mypassword");
    expect(hash).not.toBe("mypassword");
    expect(await comparePassword("mypassword", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("mypassword");
    expect(await comparePassword("wrong", hash)).toBe(false);
  });
});
