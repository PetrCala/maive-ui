import type { ReactNode, ElementType } from "react";

export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type SectionHeadingProps = {
  /**
   * The semantic heading level (h1-h6)
   * @default "h2"
   */
  level?: HeadingLevel;
  /**
   * The heading text content
   */
  children: ReactNode;
  /**
   * Optional icon to display to the left of the heading
   */
  icon?: ReactNode;
  /**
   * Optional description text to display below the heading
   */
  description?: string;
  /**
   * Additional CSS classes to apply to the heading container
   */
  className?: string;
  /**
   * Additional CSS classes to apply to the heading text itself
   */
  headingClassName?: string;
  /**
   * Additional CSS classes to apply to the description text
   */
  descriptionClassName?: string;
};

/**
 * SectionHeading - A flexible, reusable heading component with optional icon support
 *
 * This component provides consistent heading styles across the application while allowing
 * semantic HTML flexibility. It supports optional icons and description text.
 *
 * Visual Style Hierarchy (independent of semantic level):
 * - h1: text-2xl sm:text-3xl font-bold (page titles)
 * - h2: text-xl font-semibold (major sections)
 * - h3: text-lg font-semibold (subsections)
 * - h4-h6: text-base font-semibold (minor headings)
 *
 * @example
 * ```tsx
 * // Page title with icon
 * <SectionHeading level="h1" icon={<FaUpload />}>
 *   Upload Data
 * </SectionHeading>
 *
 * // Section heading with description
 * <SectionHeading level="h2" description="Configure your analysis settings">
 *   Model Parameters
 * </SectionHeading>
 *
 * // Subsection with icon and description
 * <SectionHeading
 *   level="h3"
 *   icon={<FaFilter />}
 *   description="Filter your dataset based on column values"
 * >
 *   Subsample Filter
 * </SectionHeading>
 * ```
 */
export default function SectionHeading({
  level = "h2",
  children,
  icon,
  description,
  className = "",
  headingClassName = "",
  descriptionClassName = "",
}: SectionHeadingProps) {
  // Map semantic levels to consistent visual styles
  const levelStyles: Record<HeadingLevel, string> = {
    h1: "text-2xl sm:text-3xl font-bold",
    h2: "text-xl font-semibold",
    h3: "text-lg font-semibold",
    h4: "text-base font-semibold",
    h5: "text-base font-semibold",
    h6: "text-base font-semibold",
  };

  // Icon sizes proportional to heading size
  const iconSizeClasses: Record<HeadingLevel, string> = {
    h1: "w-6 h-6",
    h2: "w-5 h-5",
    h3: "w-4 h-4",
    h4: "w-4 h-4",
    h5: "w-3.5 h-3.5",
    h6: "w-3.5 h-3.5",
  };

  const Component: ElementType = level;
  const headingClasses = `${levelStyles[level]} text-primary ${headingClassName}`;
  const descriptionClasses = `text-secondary text-sm ${descriptionClassName}`;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className="p-2 rounded-full bg-primary/10 text-primary">
            <div className={iconSizeClasses[level]}>{icon}</div>
          </div>
        )}
        <div className="flex-1 space-y-1">
          <Component className={headingClasses}>{children}</Component>
          {description && <p className={descriptionClasses}>{description}</p>}
        </div>
      </div>
    </div>
  );
}
