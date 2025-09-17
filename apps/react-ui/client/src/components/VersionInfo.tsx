import packageInfo from "../../package.json";

type VersionInfoProps = {
  className?: string;
  label?: string;
  value?: string;
};

export default function VersionInfo({
  className,
  label = "Version",
  value,
}: VersionInfoProps) {
  const displayValue = value ?? packageInfo.version;
  const baseClass = "text-xs text-muted";
  const classes = [baseClass, className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {label ? (
        <>
          {label} {displayValue}
        </>
      ) : (
        displayValue
      )}
    </div>
  );
}
