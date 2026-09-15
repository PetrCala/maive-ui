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

const seedDataset = (seValues: number[], studyIds?: string[]): void => {
  const rawData: DataArray = seValues.map((se, index) => ({
    effect: 0.3 + index * 0.01,
    se,
    n_obs: 100 + index,
    ...(studyIds ? { study_id: studyIds[index] } : {}),
  }));
  const uploaded: UploadedData = {
    id: DATA_ID,
    filename: "constant.csv",
    data: rawData,
    rawData,
    columnNames: studyIds
      ? ["effect", "se", "n_obs", "study_id"]
      : ["effect", "se", "n_obs"],
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
const READY_MESSAGE = "Your data is valid and ready for analysis!";
// With a warning on the page the success line must carry the caveat (#572).
const CAVEAT_PATTERN = /can be analyzed, but read the warning above first/;

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

    // Advisory, not an error: RTMA is a legitimate target for such data. But
    // the page must not also call the data ready without saying so (#572).
    expect(screen.getByText(CAVEAT_PATTERN)).toBeInTheDocument();
    expect(screen.queryByText(READY_MESSAGE)).not.toBeInTheDocument();
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
    expect(screen.getByText(CAVEAT_PATTERN)).toBeInTheDocument();
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

    await screen.findByText(READY_MESSAGE);
    expect(screen.queryByText(WARNING_PATTERN)).not.toBeInTheDocument();
  });
});

describe("ValidationPage study dummy rows (#23)", () => {
  beforeEach(() => {
    dataCache.clear();
  });

  it("only warns about one estimate per study and keeps the data usable", async () => {
    seedDataset(
      [0.1, 0.12, 0.15, 0.2, 0.25, 0.3],
      ["s1", "s2", "s3", "s4", "s5", "s6"],
    );
    renderPage();

    const warning = await screen.findByText(/unique study IDs\. Study dummies/);
    expect(warning.textContent).toContain(
      "The data has 6 rows for 6 unique study IDs.",
    );
    expect(warning.textContent).toContain("need at least 9 rows");
    expect(warning.textContent).toContain(
      "leave Fixed-Intercept Multilevel off for this data",
    );
    expect(screen.queryByText(/must be larger than/)).not.toBeInTheDocument();
    expect(screen.getByText(CAVEAT_PATTERN)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue to model setup/i }),
    ).toBeEnabled();
  });

  it("says nothing when the studies leave room for dummies", async () => {
    seedDataset(
      [0.1, 0.12, 0.15, 0.2, 0.25, 0.3],
      ["s1", "s1", "s1", "s2", "s2", "s3"],
    );
    renderPage();

    await screen.findByText(READY_MESSAGE);
    expect(screen.queryByText(/Study dummies add/)).not.toBeInTheDocument();
  });
});
