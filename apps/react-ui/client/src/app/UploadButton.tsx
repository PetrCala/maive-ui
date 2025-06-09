// UploadButton.tsx
import { useState } from "react"

export default function UploadButton() {
	const [preview, setPreview] = useState([])

	const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		const data = new FormData()
		data.append("file", file)

		const res = await fetch("/api/upload", { method: "POST", body: data })
		const json = await res.json()
		setPreview(json.preview) // first 20 rows ↓
	}

	return (
		<>
			<input type="file" accept=".xlsx,.xls" onChange={handleFile} />
			{/* crude preview; render however you like */}
			<pre>{JSON.stringify(preview, null, 2)}</pre>
		</>
	)
}
