/** @type {import('next').NextConfig} */
const nextConfig = {
	pageExtensions: ["js", "jsx", "ts", "tsx"],
	// We check both linting and type checking during CI/CD, but we don't need to check them during build.
	eslint: {
		ignoreDuringBuilds: true,
	},
	typescript: {
		ignoreBuildErrors: true,
	},
}

module.exports = nextConfig
