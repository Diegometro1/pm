import type { Locator, Page } from "@playwright/test";

/**
 * Drags `source` onto `target` via low-level mouse events. Uses a high
 * step count on the move so dnd-kit's PointerSensor sees enough
 * intermediate pointermove events to activate reliably (its
 * activationConstraint requires movement past 6px, see KanbanBoard.tsx)
 * even under CI's more constrained/slower event loop.
 */
export async function dragTo(
  page: Page,
  source: Locator,
  target: Locator,
  targetOffsetY = 120
) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetOffsetY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 30 });
  await page.mouse.up();
}
