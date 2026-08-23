import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  // Specs share one backend-seeded board (card-1, col-review) with no
  // per-test isolation, so parallel workers race each other mutating it.
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "retain-on-failure",
  },
  webServer: {
    // Start the backend (which now serves the built static frontend at /)
    command: "uvicorn backend.main:app --host 127.0.0.1 --port 8000",
    url: "http://127.0.0.1:8000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
