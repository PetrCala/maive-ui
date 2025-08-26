<div align="center">
    <h1>
        <a href="https://spuriousprecision.com">
        MAIVE - Developer's guide
        </a>
    </h1>
</div>

#### Table of Contents

- [Deploying the application](#deploying-the-application)
  - [Initial deploy to cloud](#initial-deploy-to-cloud)
  - [Deploying the app stack](#deploying-the-app-stack)
  - [Getting Service Access Links](#getting-service-access-links)
    - [Quick Access Commands](#quick-access-commands)
    - [Service URLs](#service-urls)
    - [Example Output](#example-output)
    - [Access Your Application](#access-your-application)
  - [Certificate Management](#certificate-management)
    - [Certificate Validation](#certificate-validation)
    - [Using Certificates in Deployment](#using-certificates-in-deployment)
    - [Certificate ARN Format](#certificate-arn-format)
    - [Managing Existing Certificates](#managing-existing-certificates)
    - [Troubleshooting](#troubleshooting)
  - [Destroying the architecture](#destroying-the-architecture)
- [How to run locally](#how-to-run-locally)
  - [Prerequisites](#prerequisites)
  - [Steps](#steps)
  - [Notes](#notes)
  - [🔄 Development \& Releases](#-development--releases)
    - [Quarterly Release Automation](#quarterly-release-automation)
    - [Testing the Release System](#testing-the-release-system)
- [Handling images containers](#handling-images-containers)
  - [Scripts](#scripts)
- [Useful notes](#useful-notes)
  - [Technical choices](#technical-choices)
    - [Front-end](#front-end)
    - [Back end](#back-end)
    - [CI/CD](#cicd)
- [Creating new releases](#creating-new-releases)
  - [Enhanced PR Merging with `mergePR`](#enhanced-pr-merging-with-mergepr)
    - [Basic Usage](#basic-usage)
    - [Advanced Options](#advanced-options)
    - [How It Works](#how-it-works)
    - [Release Workflow Integration](#release-workflow-integration)
    - [Benefits](#benefits)
- [Security](#security)
  - [**Secure Setup**](#secure-setup)
- [Commit message formatting](#commit-message-formatting)
  - [Allowed Types](#allowed-types)
  - [Rules](#rules)
  - [Examples](#examples)
- [Useful resources](#useful-resources)

# Deploying the application

We use AWS to host the application. To host the application, please [create an AWS account](https://aws.amazon.com/) first, install [AWS CLI](https://aws.amazon.com/cli/), and log in to your account in your console.

We also recommend you [create a profile](https://docs.aws.amazon.com/cli/v1/userguide/cli-configure-files.html) for your account.

## Initial deploy to cloud

Before the application stack can be deployed, you must first deploy the infra foundation:

1. Make sure you are logged in to the account you want to deploy the resources for. Confirm this by calling `aws sts get-caller-identity`.
1. Run `npm run cloud:init`. This will deploy the foundation infrastructure such as S3, ECR, VPC, etc.

## Deploying the app stack

The applications are built and deployed automatically upno each pull request to the `release` branch. To release a new (or initial) version of the app, simply open a pull request against the `release` branch and follow the instructions.

## Getting Service Access Links

Once your infrastructure is deployed, you can easily get the URLs to access your services using the built-in commands.

### Quick Access Commands

```bash
# Get all service URLs and status
bun run cloud:status

# Get just the UI frontend URL
bun run cloud:ui-url

# Get just the R backend URL (internal only)
bun run cloud:lambda-url
```

### Service URLs

After running `bun run cloud:status`, you'll see:

- **Frontend (React UI)**: `http://<ui-alb-dns-name>` - Public access
- **Backend (R Plumber)**: `http://<r-alb-dns-name>` - Internal access only
- **Monitoring Dashboard**: CloudWatch dashboard URL

### Example Output

```bash
$ bun run cloud:status
monitoring_dashboard_url = "https://eu-central-1.console.aws.amazon.com/cloudwatch/home?region=eu-central-1#dashboards:name=maive-dashboard"
r_alb_dns_name = "internal-maive-r-alb-9379613.eu-central-1.elb.amazonaws.com"
ui_alb_dns_name = "maive-ui-alb-1455931013.eu-central-1.elb.amazonaws.com"
```

### Access Your Application

1. **Open your browser** and navigate to the UI URL
2. **Use the R backend URL** for internal API calls
3. **Monitor performance** via the CloudWatch dashboard

**Note**: The R backend is internal-only and cannot be accessed directly from the internet. It's designed to be called by the frontend application.

## Certificate Management

SSL certificates are essential for securing your application with HTTPS. This section covers how to request, manage, and deploy certificates for your MAIVE application.

### Certificate Validation

A certificate is created during each deploy. To use a certificate, you must validate it:

1. **DNS Validation** (Recommended):
   - **Find the CNAME records**: After requesting a certificate, AWS will provide CNAME records that need to be added to your domain's DNS
   - **Add CNAME records to your DNS provider**: Go to your domain registrar (e.g., Namecheap, GoDaddy, Route 53) or DNS provider
   - **Wait for validation**: DNS changes can take 5-30 minutes to propagate globally

   **Step-by-step DNS validation:**

   ```bash
   # 1. Get the validation CNAME records
   aws acm describe-certificate \
     --certificate-arn <your-certificate-arn> \
     --region eu-central-1 \
     --query 'Certificate.DomainValidationOptions[0].ResourceRecord'
   ```

   **Example output:**

   ```json
   {
     "Name": "_acme-challenge.spuriousprecision.com",
     "Type": "CNAME",
     "Value": "abc123.aws-acm-validation.com"
   }
   ```

   **Add to your DNS provider:**
   - **Name**: `_acme-challenge.spuriousprecision.com`
   - **Type**: `CNAME`
   - **Value**: `abc123.aws-acm-validation.com`
   - **TTL**: `300` (or default)

   **Where to add:**
   - **Namecheap**: Domain List → Manage → Advanced DNS → Add Record
   - **GoDaddy**: My Domains → DNS → Add Record
   - **Route 53**: Hosted Zones → Your Domain → Create Record
   - **Cloudflare**: DNS → Add Record

   **Verify validation:**

   ```bash
   # Check certificate status
   aws acm list-certificates \
     --region eu-central-1 \
     --query 'CertificateSummaryList[?DomainName==`spuriousprecision.com`].Status'
   ```

2. **Email Validation**:
   - Check the email address associated with your domain
   - Click the validation link in the email

### Using Certificates in Deployment

Once you have a validated certificate:

1. **Copy the certificate ARN** from AWS Console or CLI
2. **Add it to GitHub Secrets**:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Add/update `CERTIFICATE_ARN` with your certificate ARN
3. **Redeploy**: The next deployment will automatically:
   - Create HTTPS listener on port 443
   - Add HTTP redirect listener on port 80
   - Remove HTTP-only forward listener

### Certificate ARN Format

The certificate ARN follows this pattern:

```plain
arn:aws:acm:{region}:{account-id}:certificate/{certificate-id}
```

Example:

```plain
arn:aws:acm:eu-central-1:123456789012:certificate/abcd1234-5678-90ef-ghij-klmnopqrstuv
```

### Managing Existing Certificates

```bash
# List all certificates in your region
aws acm list-certificates --region eu-central-1

# Get certificate details
aws acm describe-certificate --certificate-arn <your-cert-arn> --region eu-central-1

# Check certificate status
aws acm list-certificates --region eu-central-1 --query 'CertificateSummaryList[?Status==`ISSUED`]'
```

### Troubleshooting

**Common Issues:**

1. **Certificate not found**: Ensure you're in the correct AWS region
2. **Validation pending**: Complete DNS or email validation
3. **Certificate expired**: Request a new certificate (ACM auto-renews valid certificates)
4. **Wrong region**: Certificates must be in the same region as your ALB

**Deployment without Certificate:**

If you don't have a certificate yet, your application will deploy with HTTP-only:

- ✅ No duplicate listener errors
- ✅ Simple HTTP setup
- ✅ Easy to add HTTPS later
- ❌ Not secure for production

**Best Practices:**

- Request certificates well before deployment
- Use DNS validation for faster processing
- Keep certificate ARNs in GitHub secrets
- Monitor certificate expiration dates
- Test HTTPS setup in staging first

## Destroying the architecture

To destroy the existing architecture, simply run `npm run cloud:destroy`. This will teardown both application, and infrastructure services.

# How to run locally

## Prerequisites

- Install `node`, `Python`, `R`, `Podman` (or `Docker`),
- [Set up podman](https://podman.io/docs/installation) or [Set up Docker](https://docs.docker.com/engine/install/)
- Install `podman-compose` using `brew install podman-compose`

## Steps

- Initialize the podman using `podman machine start`.
- Run `npm run start:dev`. This will build all necessary images, and start up relevant containers in a development environment. For production environment, execute `npm run start:prod` instead.
- Individual parts of the application can be accessed from your browser or from the terminal under these domains:
  - **React application:** `127.0.0.1:3000`
  - **R:** `127.0.0.1:8787`

## Notes

- You can check that the containers are up and running by calling `podman ps -a` from another terminal instance.
- Upon pressing Ctrl+C in the terminal instance where the `start:dev` command was executed, all of the running containers will be gracefully shut down and deleted.
- Any images built during the process will remain present. You can check the list of these images by running `podman images`. Remove these using `podman rmi [image-name]`, or `podman rmi -a`, which will remove all images.
- You can also access any of the containers by using `localhost` as the host name, such as `localhost:3000` for the React application.

## 🔄 Development & Releases

### Quarterly Release Automation

This project uses automated quarterly releases to ensure consistent and predictable deployment cycles. The system:

- **Automatically creates release PRs** every quarter (Jan 1, Apr 1, Jul 1, Oct 1)
- **Integrates with existing CI/CD pipeline** for seamless deployment
- **Requires manual approval** before merging (maintainer control)
- **Provides comprehensive instructions** for each release

**Learn more**: [Quarterly Release Documentation](docs/QUARTERLY_RELEASES.md)

### Testing the Release System

```bash
# Test quarterly release logic locally
bun run test-quarterly

# Test with specific quarter/year
bun run test-quarterly --quarter Q2 --year 2024

# Test version bumping logic
bun run test-quarterly --test-version
```

# Handling images containers

## Scripts

There are several pre-defined node scripts which should help you work with images and containers. All of these can be executed using `npm run [script-name]`Here is a list of some of them:

- `images:build`: Builds the Docker images only if they don't already exist.
- `images:rebuild`: Forces the rebuild of all Docker images.
- `images:rebuild-<image-tag>`: Force the rebuild of a single Docker image (specified by `<image-tag>`). E.g., `bun run images:rebuild-react` rebuilds the React image.
- `images:rename`: Renames all existing images to match the current project version.
- `start:dev`: Builds any missing images and starts up all containers in a development environment. Upon Ctrl+C, all of the containers will be gracefully shut down and deleted.
- `start:prod`: Very similar to `start:dev`, but builds and starts the containers in a production environment.
- `stop`: Stops and removes all existing containers.

# Useful notes

- Remove empty images

  ```bash
  podman images --format "{{.ID}}: {{.Repository}}:{{.Tag}}" | grep '<none>' | awk -F: '{print $1}' | xargs -I {} podman rmi {}
  ```

- Get logs of a container that is running in a detached mode

  ```bash
  podman logs -f <container-name>
  ```

## Technical choices

### Front-end

- React with Next.js

### Back end

- R API endpoint through [Plumber](https://www.rplumber.io)

### CI/CD

- Containers using Podman (or Docker)

# Creating new releases

All infrastructure is built and deployed to AWS through the `release.yml` workflow.

You can trigger this by opening a PR against the `master` branch and tagging it with the `release` label. Upon successful merge, the `release.yml` workflow will be triggered.

If you want to build a new specific semver verison, pass the relevant label, i.e. `v-build`, `v-patch`, `v-minor`, or `v-major`.

To open the release PR automatically, call `npm run release`, and optionally pass the --semver flag with the desired semver level.

As admin, can also close the PRs automatically using `npm run mergePR`.

## Enhanced PR Merging with `mergePR`

The `mergePR` command has been enhanced to intelligently handle release workflows and provide better visibility into the merging process.

### Basic Usage

```bash
# Merge a specific PR by number
bun run mergePR 123

# Merge the current branch's PR (auto-detected)
bun run mergePR

# Use admin privileges (original behavior)
bun run mergePR:admin
```

### Advanced Options

```bash
# Skip waiting for release workflow completion
bun run mergePR --no-wait-release 123

# Show help
bun run mergePR --help
```

### How It Works

1. **PR Detection**: Automatically detects if you're on a feature branch and finds the associated PR
2. **Smart Merging**: Checks for merge conflicts and requirements before merging
3. **Release Monitoring**: For PRs with the `release` label, automatically monitors the release workflow
4. **Version Tracking**: Waits for version updates to complete before finishing
5. **Workflow Status**: Monitors GitHub Actions workflow status for success/failure

### Release Workflow Integration

When merging a release PR:

- The script waits for the `bumpVersion` job to complete
- Monitors for version changes in `package.json`
- Tracks workflow completion status
- Provides real-time progress updates
- Times out after 5 minutes with helpful error messages

### Benefits

- **Automated**: No need to manually check workflow status
- **Intelligent**: Only waits for release workflows when necessary
- **Robust**: Handles edge cases and provides clear error messages
- **Backward Compatible**: Original `--admin` behavior preserved
- **Future-Proof**: Monitors version updates rather than specific workflow steps

# Security

## **Secure Setup**

- **Cost**: ~$18/month additional  
- **Security**: High (ALB + WAF + Enhanced Security)
- **Architecture**: Internet → ALB → ECS UI → Lambda R Backend
- **Best for**: Production, high security requirements

# Commit message formatting

This project uses conventional commit messages to maintain a clean and consistent git history. All commit messages must follow the conventional commit format:

```bash
<type>: <description>
```

## Allowed Types

The following types are allowed:

- `build`: Changes that affect the build system or external dependencies
- `chore`: Changes to the build process or auxiliary tools
- `ci`: Changes to CI configuration files and scripts
- `docs`: Documentation only changes
- `feat`: A new feature
- `fix`: A bug fix
- `perf`: A code change that improves performance
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `revert`: Reverts a previous commit
- `style`: Changes that do not affect the meaning of the code
- `test`: Adding missing tests or correcting existing tests

## Rules

1. The commit message must start with one of the allowed types followed by a colon and a space
2. The total length of the commit message header (first line) must not exceed 100 characters
3. For breaking changes, include a `BREAKING CHANGE:` footer in the commit message

## Examples

✅ Valid commit messages:

```bash
feat: add support for custom linting rules
fix: resolve authentication token expiration
docs: update API documentation
```

❌ Invalid commit messages:

```bash
added new feature
fixed bug
update docs
```

# Useful resources

- [Retro-board GH repo](https://github.com/antoinejaussoin/retro-board/blob/develop/docker-compose.yml) - For integrating PostgreSQL into the project
