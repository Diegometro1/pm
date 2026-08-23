import { test, expect } from "@playwright/test";
import { dragTo } from "./drag-helper";

test("moves a card and persists across reload", async ({ page }) => {
    await page.goto("/");
    // ensure logged in (if login screen shows, perform sign in)
    if (await page.getByRole("heading", { name: /sign in/i }).isVisible()) {
        await page.getByLabel("Username").fill("user");
        await page.getByLabel("Password").fill("password");
        await page.getByRole("button", { name: /sign in/i }).click();
        await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
    }

    const card = page.getByTestId("card-card-1");
    const target = page.getByTestId("column-col-review");

    await dragTo(page, card, target);

    // wait for move to be visible in UI
    await expect(target.getByTestId("card-card-1")).toBeVisible();

    // wait for the debounced auto-save to reach the backend before reloading
    await page.waitForResponse(
        (res) => res.url().includes("/api/board") && res.request().method() === "PUT"
    );

    // reload and verify the card remains in the same column (persistence)
    await page.reload();
    await expect(target.getByTestId("card-card-1")).toBeVisible();
});
