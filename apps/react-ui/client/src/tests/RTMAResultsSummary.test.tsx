import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RTMAResultsSummary from "@components/RTMAResultsSummary";
import type { RTMADiagnostics, RTMAResults } from "@src/types/api";

const baseResults: RTMAResults = {
  mu: 5.171,
  muCI: [4.5, 5.9],
  tau: 1.2,
  tauCI: [0.9, 1.6],
  zScorePlot: "data:image/png;base64,xxx",
  zScorePlotWidth: 600,
  zScorePlotHeight: 400,
  nonaffirmativeCount: 67,
  nonaffirmativeProportion: 0.905,
  warnings: [],
};

/** A fit with nothing wrong with it */
const healthyDiagnostics: RTMADiagnostics = {
  optimConverged: true,
  rHat: { mu: 1.001, tau: 1.002 },
  nEff: { mu: 1420, tau: 1548 },
  divergences: 0,
};

const fullResults: RTMAResults = {
  ...baseResults,
  muMedian: 5.233,
  tauMedian: 1.25,
  unadjustedMean: 3.081,
  ciLevel: 0.95,
  k: 74,
  affirmativeCount: 7,
  droppedRows: 2,
  diagnostics: healthyDiagnostics,
};

const withDiagnostics = (overrides: Partial<RTMADiagnostics>): RTMAResults => ({
  ...fullResults,
  diagnostics: { ...healthyDiagnostics, ...overrides },
});

/**
 * Alert copy is split across emphasis spans, so a single getByText cannot see
 * a whole message. Match against each alert's joined text instead.
 */
const alertTexts = (): string[] =>
  screen.queryAllByRole("alert").map((alert) => alert.textContent ?? "");

const expectAlertMatching = (pattern: RegExp): void => {
  expect(alertTexts().filter((text) => pattern.test(text))).not.toHaveLength(0);
};

const expectNoAlertMatching = (pattern: RegExp): void => {
  expect(alertTexts().filter((text) => pattern.test(text))).toHaveLength(0);
};

