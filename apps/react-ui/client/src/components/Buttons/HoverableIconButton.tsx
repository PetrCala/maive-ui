/**
 * A component that renders an SVG icon with a hover effect.
 * @param svgContent - The content of the icon.
 * @param className - The class name of the icon.
 * @param onClick - The function to call when the button is clicked.
 * @param ariaLabel - The aria-label of the button.
 * @param buttonClassName - The class name of the button.
 * @returns A React component that renders an SVG icon with a hover effect.
 */
function HoverableIconButton({
  svgContent,
  onClick,
  className,
  ariaLabel,
  buttonClassName,
}: {
  svgContent: React.ReactNode;
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
  buttonClassName?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-2 text-secondary transition-colors duration-200 rounded-lg surface-secondary group focus-ring ${buttonClassName}`}
      aria-label={ariaLabel}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={`w-6 h-6 group-hover:scale-110 transition-transform duration-200 ${className}`}
      >
        {svgContent}
      </svg>
    </button>
  );
}

export default HoverableIconButton;
