import { describe, expect, it } from "vitest";
import { apiBaseUrlConfigurationError } from "../src/lib/deployment-config";

describe("API deployment configuration", () => {
  it.each(["https://api.skillsync.example", "http://localhost:8000", "http://127.0.0.1:8000"])(
    "accepts a safe API origin: %s",
    value => expect(apiBaseUrlConfigurationError(value)).toBeNull(),
  );

  it.each([
    "",
    "invalid",
    "http://api.skillsync.example",
    "https://user:password@api.skillsync.example",
    "https://api.skillsync.example/v1",
    "https://api.skillsync.example?debug=true",
  ])("rejects an unsafe API origin: %s", value => {
    expect(apiBaseUrlConfigurationError(value)).not.toBeNull();
  });
});
