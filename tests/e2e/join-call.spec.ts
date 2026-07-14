import { test, expect } from "@playwright/test";

// Constitution-mandated critical-flow smoke test (quickstart.md Scenario 5): two participants
// join the same voice channel and connect. Requires fake media devices (playwright.config.ts) —
// camera/mic access needs HTTPS or localhost, and this runs against localhost (dev server).
test("two participants joining the same voice channel see each other's tile", async ({
  browser,
}) => {
  const rand = Date.now();
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  await alice.goto("/signup");
  await alice.fill("input[name=displayName]", "Alice");
  await alice.fill("input[name=email]", `alice${rand}@example.com`);
  await alice.fill("input[name=password]", "password123");
  await alice.click("button[type=submit]");
  await alice.waitForURL("**/servers");

  await alice.fill('input[placeholder="Server name"]', "Test Server");
  await alice.click('button:has-text("Create Server")');
  await alice.waitForURL(/\/servers\/.+\/.+/);
  const inviteUrl = await alice.inputValue("input[readonly]");

  // Alice creates a voice channel
  await alice.click('button[title="Create channel"]');
  await alice.fill('input[placeholder="Channel name"]', "voice-room");
  await alice.check('input[type=radio] >> nth=1'); // "Voice" radio
  await alice.click('button:has-text("Create")');
  await alice.click("text=voice-room");
  await alice.waitForURL(/\/servers\/.+\/.+/);

  await bob.goto("/signup");
  await bob.fill("input[name=displayName]", "Bob");
  await bob.fill("input[name=email]", `bob${rand}@example.com`);
  await bob.fill("input[name=password]", "password123");
  await bob.click("button[type=submit]");
  await bob.waitForURL("**/servers");
  await bob.goto(inviteUrl);
  await bob.waitForURL(/\/servers\/.+\/.+/);
  await bob.click("text=voice-room");

  await alice.click('button:has-text("Join Call")');
  await bob.click('button:has-text("Join Call")');

  await expect(alice.getByText("Bob", { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(bob.getByText("Alice", { exact: true })).toBeVisible({ timeout: 10000 });

  await aliceContext.close();
  await bobContext.close();
});
