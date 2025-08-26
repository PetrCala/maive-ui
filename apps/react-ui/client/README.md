# MAIVE UI

A modern, responsive web interface for the MAIVE (Meta-Analysis Instrumental Variable Estimator) tool.

## Features

### Core Functionality

- **Data Upload & Validation**: Support for CSV, XLS, and XLSX files
- **MAIVE Analysis**: Run MAIVE models with customizable parameters
- **Results Visualization**: View effect estimates, publication bias tests, and funnel plots
- **Data Export**: Download results with instrumented standard errors

### Citation System

The MAIVE UI includes a comprehensive citation system to ensure proper attribution:

#### A. "How to Cite" Box

- **Landing Page**: Prominent citation box with multiple format options
- **Footer**: Accessible citation modal from anywhere in the app
- **Multiple Formats**: APA, BibTeX, RIS, and plain text citations
- **Copy-to-Clipboard**: One-click copying with visual feedback
- **Paper Link**: Direct link to the Nature Communications paper

#### B. Automatic Citation Footers

- **Data Downloads**: CSV and Excel exports automatically include citation footers
- **Image Downloads**: Funnel plots include embedded citation text
- **Citation Text**: "Citation: Irsova et al., Nature Communications, 2025"

#### C. Citation Reminders

- **Model Page**: Reminder when configuring PET/PEESE/EK parameters
- **Results Page**: Citation reminder below analysis results
- **Validation Page**: Early reminder during data validation
- **Upload Page**: Compact citation box for immediate awareness

#### Citation Information

```
Irsova, Z., Bom, P. R. D., Havranek, T., & Rachinger, H. (2025). 
Spurious Precision in Meta-Analysis of Observational Research. 
Nature Communications, DOI: 10.1038/s41467-025-63261-0.
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd apps/react-ui/client
npm install
```

### Development

```bash
npm run dev
```

### Building

```bash
npm run build
npm start
```

## Architecture

### Components

- **CitationBox**: Main citation component with multiple variants
- **Citation Reminders**: Contextual reminders throughout the app
- **Footer Integration**: Global citation access

### Utilities

- **citationUtils**: Citation text constants and helper functions
- **dataUtils**: Enhanced with automatic citation footer insertion
- **Text Constants**: Centralized citation messages

### Styling

- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode Support**: Consistent theming across all components
- **Accessibility**: Proper contrast and keyboard navigation

## Contributing

When adding new features or modifying existing ones:

1. Follow the established TypeScript patterns
2. Use the centralized text constants for citation messages
3. Ensure citation reminders are appropriately placed
4. Test the citation system across different user workflows

## License

This project is licensed under the same terms as the MAIVE project.
