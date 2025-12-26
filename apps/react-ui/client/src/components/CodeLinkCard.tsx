import Link from "next/link";
import { FaExternalLinkAlt } from "react-icons/fa";

export type CodeLinkCardProps = {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

export default function CodeLinkCard({
  href,
  title,
  description,
  icon,
}: CodeLinkCardProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex w-full items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2 transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-900/30"
    >
      <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-200">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </p>
          <span className="mt-0.5 shrink-0 text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300">
            <FaExternalLinkAlt className="h-3 w-3" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
          {description}
        </p>
      </div>
    </Link>
  );
}
