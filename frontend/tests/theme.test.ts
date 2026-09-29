import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "src/styles/theme.css"), "utf8");
function tokens(selector: string) {
  const block = stylesheet.split(`${selector} {`)[1].split("}")[0];
  return Object.fromEntries(Array.from(block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi), match => [match[1], match[2]]));
}
function luminance(hex: string) {
  const values = hex.slice(1).match(/../g)!.map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
describe.each([":root", ".dark"])("%s theme", selector => {
  const colors = tokens(selector);
  it.each([["foreground", "input-background"], ["muted-foreground", "input-background"], ["muted-foreground", "card"], ["primary-foreground", "primary"], ["primary", "card"], ["destructive", "card"], ["destructive-foreground", "destructive"]])("has readable %s on %s", (text, background) => expect(contrast(colors[text], colors[background])).toBeGreaterThanOrEqual(4.5));
  it("has distinguishable input borders", () => expect(contrast(colors.input, colors.card)).toBeGreaterThanOrEqual(3));
});
it("overrides dark input and switch backgrounds", () => {
  expect(tokens(".dark")["input-background"]).not.toBe(tokens(":root")["input-background"]);
  expect(tokens(".dark")["switch-background"]).not.toBe(tokens(":root")["switch-background"]);
});
