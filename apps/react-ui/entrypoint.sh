#!/bin/sh

# Runtime config is served by the /api/runtime-config route (read-only FS safe).
exec bun run start
