import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config", () => {
    it("rewrites API requests to the backend service", async () => {
        const rewrites = typeof nextConfig.rewrites === "function"
            ? await nextConfig.rewrites()
            : nextConfig.rewrites;

        expect(rewrites).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    source: "/api/:path*",
                    destination: expect.stringMatching(/http:\/\/.*:8000\/api\/:path\*/),
                }),
            ])
        );
    });
});
