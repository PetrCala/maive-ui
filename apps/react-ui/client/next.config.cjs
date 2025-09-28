/** @type {import('next').NextConfig} */
const nextConfig = {
	pageExtensions: ["js", "jsx", "ts", "tsx"],
	/**
	 * Ensure exported pages emit directory-style paths (e.g., /demo/index.html)
	 * so static hosts behind ALBs can serve deep links without extra rewrites.
	 */
	trailingSlash: true,
}

module.exports = nextConfig
