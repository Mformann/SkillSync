import { describe, expect, it } from "vitest";
import { supabaseConfigurationError } from "../src/lib/supabase-config";

const url = "https://test-project.supabase.co";
function legacyKey(role: string) { return `header.${btoa(JSON.stringify({ role }))}.signature`; }
describe("public Supabase configuration", () => {
  it("accepts a publishable key", () => expect(supabaseConfigurationError(url, "sb_publishable_fixture")).toBeNull());
  it("accepts a legacy public anon key", () => expect(supabaseConfigurationError(url, legacyKey("anon"))).toBeNull());
  it.each(["sb_secret_fixture", legacyKey("service_role"), legacyKey("authenticated"), "invalid"])("rejects secret or invalid keys before bundling", key => expect(supabaseConfigurationError(url, key)).toContain("public"));
  it.each(["", "invalid", "http://untrusted.example", "https://user:password@test.supabase.co", "https://test.supabase.co?redirect=1", "https://test.supabase.co/auth/v1"])("rejects an invalid project URL: %s", badUrl => expect(supabaseConfigurationError(badUrl, "sb_publishable_fixture")).not.toBeNull());
  it("allows local Supabase development", () => expect(supabaseConfigurationError("http://127.0.0.1:54321", "sb_publishable_fixture")).toBeNull());
});
