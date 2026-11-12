// node:test keeps this typed with @types/node; `bun test` runs it natively.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hashPassword, verifyPassword } from "./auth";

describe("password hashing", () => {
  test("round trips and rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse battery");
    assert.match(stored, /^pbkdf2\$100000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/);
    assert.equal(await verifyPassword("correct horse battery", stored), true);
    assert.equal(await verifyPassword("correct horse batterY", stored), false);
  });

  test("salts every hash", async () => {
    const [a, b] = await Promise.all([hashPassword("same password"), hashPassword("same password")]);
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("same password", b), true);
  });

  test("rejects malformed stored values", async () => {
    assert.equal(await verifyPassword("anything", ""), false);
    assert.equal(await verifyPassword("anything", "bcrypt$10$abc$def"), false);
  });
});
