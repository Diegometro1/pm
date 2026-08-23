import type { Locator, Page } from "@playwright/test";

const POINTER_ID = 1;

/**
 * Drags `source` onto `target` by dispatching a synthetic PointerEvent
 * sequence directly, rather than Playwright's CDP-level page.mouse.*
 * API. Attempt at fixing #2: CI's headless Chromium never activates
 * dnd-kit's PointerSensor via page.mouse.*, even with a high move step
 * count (ruled out separately, see the issue) -- this instead sets the
 * pointerId/pointerType/isPrimary/buttons fields the sensor reads
 * directly, in case CDP-synthesized events don't carry them the same
 * way a real OS pointer does in headless mode.
 *
 * pointerdown is dispatched on `source` itself, matching where
 * dnd-kit's listeners attach (KanbanCard.tsx spreads them directly
 * onto the card element). pointermove/pointerup are dispatched on
 * `body` because dnd-kit's sensor tracks them via document-level
 * listeners once a drag starts, not the original target.
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

  const base = {
    pointerId: POINTER_ID,
    pointerType: "mouse",
    isPrimary: true,
    bubbles: true,
    cancelable: true,
  };

  await source.dispatchEvent("pointerdown", {
    ...base,
    button: 0,
    buttons: 1,
    clientX: startX,
    clientY: startY,
  });

  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps;
    const y = startY + ((endY - startY) * i) / steps;
    await page.dispatchEvent("body", "pointermove", {
      ...base,
      buttons: 1,
      clientX: x,
      clientY: y,
    });
  }

  await page.dispatchEvent("body", "pointerup", {
    ...base,
    button: 0,
    buttons: 0,
    clientX: endX,
    clientY: endY,
  });
}
