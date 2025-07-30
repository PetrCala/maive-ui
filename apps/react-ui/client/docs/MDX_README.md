# Markdown Support in React Client

This React client application now supports Markdown content using a custom markdown parser. This allows you to render rich markdown content with custom styling and components.

## Features

- ✅ **Markdown Rendering**: Render markdown content with proper formatting
- ✅ **Custom Styling**: Full control over markdown element styling
- ✅ **Dark Mode Support**: All markdown elements support dark mode
- ✅ **Responsive Design**: Markdown content is fully responsive
- ✅ **TypeScript Support**: Full TypeScript support for type safety
- ✅ **Lightweight**: No heavy dependencies, fast rendering

## Installation

The following packages have been installed for basic markdown support:

```bash
npm install next-mdx-remote --legacy-peer-deps
```

## Configuration

### Next.js Config (`next.config.cjs`)

The Next.js configuration is kept simple:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
	pageExtensions: ["js", "jsx", "ts", "tsx"],
}

module.exports = nextConfig
```

## Usage

### Basic Usage

Import and use the `MDXContent` component:

```tsx
import React from "react"
import MDXContent from "@components/MDXContent"

const MyComponent = () => {
	const markdownContent = `
# Hello World

This is **bold** and *italic* text.

## Features

- List item 1
- List item 2
- List item 3

\`\`\`
console.log("Code block example");
\`\`\`
  `

	return <MDXContent source={markdownContent} />
}
```

### With Custom Styling

Add custom CSS classes:

```tsx
<MDXContent source={markdownContent} className="my-custom-styles" />
```

## Supported Markdown Features

The markdown parser supports the following features:

### Headers

- `# H1 Header`
- `## H2 Header`
- `### H3 Header`

### Text Formatting

- `**bold text**`
- `*italic text*`
- `` `inline code` ``

### Code Blocks

```

```

console.log("Code block");

```

```

### Blockquotes

```
> This is a blockquote
```

### Paragraphs

Regular text with proper spacing and line breaks.

## Styling

All markdown elements are styled with Tailwind CSS classes and support:

- **Light/Dark Mode**: Automatic theme switching
- **Responsive Design**: Mobile-friendly layouts
- **Consistent Typography**: Proper spacing and font sizes
- **Code Highlighting**: Syntax highlighting for code blocks

## Demo Page

Visit `/mdx-demo` to see a live example of the markdown functionality in action.

## Customization

### Adding Custom Styling

You can customize the styling by modifying the CSS classes in the `MDXContent.tsx` component:

```tsx
// Example: Change header styling
if (line.startsWith("# ")) {
	elements.push(
		<h1 key={index} className="text-4xl font-bold mb-6 text-blue-900">
			{line.substring(2)}
		</h1>
	)
	return
}
```

### Custom CSS Classes

Override default styles by passing custom CSS classes:

```tsx
<MDXContent source={content} className="prose prose-lg prose-blue max-w-none" />
```

## Examples

### Documentation Content

```tsx
const documentationContent = `
# API Documentation

## Authentication

To authenticate with the API, include your API key in the request headers:

\`\`\`
curl -H "Authorization: Bearer YOUR_API_KEY" \\
     https://api.example.com/data
\`\`\`

> **Note**: Keep your API key secure and never commit it to version control.

## Endpoints

The API provides the following endpoints for data access and manipulation.
`
```

### Rich Content

```tsx
const richContent = `
# Welcome to Our Platform

This platform provides **powerful tools** for data analysis and visualization.

## Quick Start

1. **Install** the package
2. **Configure** your settings
3. **Deploy** your application

For support, visit our help center.
`
```

## Performance

The custom markdown parser is designed to be lightweight and fast:

- **No heavy dependencies**: Uses only React and basic string parsing
- **Fast rendering**: Minimal processing overhead
- **Memory efficient**: No large parsing libraries
- **Bundle size friendly**: Small footprint

## Troubleshooting

### Common Issues

1. **Styling Issues**: Check that Tailwind CSS is properly configured
2. **TypeScript Errors**: Ensure the component is properly typed
3. **Rendering Issues**: Verify markdown syntax is correct

### Performance Tips

- Use `React.memo` for components that render large markdown content
- Consider lazy loading for very large markdown files
- Keep markdown content reasonably sized for optimal performance

## Migration from MDX

If you were previously using full MDX functionality, this simplified approach provides:

- **Easier setup**: No complex configuration required
- **Better performance**: Lighter weight solution
- **Simpler maintenance**: Less dependencies to manage
- **Same styling**: Maintains the same visual appearance

## Resources

- [Markdown Guide](https://www.markdownguide.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Documentation](https://reactjs.org/docs)
