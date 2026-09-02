/**
 * Next.js configuration.
 *
 * This file used to be next.config.cjs, which Next 14 never loads (it looks
 * for next.config.js and next.config.mjs only), so nothing in it was in
 * effect. The old file also set `trailingSlash: true` for a static export
 * behind an ALB; the app now runs `next start` on Lambda, the option never
 * applied in practice, and turning it on now would redirect every API path
 * to a trailing-slash variant, so it is deliberately left out.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
	pageExtensions: ["js", "jsx", "ts", "tsx"],
	/**
	 * Machine-readable discovery files for AI assistants (#555). They are
	 * rendered by API routes from the app's own constants and citation
	 * registry, but assistants look for them at the site root, so map the
	 * conventional paths onto those routes. /openapi.yaml is a static file
	 * under public/ and needs no rewrite.
	 */
	async rewrites() {
		return [
			{ source: "/llms.txt", destination: "/api/discovery/llms-txt" },
			{ source: "/agent.md", destination: "/api/discovery/agent-md" },
		]
	},
}

module.exports = nextConfig