describe("RTMAResultsSummary", () => {
  it("shows the unadjusted mean next to the corrected effect", () => {
    render(<RTMAResultsSummary results={fullResults} />);

    expect(screen.getByText("Corrected Effect (μ)")).toBeInTheDocument();
    expect(screen.getByText("Unadjusted Mean")).toBeInTheDocument();
    expect(screen.getByText("3.081")).toBeInTheDocument();
  });

  it("labels the nonaffirmative count as not affirmative, not non-significant", () => {
    render(<RTMAResultsSummary results={fullResults} />);

    expect(screen.getByText("Not Affirmative Estimates")).toBeInTheDocument();
    expect(screen.getByText("67 (90.5%)")).toBeInTheDocument();
    expect(screen.queryByText(/Non-significant/)).not.toBeInTheDocument();
  });

  it("shows posterior medians alongside the modes", () => {
    render(<RTMAResultsSummary results={fullResults} />);

    expect(screen.getByText("median 5.233")).toBeInTheDocument();
    expect(screen.getByText("median 1.250")).toBeInTheDocument();
  });

  it("reports k, the affirmative share, and dropped rows", () => {
    render(<RTMAResultsSummary results={fullResults} />);

    expect(screen.getByText("Estimates Used (k)")).toBeInTheDocument();
    expect(screen.getByText("74")).toBeInTheDocument();
    expect(screen.getByText("7 affirmative")).toBeInTheDocument();
    expect(
      screen.getByText(
        /2 uploaded rows were dropped before fitting because of a missing or non-positive standard error\./,
      ),
    ).toBeInTheDocument();
  });

  it("renders legacy stored results without the newer fields", () => {
    render(<RTMAResultsSummary results={baseResults} />);

    expect(screen.getByText("Corrected Effect (μ)")).toBeInTheDocument();
    expect(screen.getByText("Not Affirmative Estimates")).toBeInTheDocument();
    expect(screen.queryByText("Unadjusted Mean")).not.toBeInTheDocument();
    expect(screen.queryByText("Estimates Used (k)")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/dropped before fitting/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/median/)).not.toBeInTheDocument();
  });

  it("still surfaces backend warnings", () => {
    render(
      <RTMAResultsSummary
        results={{ ...fullResults, warnings: ["Favored direction check"] }}
      />,
    );

    expect(screen.getByText("Favored direction check")).toBeInTheDocument();
  });

  it("stays quiet when every diagnostic is healthy", () => {
    render(<RTMAResultsSummary results={fullResults} />);

    expectNoAlertMatching(/converge|divergent|R-hat|effective sample size/i);
    expect(screen.getByText("5.171 [4.500, 5.900]")).toBeInTheDocument();
  });

  it("warns and withholds the mode when its optimisation did not converge", () => {
    render(
      <RTMAResultsSummary
        results={withDiagnostics({ optimConverged: false })}
      />,
    );

    expectAlertMatching(
      /optimisation behind the reported mode did not converge/i,
    );
    // The mode is the only number the failed optimisation produced, so it must
    // not still be sitting there as the headline estimate.
    expect(screen.queryByText("5.171 [4.500, 5.900]")).not.toBeInTheDocument();
    expect(screen.getByText("[4.500, 5.900]")).toBeInTheDocument();
    expect(
      screen.getByText(
        /mode 5\.171 withheld: its optimisation did not converge/,
      ),
    ).toBeInTheDocument();
    // tau's mode comes from the same optimisation and goes the same way.
    expect(screen.getByText("[0.900, 1.600]")).toBeInTheDocument();
  });

  it("warns when r_hat is above 1.01", () => {
    render(
      <RTMAResultsSummary
        results={withDiagnostics({ rHat: { mu: 1.043, tau: 1.002 } })}
      />,
    );

    expectAlertMatching(/R-hat is 1\.043 for μ, above the 1\.01/);
    // tau is inside the threshold, so it must not be named as an offender.
    expectNoAlertMatching(/1\.002 for τ/);
  });

  it("names both parameters when both r_hats are above the threshold", () => {
    render(
      <RTMAResultsSummary
        results={withDiagnostics({ rHat: { mu: 1.043, tau: 1.021 } })}
      />,
    );

    expectAlertMatching(/R-hat is 1\.043 for μ and 1\.021 for τ/);
  });

  it("warns on divergent transitions", () => {
    render(
      <RTMAResultsSummary results={withDiagnostics({ divergences: 12 })} />,
    );

    expectAlertMatching(/12 divergent transitions/);
  });

  it("warns when the effective sample size is low", () => {
    render(
      <RTMAResultsSummary
        results={withDiagnostics({ nEff: { mu: 312, tau: 1548 } })}
      />,
    );

    expectAlertMatching(/effective sample size is 312 for μ, below the 400/);
  });

  it("warns when RTMA had very few not-affirmative estimates to fit", () => {
    render(
      <RTMAResultsSummary
        results={{
          ...fullResults,
          nonaffirmativeCount: 4,
          nonaffirmativeProportion: 0.05,
        }}
      />,
    );

    expectAlertMatching(/fitted to only 4 not-affirmative estimates/);
  });

  it("treats an unreadable diagnostic as unknown rather than healthy", () => {
    render(
      <RTMAResultsSummary
        results={withDiagnostics({
          optimConverged: null,
          rHat: { mu: null, tau: null },
          nEff: { mu: null, tau: null },
          divergences: null,
        })}
      />,
    );

    // Nothing is known to be wrong, so nothing is claimed to be wrong; the
    // mode is still shown because no failed optimisation was reported.
    expectNoAlertMatching(/converge|divergent|R-hat|effective sample size/i);
    expect(screen.getByText("5.171 [4.500, 5.900]")).toBeInTheDocument();
  });

  it("raises no diagnostic warnings for a run stored before diagnostics existed", () => {
    render(<RTMAResultsSummary results={baseResults} />);

    expectNoAlertMatching(/converge|divergent|R-hat|effective sample size/i);
  });
});
