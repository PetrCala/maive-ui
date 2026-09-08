import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import CanonicalLink, { canonicalPath } from "@components/CanonicalLink";
import CONST from "@src/CONST";

const routerState = { asPath: "/" };

vi.mock("next/router", () => ({
  useRouter: () => routerState,
}));

// next/head renders nothing in jsdom outside a Next.js app; collect the
// children it is handed instead.
vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("CanonicalLink (#571)", () => {
  it("points at the canonical domain plus the path", () => {
    routerState.asPath = "/api-docs";
    const { container } = render(<CanonicalLink />);
    const link = container.querySelector('link[rel="canonical"]');
    expect(link?.getAttribute("href")).toBe(
      `${CONST.LINKS.APP.WEBSITE}/api-docs`,
    );
  });

  it("drops the query string and fragment", () => {
    routerState.asPath = "/results?run=abc#top";
    const { container } = render(<CanonicalLink />);
    expect(
      container.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe(`${CONST.LINKS.APP.WEBSITE}/results`);
  });

  it("never hardcodes the domain", () => {
    expect(CONST.LINKS.APP.WEBSITE).toBe("https://easymeta.org");
    expect(canonicalPath("/")).toBe("/");
    expect(canonicalPath("/upload?x=1")).toBe("/upload");
    expect(canonicalPath("about")).toBe("/about");
  });
});
