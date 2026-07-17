"use client";

import { useId, useState } from "react";
import { getToggleButtonClasses } from "@src/styles/formStyles";
import CodeBlock from "./CodeBlock";
import type { CodeSample } from "./apiDocsContent";

type CodeExampleTabsProps = {
  samples: CodeSample[];
  /** Names the tab group for screen readers, e.g. "Synchronous run examples". */
  label: string;
  className?: string;
};

const CodeExampleTabs = ({
  samples,
  label,
  className = "",
}: CodeExampleTabsProps) => {
  const groupId = useId();
  const [activeLanguage, setActiveLanguage] = useState(samples[0].language);
  const active =
    samples.find((sample) => sample.language === activeLanguage) ?? samples[0];

  return (
    <div className={`space-y-3 ${className}`}>
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
        {samples.map((sample) => {
          const isActive = sample.language === active.language;
          return (
            <button
              key={sample.language}
              type="button"
              role="tab"
              id={`${groupId}-tab-${sample.language}`}
              aria-selected={isActive}
              aria-controls={`${groupId}-panel-${sample.language}`}
              onClick={() => setActiveLanguage(sample.language)}
              className={`${getToggleButtonClasses(isActive)} rounded-lg`}
            >
              {sample.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${groupId}-panel-${active.language}`}
        aria-labelledby={`${groupId}-tab-${active.language}`}
      >
        <CodeBlock code={active.code} label={`${label}, ${active.label}`} />
      </div>
    </div>
  );
};

export default CodeExampleTabs;
