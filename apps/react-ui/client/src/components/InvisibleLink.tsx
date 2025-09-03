import Link from "next/link";
import React from "react";

type InvisibleLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  target?: string;
  rel?: string;
};

const InvisibleLink: React.FC<InvisibleLinkProps> = ({
  href,
  children,
  className = "",
  target = "_blank",
  rel = "noopener noreferrer",
}) => {
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={`cursor-pointer hover:cursor-pointer ${className}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {children}
    </Link>
  );
};

export default InvisibleLink;
