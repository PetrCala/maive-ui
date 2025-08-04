import { useState } from "react";
import type { DeepValueOf, ModelParameters } from "@src/types";
import { YesNoSelect, DropdownSelect } from "@src/components/Options";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import Tooltip from "../Tooltip";
import CONFIG from "@src/CONFIG";

export default function AdvancedOptions({
  maiveMethod,
  shouldUseInstrumenting,
  handleParameterChange,
}: {
  maiveMethod: DeepValueOf<typeof CONST.MAIVE_METHODS>;
  shouldUseInstrumenting: boolean;
  handleParameterChange: (
    param: keyof ModelParameters,
    value: string | boolean,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold focus:outline-none transition-colors duration-200"
        aria-expanded={open}
      >
        <span className="mr-2">{TEXT.model.advancedOptions.title}</span>
        <svg
          className={`w-4 h-4 transform transition-transform duration-200 ${
            open ? "rotate-90" : "rotate-0"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      {open && (
        <div className="mt-4 flex flex-col space-y-4">
          <div className="flex-shrink-0">
            <Tooltip
              content={TEXT.model.maiveMethod.tooltip}
              visible={CONFIG.TOOLTIPS_ENABLED.MODEL_PAGE}
            >
              <DropdownSelect
                label={TEXT.model.maiveMethod.label}
                value={maiveMethod}
                onChange={(value) =>
                  handleParameterChange(
                    "maiveMethod",
                    value as DeepValueOf<typeof CONST.MAIVE_METHODS>,
                  )
                }
                options={Object.values(CONST.MAIVE_METHODS).map((method) => ({
                  value: method,
                  label: method,
                }))}
              />
            </Tooltip>
          </div>
          <div className="flex-shrink-0">
            <Tooltip
              content={TEXT.model.shouldUseInstrumenting.tooltip}
              visible={CONFIG.TOOLTIPS_ENABLED.MODEL_PAGE}
            >
              <YesNoSelect
                label={TEXT.model.shouldUseInstrumenting.label}
                value={shouldUseInstrumenting}
                onChange={(value) =>
                  handleParameterChange("shouldUseInstrumenting", value)
                }
              />
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}
