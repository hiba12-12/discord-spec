import { test, expect } from "@playwright/test";

// Constitution-mandated critical-flow smoke test (quickstart.md Scenario 1): sign up two users,
// create a server, join via invite, and confirm a message sent by one appears for the other in
// real time with no manual refresh (SC-002).
test("a message sent by one member appears for another in real time", async ({ browser }) => {
  const rand = Date.now();
  const ownerContext = await browser.newContext();
  const joinerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const joiner = await joinerContext.newPage();

  await owner.goto("/signup");
  await owner.fill("input[name=displayName]", "Alice");
  await owner.fill("input[name=email]", `alice${rand}@example.com`);
  await owner.fill("input[name=password]", "password123");
  await owner.click("button[type=submit]");
  await owner.waitForURL("**/servers");

  await owner.fill('input[placeholder="Server name"]', "Test Server");
  await owner.click('button:has-text("Create Server")');
  await owner.waitForURL(/\/servers\/.+\/.+/);

  const inviteUrl = await owner.inputValue("input[readonly]");

  await joiner.goto("/signup");
  await joiner.fill("input[name=displayName]", "Bob");
  await joiner.fill("input[name=email]", `bob${rand}@example.com`);
  await joiner.fill("input[name=password]", "password123");
  await joiner.click("button[type=submit]");
  await joiner.waitForURL("**/servers");

  await joiner.goto(inviteUrl);
  await joiner.waitForURL(/\/servers\/.+\/.+/);

  await owner.fill('textarea[placeholder="Message #general"]', "Hello Bob!");
  await owner.press('textarea[placeholder="Message #general"]', "Enter");

  await expect(joiner.getByText("Hello Bob!")).toBeVisible({ timeout: 5000 });

  await ownerContext.close();
  await joinerContext.close();
});
