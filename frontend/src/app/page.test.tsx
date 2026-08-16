import { render, screen, fireEvent } from "@testing-library/react";
import Home from "./page";

describe("login flow", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("shows login form initially", () => {
        render(<Home />);
        expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    });

    it("rejects invalid credentials", () => {
        render(<Home />);
        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "wrong" } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "bad" } });
        fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
        expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
    });

    it("shows kanban after valid login", async () => {
        render(<Home />);
        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "user" } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password" } });
        fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
        expect(await screen.findByText(/kanban studio/i)).toBeInTheDocument();
    });

    it("logs out and returns to login view", async () => {
        render(<Home />);
        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "user" } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password" } });
        fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
        const logoutButton = await screen.findByRole("button", { name: /log out/i });
        fireEvent.click(logoutButton);
        expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    });
});