"use client";

import CONST from "@src/CONST";

interface FooterProps {
  className?: string;
}

const FooterLinkItemContents = ({
  svgPath,
  text,
}: {
  svgPath: string;
  text: string;
}) => {
  return (
    <>
      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
        <path d={svgPath} />
      </svg>
      {text}
    </>
  );
};

const FooterHrefLinkItem = ({
  svgPath,
  href,
  text,
}: {
  svgPath: string;
  text: string;
  href: string;
}) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-blue-400 transition-colors duration-200 flex items-center"
    >
      <FooterLinkItemContents svgPath={svgPath} text={text} />
    </a>
  );
};

const FooterButtonLinkItem = ({
  svgPath,
  text,
  onClick,
}: {
  svgPath: string;
  text: string;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      className="hover:text-blue-400 transition-colors duration-200 flex items-center"
    >
      <FooterLinkItemContents svgPath={svgPath} text={text} />
    </button>
  );
};

const Footer = ({ className = "" }: FooterProps) => {
  const handleContactClick = () => {
    window.location.href = `mailto:${CONST.FOOTER.CONTACT_EMAIL}`;
  };

  return (
    <footer
      className={`bg-gray-900 text-gray-300 py-4 px-6 border-t border-gray-700 h-16 flex items-center justify-between ${className}`}
    >
      {/* Copyright */}
      <div className="text-sm">{CONST.FOOTER.COPYRIGHT}</div>

      {/* Links */}
      <div className="flex items-center space-x-6 text-sm">
        <FooterHrefLinkItem
          href={CONST.FOOTER.GITHUB_URL}
          svgPath="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
          text="GitHub"
        />

        <FooterButtonLinkItem
          onClick={handleContactClick}
          svgPath="M0 3v18h24v-18h-24zm21.518 2l-9.518 7.713-9.518-7.713h19.036zm-19.518 14v-11.817l10 8.104 10-8.104v11.817h-20z"
          text="Contact"
        />

        <FooterHrefLinkItem
          href={CONST.FOOTER.ISSUE_REPORT_URL}
          svgPath="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-1.31 7.186c-.384 0-.701.317-.701.701v5.105c0 .385.317.701.701.701h2.62c.384 0 .701-.316.701-.701v-5.105c0-.384-.317-.701-.701-.701h-2.62zm-.701-3.251c0-.384.317-.701.701-.701h2.62c.384 0 .701.317.701.701v2.62c0 .384-.317.701-.701.701h-2.62c-.384 0-.701-.317-.701-.701v-2.62z"
          text="Report Issues"
        />
      </div>
    </footer>
  );
};

export default Footer;
