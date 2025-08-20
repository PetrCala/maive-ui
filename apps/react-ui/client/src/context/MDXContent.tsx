import React from "react";

interface MDXContentProps {
  source: string;
  lineMargin?: number;
  className?: string;
}

// Simple markdown parser for basic formatting
const parseMarkdown = (
  text: string,
  lineMargin: number = 0,
  className: string = "",
): React.ReactNode[] => {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  lines.forEach((line, index) => {
    // Handle code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <pre
            key={`code-${index}`}
            className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto mb-2"
          >
            <code className="text-sm font-mono text-gray-800 dark:text-gray-200">
              {codeBlockContent.join("\n")}
            </code>
          </pre>,
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // Handle headers
    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={index}
          className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100"
        >
          {line.substring(2)}
        </h1>,
      );
      return;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={index}
          className="text-2xl font-semibold mb-1 text-gray-900 dark:text-gray-100"
        >
          {line.substring(3)}
        </h2>,
      );
      return;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={index}
          className="text-xl font-semibold mb-1 text-gray-900 dark:text-gray-100"
        >
          {line.substring(4)}
        </h3>,
      );
      return;
    }

    // Handle blockquotes
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={index}
          className="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400 mb-2"
        >
          {line.substring(2)}
        </blockquote>,
      );
      return;
    }

    // Handle empty lines
    if (line.trim() === "") {
      elements.push(<br key={index} />);
      return;
    }

    // Handle regular paragraphs with basic formatting
    const formattedText = line
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(
        /`(.*?)`/g,
        '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200">$1</code>',
      );

    // Check if this is being rendered inside a list item (parent context)
    const isInList =
      className.includes("list-item") || className.includes("inline");

    if (isInList) {
      // For list items, use span instead of p to avoid block-level behavior
      elements.push(
        <span
          key={index}
          className="text-gray-700 dark:text-gray-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formattedText }}
        />,
      );
    } else {
      // For regular content, use p tag
      elements.push(
        <p
          key={index}
          className={`text-gray-700 dark:text-gray-300 leading-relaxed ${lineMargin > 0 ? `mb-${lineMargin}` : ""}`}
          dangerouslySetInnerHTML={{ __html: formattedText }}
        />,
      );
    }
  });

  return elements;
};

const MDXContent: React.FC<MDXContentProps> = ({
  source,
  className = "",
  lineMargin = 0,
}) => {
  const parsedContent = parseMarkdown(source, lineMargin, className);

  return <div className={className}>{parsedContent}</div>;
};

export default MDXContent;
