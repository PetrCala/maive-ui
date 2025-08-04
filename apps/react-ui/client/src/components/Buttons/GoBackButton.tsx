import Link from "next/link";
import { useRouter } from "next/router";

interface GoBackButtonProps {
  href?: string;
  text?: string;
  variant?: "simple" | "styled";
  className?: string;
}

export default function GoBackButton({
  href,
  text = "Go back",
  variant = "styled",
  className = "",
}: GoBackButtonProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    if (!href) {
      e.preventDefault();
      router.back();
    }
  };

  const baseClasses = "transition-colors duration-200";

  const variantClasses = {
    simple: "text-blue-600 hover:text-blue-700",
    styled:
      "inline-block mb-8 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
  };

  const combinedClasses =
    `${baseClasses} ${variantClasses[variant]} ${className}`.trim();

  return (
    <Link href={href || "#"} onClick={handleClick} className={combinedClasses}>
      {variant === "styled" && "← "}
      {text}
    </Link>
  );
}
