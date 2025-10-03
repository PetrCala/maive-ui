# Unstable Release Banner Operations

This document explains how to control the unstable release warning banner for the MAIVE UI from AWS. The banner lets you alert end users when a deployment may contain known issues or is undergoing maintenance.

## Overview

The banner is powered by two AWS Systems Manager (SSM) Parameter Store values that are created during Terraform deploys:

- `/${var.project}/ui/unstable_banner_enabled` – determines whether the banner appears.
- `/${var.project}/ui/unstable_banner_message` – text shown in the banner when it is enabled.

Terraform seeds the parameters with safe defaults:

- `unstable_banner_enabled` defaults to `false` so the banner is hidden after every deployment.
- `unstable_banner_message` contains the standard warning message and ignores subsequent Terraform changes so that manual edits persist.

To surface the banner you must manually set the enabled flag to `true` inside AWS.

## Updating the Banner

You can edit the parameters through the AWS console or via the AWS CLI.

### AWS Console

1. Navigate to **Systems Manager → Parameter Store**.
2. Search for the `/${var.project}/ui/unstable_banner_enabled` parameter.
3. Choose **Edit**, set the value to `true`, and save.
4. (Optional) Edit `/${var.project}/ui/unstable_banner_message` to customize the notice shown to users.
5. Changes take effect the next time users load the landing page; no service restart is required.

To disable the banner, set the enabled parameter back to `false`.

### AWS CLI

```bash
aws ssm put-parameter \
  --name "/${var.project}/ui/unstable_banner_enabled" \
  --type String \
  --value "true" \
  --overwrite

aws ssm put-parameter \
  --name "/${var.project}/ui/unstable_banner_message" \
  --type String \
  --value "The release deployed on $(date +%Y-%m-%d) has known issues. Proceed with caution." \
  --overwrite
```

Replace `${var.project}` with the project prefix for the environment you are targeting (for example, `maive-ui-prod`).

### Local Testing Override

For local development you can bypass AWS by using the following environment variables in `apps/react-ui/client/.env.local`:

- `STATUS_BANNER_FORCE_ENABLED=true`
- `STATUS_BANNER_FORCE_MESSAGE="Custom warning message"`

These overrides let you test the UI without editing Parameter Store.

## Rollback Strategy

If a message needs to be cleared quickly, set the enabled parameter to `false`. Terraform will reapply the default disabled state on the next deployment, so the banner will never turn on accidentally.

