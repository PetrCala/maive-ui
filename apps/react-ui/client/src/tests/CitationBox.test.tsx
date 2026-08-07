import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CitationBox from "@components/CitationBox";
import { getCitationsForModel } from "@src/utils/citationUtils";

describe("CitationBox", () => {
  it("defaults to the single MAIVE citation with a plain label (footer modal path)", () => {
    render(<CitationBox variant="full" onClose={vi.fn()} />);

    expect(screen.getByText(/Irsova, Z\., Bom, P\.R\.D\./)).toBeInTheDocument();
    expect(screen.queryByText("Method")).not.toBeInTheDocument();
    expect(screen.queryByText(/Mathur/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("renders labeled method, software, and application citations for RTMA", () => {
    render(
      <CitationBox variant="full" citations={getCitationsForModel("RTMA")} />,
    );

    expect(screen.getByText("Method")).toBeInTheDocument();
    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(screen.getByText(/Mathur, M\. B\. \(2024\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/phacking: Sensitivity Analysis for p-Hacking/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Irsova, Z\., Bom, P\.R\.D\./)).toBeInTheDocument();
  });

  it("shows Mathur first in the compact variant for RTMA runs", () => {
    render(
      <CitationBox
        variant="compact"
        citations={getCitationsForModel("RTMA")}
      />,
    );

    const labels = ["Method:", "Software:", "Application:"].map(
      (label) => screen.getByText(label).textContent,
    );
    expect(labels).toHaveLength(3);
    expect(
      screen.getByText(/Mathur, Research Synthesis Methods, 2024\./),
    ).toBeInTheDocument();
  });

  it("keeps the compact variant a single unlabeled line for MAIVE runs", () => {
    render(
      <CitationBox
        variant="compact"
        citations={getCitationsForModel("MAIVE")}
      />,
    );

    expect(screen.getByText("Citation:")).toBeInTheDocument();
    expect(
      screen.getByText(/Irsova et al\., Nature Communications, 2025\./),
    ).toBeInTheDocument();
    expect(screen.queryByText("Method:")).not.toBeInTheDocument();
  });
});
