import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import UploadPage from "@src/pages/upload";

// The page's GoBackButton uses the Pages-Router useRouter (next/router),
// which the global setup (next/navigation only) does not cover.
vi.mock("next/router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const getAcceptedTypes = (container: HTMLElement): string[] => {
  const input = container.querySelector('input[type="file"]');
  return (input?.getAttribute("accept") ?? "")
    .split(",")
    .map((type) => type.trim().toLowerCase());
};

describe("UploadPage file type acceptance", () => {
  it("accepts the documented spreadsheet formats", () => {
    const { container } = render(<UploadPage />);
    const accepted = getAcceptedTypes(container);

    expect(accepted).toContain(".csv");
    expect(accepted).toContain(".xls");
    expect(accepted).toContain(".xlsx");
  });

  it("also accepts macro-enabled workbooks, which are not advertised", () => {
    const { container } = render(<UploadPage />);

    expect(getAcceptedTypes(container)).toContain(".xlsm");
  });
});
