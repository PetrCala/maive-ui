import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ValidationPage from "@src/pages/validation";
import { GlobalAlertProvider } from "@src/components/GlobalAlertProvider";
import { dataCache } from "@store/dataStore";
import type { UploadedData } from "@store/dataStore";
import type { DataArray } from "@src/types";

const DATA_ID = "constant-se-test";

// The page reads its dataId from next/navigation; the global setup returns an
// empty query, so override it here. The GoBackButton uses the Pages-Router
// useRouter (next/router), which the global setup does not cover.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ dataId: DATA_ID }),
}));
vi.mock("next/router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// jsdom has no IndexedDB; the page only reads it when the in-memory cache is
// cold, and column-mapping writes go through the same module.
vi.mock("@src/utils/dataCacheDb", () => ({
  getUploadedData: vi.fn(() => Promise.resolve(undefined)),
  putUploadedData: vi.fn(() => Promise.resolve()),
  deleteUploadedData: vi.fn(() => Promise.resolve()),
}));

const seedDataset = (seValues: number[]): void => {
  const rawData: DataArray = seValues.map((se, index) => ({
    effect: 0.3 + index * 0.01,
    se,
    n_obs: 100 + index,
  }));
  const uploaded: UploadedData = {
    id: DATA_ID,
    filename: "constant.csv",
    data: rawData,
    rawData,
    columnNames: ["effect", "se", "n_obs"],
    hasHeaders: true,
    base64Data: "",
    uploadedAt: new Date(),
  };
  dataCache.set(DATA_ID, uploaded);
};

const renderPage = () =>
  render(
    <GlobalAlertProvider>
      <ValidationPage />
    </GlobalAlertProvider>,
  );

const WARNING_PATTERN = /has no usable variation/;

describe("ValidationPage constant-se warning (#572)", () => {
  beforeEach(() => {
    dataCache.clear();
  });

  it("warns about a constant se column but keeps the data valid", async () => {
    seedDataset([0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    renderPage();

    const warning = await screen.findByText(WARNING_PATTERN);
    expect(warning.textContent).toContain(
      "its 6 values vary by less than one part in 100,000 (the first is 0.1)",
    );
    expect(warning.textContent).toContain("RTMA");
    expect(warning.textContent).toContain(
      "part of log(SE) that sample size does not explain",
    );
    expect(warning.textContent).not.toMatch(/are all/);

    // Advisory, not an error: RTMA is a legitimate target for such data.
    expect(
      screen.getByText("Your data is valid and ready for analysis!"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue to model setup/i }),
    ).toBeEnabled();
  });

  it("warns about a column that varies below the tolerance", async () => {
    seedDataset([0.1, 0.1000005, 0.1, 0.1000005, 0.1, 0.1000005]);
    renderPage();

    const warning = await screen.findByText(WARNING_PATTERN);
    expect(warning.textContent).toContain("vary by less than one part in");
    expect(warning.textContent).not.toMatch(/are all/);
    expect(
      screen.getByText("Your data is valid and ready for analysis!"),
    ).toBeInTheDocument();
  });

  it("lists RDT among the models that need a sample-size column", async () => {
    const rawData: DataArray = [0.1, 0.12, 0.15, 0.2, 0.25, 0.3].map(
      (se, index) => ({ effect: 0.3 + index * 0.01, se }),
    );
    dataCache.set(DATA_ID, {
      id: DATA_ID,
      filename: "two-column.csv",
      data: rawData,
      rawData,
      columnNames: ["effect", "se"],
      hasHeaders: true,
      base64Data: "",
      uploadedAt: new Date(),
    });
    renderPage();

    const notice = await screen.findByText(/No sample-size column is mapped/);
    expect(notice.textContent).toContain(
      "MAIVE, WAIVE, WLS, and RDT require sample sizes",
    );
  });

  it("does not warn about a column with 1% variation", async () => {
    seedDataset([0.1, 0.101, 0.1, 0.101, 0.1, 0.101]);
    renderPage();

    await screen.findByText("Your data is valid and ready for analysis!");
    expect(screen.queryByText(WARNING_PATTERN)).not.toBeInTheDocument();
  });
});
