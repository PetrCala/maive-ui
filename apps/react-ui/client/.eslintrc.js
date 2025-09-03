const path = require("path")

const restrictedImportPaths = [
	{
		name: "react",
		importNames: ["CSSProperties"],
		message:
			"Please use 'ViewStyle', 'TextStyle', 'ImageStyle' from 'react-native' instead.",
	},
	{
		name: "@styles/index",
		importNames: ["default", "defaultStyles"],
		message:
			"Do not import styles directly. Please use the `useThemeStyles` hook instead.",
	},
	{
		name: "@styles/utils",
		importNames: ["default", "DefaultStyleUtils"],
		message:
			"Do not import StyleUtils directly. Please use the `useStyleUtils` hook instead.",
	},
	{
		name: "@styles/theme",
		importNames: ["default", "defaultTheme"],

		message:
			"Do not import themes directly. Please use the `useTheme` hook instead.",
	},
	{
		name: "@styles/theme/illustrations",
		message:
			"Do not import theme illustrations directly. Please use the `useThemeIllustrations` hook instead.",
	},
	{
		name: "date-fns/locale",
		message:
			"Do not import 'date-fns/locale' directly. Please use the submodule import instead, like 'date-fns/locale/en-GB'.",
	},
]

const restrictedImportPatterns = [
	{
		group: ["@styles/theme/themes/**"],
		message:
			"Do not import themes directly. Please use the `useTheme` hook instead.",
	},
	{
		group: [
			"@styles/utils/**",
			"!@styles/utils/FontUtils",
			"!@styles/utils/types",
		],
		message:
			"Do not import style util functions directly. Please use the `useStyleUtils` hook instead.",
	},
	{
		group: ["@styles/theme/illustrations/themes/**"],
		message:
			"Do not import theme illustrations directly. Please use the `useThemeIllustrations` hook instead.",
	},
]

module.exports = {
	extends: [
		"next/core-web-vitals",
		"airbnb-typescript",
		"plugin:@typescript-eslint/recommended-type-checked",
		"plugin:@typescript-eslint/stylistic-type-checked",
		"plugin:prettier/recommended",
	],
	plugins: ["@typescript-eslint", "react", "react-hooks"],
	ignorePatterns: ["vite.config.ts", ".eslintrc.js"],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		project: path.resolve(__dirname, "./tsconfig.json"),
	},
	env: {
		jest: true,
	},
	globals: {
		__DEV__: "readonly",
	},
	settings: {
		react: {
			version: "detect",
		},
	},
	rules: {
		// TypeScript specific rules
		"@typescript-eslint/prefer-enum-initializers": "error",
		"@typescript-eslint/no-var-requires": "off",
		"@typescript-eslint/no-non-null-assertion": "error",
		"@typescript-eslint/switch-exhaustiveness-check": "error",
		"@typescript-eslint/no-floating-promises": "off",
		"@typescript-eslint/no-import-type-side-effects": "error",
		"@typescript-eslint/array-type": ["error", { default: "array-simple" }],
		"@typescript-eslint/naming-convention": [
			"error",
			{
				selector: ["variable", "property"],
				// Lower case is enabled because of Firebase naming conventions
				format: ["camelCase", "UPPER_CASE", "PascalCase", "snake_case"],
			},
			{
				selector: "function",
				format: ["camelCase", "PascalCase"],
			},
			{
				selector: ["typeLike", "enumMember"],
				format: ["PascalCase"],
			},
			{
				selector: ["parameter", "method"],
				format: ["camelCase", "PascalCase"],
				leadingUnderscore: "allow",
			},
		],
		"@typescript-eslint/ban-types": [
			"error",
			{
				types: {
					object: "Use 'Record<string, T>' instead.",
				},
				extendDefaults: true,
			},
		],
		"@typescript-eslint/consistent-type-imports": [
			"error",
			{
				prefer: "type-imports",
				fixStyle: "separate-type-imports",
			},
		],
		"@typescript-eslint/consistent-type-exports": [
			"error",
			{
				fixMixedExportsWithInlineTypeSpecifier: false,
			},
		],
		"@typescript-eslint/consistent-type-definitions": ["error", "type"],
		"@typescript-eslint/no-use-before-define": ["error", { functions: false }],

		// ESLint core rules
		"es/no-nullish-coalescing-operators": "off",
		"es/no-optional-chaining": "off",

		// Import specific rules
		"import/extensions": "off",
		"import/no-extraneous-dependencies": "off",

		// React specific rules
		"react/require-default-props": "off",
		"react/prop-types": "off",
		"react/jsx-no-constructed-context-values": "error",

		// Next.js specific rules
		"@next/next/no-html-link-for-pages": "error",

		// Disallow usage of certain functions and imports
		"no-restricted-syntax": [
			"error",
			{
				selector: "TSEnumDeclaration",
				message: "Please don't declare enums, use union types instead.",
			},
		],
		"no-restricted-properties": [
			"error",
			{
				object: "Image",
				property: "getSize",
				message:
					"Usage of Image.getImage is restricted. Please use the `react-native-image-size`.",
			},
		],
		"no-restricted-imports": [
			"error",
			{
				paths: restrictedImportPaths,
				patterns: restrictedImportPatterns,
			},
		],

		curly: "error",
		"prefer-regex-literals": "off",
	},

	overrides: [],
}
