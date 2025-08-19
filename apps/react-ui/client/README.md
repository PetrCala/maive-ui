# MAIVE UI

This is a [Next.js](https://nextjs.org/) application for the MAIVE (Meta-Analysis Instrumental Variable Estimation) project, bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Development Setup

### Prerequisites

- Node.js 18+ or Bun
- Access to the R plumber API (either local or remote)

### Quick Start

1. **Install dependencies:**

   ```bash
   bun install
   # or
   npm install
   ```

2. **Set up development environment:**

   ```bash
   # Run the setup script (recommended)
   ./setup-dev.sh
   
   # Or manually create .env.local with:
   NEXT_PUBLIC_DEV_R_API_URL=http://localhost:8787
   ```

3. **Start the development server:**

   ```bash
   bun run dev
   # or
   npm run dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000)** with your browser to see the result.

### Development Configuration

The application uses runtime configuration for the R API URL. In development mode, it will:

1. **First try** to use the runtime config (if available)
2. **Fall back** to `NEXT_PUBLIC_DEV_R_API_URL` from `.env.local`
3. **Default** to `http://localhost:8787` if neither is available

#### Local Development

```bash
# Use local R plumber server
NEXT_PUBLIC_DEV_R_API_URL=http://localhost:8787
```

#### Remote Development Server

```bash
# Use remote development server
NEXT_PUBLIC_DEV_R_API_URL=http://your-dev-server.com
```

### Available Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run lint` - Run ESLint
- `bun run test` - Run tests with Vitest

## Production

In production, the application uses runtime configuration injected by the container entrypoint script. The R API URL is set via environment variables in the ECS task definition.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!
