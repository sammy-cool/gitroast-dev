import { describe, it } from "node:test";
import assert from "node:assert/strict";

function sanitizeGitHubInput(input) {
  let val = (input || "").trim();
  val = val
    .replace(/^https?:\/\/(?:www\.)?github\.com\//i, "")
    .replace(/^(?:www\.)?github\.com\//i, "")
    .replace(/^@+/, "")
    .replace(/^\/+|\/+$/g, "");
  return val;
}

describe("Client Input Sanitization", () => {
  it("should strip https://github.com/ prefix", () => {
    assert.equal(sanitizeGitHubInput("https://github.com/torvalds"), "torvalds");
  });

  it("should strip https://www.github.com/ prefix", () => {
    assert.equal(sanitizeGitHubInput("https://www.github.com/gaearon"), "gaearon");
  });

  it("should strip www.github.com/ without protocol", () => {
    assert.equal(sanitizeGitHubInput("www.github.com/shadcn"), "shadcn");
  });

  it("should strip github.com/ without protocol", () => {
    assert.equal(sanitizeGitHubInput("github.com/facebook/react"), "facebook/react");
  });

  it("should strip leading @ symbols and trailing slashes", () => {
    assert.equal(sanitizeGitHubInput("@rich-harris/"), "rich-harris");
    assert.equal(sanitizeGitHubInput("///vercel/next.js///"), "vercel/next.js");
  });

  it("should preserve plain usernames and repository slugs", () => {
    assert.equal(sanitizeGitHubInput("sindresorhus"), "sindresorhus");
    assert.equal(sanitizeGitHubInput("expressjs/express"), "expressjs/express");
  });
});
