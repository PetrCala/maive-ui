"use client";

import { useState, useEffect } from "react";
import CONST from "@src/CONST";
import CitationBox from "./CitationBox";
import InvisibleLink from "./InvisibleLink";
import CONFIG from "@src/CONFIG";
import Link from "next/link";
import {
  FaCode,
  FaCodeBranch,
  FaEnvelope,
  FaExclamationTriangle,
  FaFileAlt,
  FaGlobe,
  FaRProject,
  FaTimes,
} from "react-icons/fa";

type FooterProps = {
  className?: string;
};

const FooterLinkItemContents = ({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) => {
  return (
    <>
      <span className="icon-footer flex items-center justify-center">
        {icon}
      </span>
      {text}
    </>
  );
};

const FooterHrefLinkItem = ({
  icon,
  href,
  text,
}: {
  icon: React.ReactNode;
  text: string;
  href: string;
}) => {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 flex items-center"
    >
      <FooterLinkItemContents icon={icon} text={text} />
    </Link>
  );
};

const FooterButtonLinkItem = ({
  icon,
  text,
  onClick,
}: {
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      type="button"
      className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 flex items-center"
    >
      <FooterLinkItemContents icon={icon} text={text} />
    </button>
  );
};

const Footer = ({ className = "" }: FooterProps) => {
  const [currentYear, setCurrentYear] = useState("2025");
  const [showCitation, setShowCitation] = useState(false);
  const [showCodeLinks, setShowCodeLinks] = useState(false);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear().toString());
  }, []);

  const contactHref = CONFIG.SHOULD_SEND_EMAIL_IN_FOOTER_CONTACT
    ? `mailto:${CONST.CREATOR_EMAIL}`
    : CONST.LINKS.CONTACT_WEBSITE_URL;

  const handleCitationClick = () => {
    setShowCitation(!showCitation);
  };

  const handleCodeClick = () => {
    setShowCodeLinks(!showCodeLinks);
  };

  return (
    <>
      <footer
        className={`bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-6 px-4 sm:px-6 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between transition-colors duration-200 ${className}`}
      >
        {/* Copyright */}
        <div className="text-sm text-center sm:text-left">
          {"© "}
          <InvisibleLink href={CONST.LINKS.INSTITUTION_URL}>
            {CONST.INSTITUTION_NAME}
          </InvisibleLink>{" "}
          {currentYear === "2025" ? "2025" : `2025-${currentYear}`}
          <span className="text-gray-500 dark:text-gray-400 ml-2">
            • Created by{" "}
            <InvisibleLink href={CONST.LINKS.CREATOR_URL}>
              {CONST.CREATOR}
            </InvisibleLink>
          </span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          <FooterButtonLinkItem
            onClick={handleCitationClick}
            icon={<FaFileAlt />}
            text="Cite"
          />
          <FooterHrefLinkItem
            href={CONST.LINKS.APPLICATIONS_URL}
            icon={<FaGlobe />}
            text="Applications"
          />
          <FooterButtonLinkItem
            onClick={handleCodeClick}
            icon={<FaCode />}
            text="Code"
          />

          <FooterHrefLinkItem
            href={contactHref}
            icon={<FaEnvelope />}
            text="Contact"
          />

          <FooterHrefLinkItem
            href={CONST.LINKS.APP_GITHUB.ISSUES}
            icon={<FaExclamationTriangle />}
            text="Report Issues"
          />
        </div>
      </footer>

      {/* Citation Modal */}
      {showCitation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CitationBox
              variant="full"
              onClose={() => setShowCitation(false)}
            />
          </div>
        </div>
      )}

      {showCodeLinks && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCodeLinks(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full shadow-xl border border-gray-200 dark:border-gray-700"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Access the MAIVE package
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  CRAN provides the stable release; GitHub hosts the development
                  version.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCodeLinks(false)}
                aria-label="Close code links"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <FooterHrefLinkItem
                href={CONST.LINKS.MAIVE.CRAN}
                icon={<FaRProject className="text-blue-600" />}
                text="MAIVE CRAN (stable release)"
              />
              <FooterHrefLinkItem
                href={CONST.LINKS.MAIVE.GITHUB}
                icon={<FaCodeBranch className="text-purple-600" />}
                text="MAIVE GitHub (development)"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;
