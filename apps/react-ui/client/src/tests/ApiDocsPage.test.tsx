import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ApiDocsPage from "@src/pages/api-docs";
import Footer from "@components/Footer";
import CONST from "@src/CONST";

// GoBackButton uses the Pages-Router useRouter (next/router), which the global
// setup (next/navigation only) does not cover.
vi.mock("next/router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ApiDocsPage", () => {
  it("documents the base URL and every endpoint", () => {
    render(<ApiDocsPage />);

    expect(
      screen.getAllByText(CONST.LINKS.PUBLIC_API.BASE_URL).length,
    ).toBeGreaterThan(0);

    const table = within(
      screen.getByRole("table", { name: "Public API endpoints" }),
    );
    const endpoints = [
      "POST /v1/run-model",
      "POST /v1/run-rtma",
      "POST /v1/runs",
      "GET /v1/runs/{jobId}",
      "GET /v1/health",
    ];
    endpoints.forEach((endpoint) => {
      expect(table.getByText(endpoint)).toBeInTheDocument();
    });
  });

  it("states that the API is anonymous and steers callers to async", () => {
    render(<ApiDocsPage />);

    expect(
      screen.getByText(/free and anonymous: no accounts, no API keys/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Synchronous or asynchronous" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Async is the recommended default/i),
    ).toBeInTheDocument();
  });

  it("links out to the OpenAPI spec as the source of truth", () => {
    render(<ApiDocsPage />);

    expect(
      screen.getByRole("link", { name: /OpenAPI 3 spec/i }),
    ).toHaveAttribute("href", CONST.LINKS.PUBLIC_API.SPEC);
  });

  it("surfaces the Nature Communications citation", () => {
    render(<ApiDocsPage />);

    expect(
      screen.getByText(
        /Irsova, Z., Bom, P\.R\.D\., Havranek, T\., & Rachinger, H\. \(2025\)/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /paper/i })).toHaveAttribute(
      "href",
      CONST.LINKS.MAIVE.PAPER,
    );
  });

  it("switches the example language when a tab is selected", () => {
    render(<ApiDocsPage />);

    const tablist = screen.getByRole("tablist", {
      name: "Synchronous run example",
    });
    const pythonTab = within(tablist).getByRole("tab", {
      name: "Python (requests)",
    });
    expect(pythonTab).toHaveAttribute("aria-selected", "false");

    fireEvent.click(pythonTab);

    expect(pythonTab).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("button", {
        name: /Copy Synchronous run example, Python \(requests\)/i,
      }),
    ).toBeInTheDocument();
  });
});

describe("Footer", () => {
  it("links to the API docs page", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "API" })).toHaveAttribute(
      "href",
      CONST.LINKS.PUBLIC_API.DOCS_ROUTE,
    );
  });
});
