type HoverableIconButtonProps = {
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
  buttonClassName?: string;
};

/**
 * A component that renders an SVG icon with a hover effect.
 * @param icon - The content of the icon.
 * @param className - The class name of the icon.
 * @param ariaLabel - The aria-label of the button.
 * @param ariaLabel - The aria-label of the button.
 * @param buttonClassName - The class name of the button.
 */
function HoverableIconButton({
  icon,
  onClick,
  className,
  ariaLabel,
  buttonClassName,
}: HoverableIconButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-2 text-secondary transition-colors duration-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 group focus-ring ${buttonClassName}`}
      aria-label={ariaLabel}
    >
      <span className={`${className}`}>{icon}</span>
    </button>
  );
}

export default HoverableIconButton;
