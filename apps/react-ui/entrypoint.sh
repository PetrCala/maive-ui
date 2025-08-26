#!/bin/sh

# Write the runtime config file with actual environment variables
cat <<EOF > /app/public/runtime-config.js
window.RUNTIME_CONFIG = {
  R_API_URL: "${NEXT_PUBLIC_R_API_URL}"
};
EOF

# Start Next.js
exec bun run start
