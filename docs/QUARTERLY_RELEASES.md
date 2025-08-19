# 🚀 Quarterly Release Automation

This document describes the automated quarterly release system for the MAIVE UI project. The system automatically creates release pull requests every quarter, allowing for consistent and predictable release cycles while maintaining manual approval control.

## 📋 Overview

The quarterly release automation:

- **Automatically opens PRs** every quarter (Jan 1, Apr 1, Jul 1, Oct 1)
- **Creates dedicated release branches** with proper version bumping
- **Integrates seamlessly** with your existing release pipeline
- **Requires manual approval** before merging (maintainer control)
- **Provides comprehensive instructions** for each release

## 🗓️ Release Schedule

| Quarter | Date | Description |
|---------|------|-------------|
| Q1 | January 1st | First Quarter Release |
| Q2 | April 1st | Second Quarter Release |
| Q3 | July 1st | Third Quarter Release |
| Q4 | October 1st | Fourth Quarter Release |

**Time**: All releases are scheduled for 9:00 AM UTC on the first day of each quarter.

**Note**: The workflow determines which quarter the current month belongs to:

- **Q1**: January, February, March
- **Q2**: April, May, June  
- **Q3**: July, August, September
- **Q4**: October, November, December

## 🔧 How It Works

### 1. Automated Workflow Trigger

- GitHub Actions cron scheduler runs quarterly
- Creates a new release branch from `master`
- Bumps version (build increment)
- Opens a pull request with comprehensive instructions

### 2. Manual Review Process

- You receive notification of the new PR
- Review the automated changes
- Approve and merge when ready
- Existing release pipeline automatically triggers

### 3. Post-Release Tasks

- Automated deployment runs
- You pull latest changes locally
- Verify production deployment

## 📁 Files and Components

### Core Workflow

- **`.github/workflows/quarterly-release.yml`** - Main automation workflow
- **`docs/QUARTERLY_RELEASES.md`** - This documentation

### Integration Points

- **Existing release pipeline** - Automatically triggered on PR merge
- **Version management** - Updates `package.json` files
- **Branch management** - Creates and manages release branches

## 🚀 Setup Instructions

### 1. Enable the Workflow

The workflow is already configured and will run automatically. No additional setup required.

### 2. Configure Notifications (Recommended)

Set up GitHub notifications to be notified when PRs are opened:

1. Go to your GitHub repository
2. Click **Settings** → **Notifications**
3. Configure notification preferences:
   - **Pull requests**: Enable notifications
   - **Issues**: Enable notifications
   - **Actions**: Enable workflow run notifications

### 3. Set Up Email Notifications (Optional)

For critical releases, consider setting up email notifications:

1. In repository settings, go to **Integrations & services**
2. Add email service (e.g., Slack, Microsoft Teams, custom webhook)
3. Configure to trigger on PR creation

## 📝 Release Process

### When a Quarterly PR is Created

1. **Review the PR**:
   - Check the version bump changes
   - Ensure no breaking changes are included
   - Verify the automated changes are appropriate

2. **Approve and Merge**:
   - Add your approval
   - Use "Rebase and merge" strategy
   - The existing release pipeline will automatically trigger

3. **Monitor Deployment**:
   - Watch the GitHub Actions workflow
   - Verify successful deployment
   - Check production environment

4. **Post-Deployment Tasks**:

   ```bash
   # Pull latest changes
   git pull origin master
   
   # Verify version update
   cat package.json | grep version
   
   # Check production deployment
   # (Verify your application is running the new version)
   ```

## 🔍 Workflow Features

### Smart Duplicate Detection

- Prevents creating multiple PRs for the same quarter
- Adds reminder comments to existing PRs
- Creates issues when manual intervention is needed

### Comprehensive PR Instructions

Each PR includes:

- Clear release information
- Step-by-step instructions
- Important notes and warnings
- Technical details
- Support information

### Error Handling

- Graceful handling of existing PRs
- Clear error messages
- Fallback to manual intervention when needed

## 🛠️ Manual Override

### Trigger Workflow Manually

You can manually trigger the quarterly release workflow:

1. Go to **Actions** tab in your repository
2. Select **Quarterly Release Automation**
3. Click **Run workflow**
4. Choose **Run workflow**

### Skip a Quarter

If you need to skip a quarterly release:

1. Close the automated PR without merging
2. Add a comment explaining why it was skipped
3. The workflow will continue normally for the next quarter

## 🔧 Customization

### Modify Release Schedule

To change the quarterly schedule, edit `.github/workflows/quarterly-release.yml`:

```yaml
schedule:
  # Example: Change to monthly releases
  - cron: '0 9 1 * *'  # First day of every month at 9 AM UTC
  
  # Example: Change to specific dates
  - cron: '0 9 15 1,4,7,10 *'  # 15th of each quarter
```

### Change Version Bump Strategy

Currently uses build increments. To change:

1. Modify the `Bump version (build)` step
2. Update the version increment logic
3. Consider using semantic versioning rules

### Add Custom Labels

To add custom labels to quarterly PRs:

1. Edit the `gh pr create` command in the workflow
2. Add `--label "your-custom-label"`
3. Ensure the label exists in your repository

## 📊 Monitoring and Debugging

### Check Workflow Status

1. Go to **Actions** tab
2. Select **Quarterly Release Automation**
3. View recent runs and their status

### Common Issues and Solutions

#### Workflow Fails to Run

- Check GitHub Actions permissions
- Verify cron syntax is valid
- Check for workflow syntax errors

#### PR Creation Fails

- Verify repository permissions
- Check if branch already exists
- Ensure GitHub CLI is working

#### Version Bump Issues

- Verify `package.json` format
- Check for syntax errors in version strings
- Ensure `jq` is available in the runner

### Debug Mode

To debug the workflow:

1. Add `workflow_dispatch` trigger (already included)
2. Manually trigger the workflow
3. Check detailed logs in the Actions tab
4. Use `echo` statements for debugging

## 🔒 Security Considerations

### Permissions

The workflow requires minimal permissions:

- `contents: write` - To create branches and commits
- `pull-requests: write` - To create PRs and comments
- `issues: write` - To create reminder issues

### GitHub CLI Requirements

The workflow uses GitHub CLI (`gh`) for creating PRs, comments, and issues. The workflow automatically:

- Sets the `GH_TOKEN` environment variable using `${{ github.token }}`
- Adds `--repo` flags to all `gh` commands for proper repository context
- Verifies GitHub CLI availability and authentication status

### Token Security

- Uses `GITHUB_TOKEN` (automatically provided)
- No additional secrets required
- Follows GitHub's security best practices

## 📈 Best Practices

### For Maintainers

1. **Review PRs promptly** - Don't let them accumulate
2. **Test deployments** - Verify each release works correctly
3. **Document changes** - Keep release notes updated
4. **Monitor automation** - Check workflow status regularly

### For the Team

1. **Understand the process** - Know how quarterly releases work
2. **Plan around releases** - Schedule major changes appropriately
3. **Test before release** - Ensure changes work in staging
4. **Communicate changes** - Notify stakeholders of releases

## 🆘 Troubleshooting

### Workflow Not Running

```bash
# Check if cron is valid
# Verify GitHub Actions is enabled
# Check repository permissions
```

### PR Creation Issues

```bash
# Verify branch doesn't exist
# Check GitHub CLI installation
# Verify repository access
```

### Version Bump Problems

```bash
# Check package.json syntax
# Verify jq is working
# Check version string format
```

## 📞 Support

### Getting Help

1. **Check workflow logs** - Most issues are visible in the Actions tab
2. **Review this documentation** - Covers common scenarios
3. **Check GitHub status** - Ensure GitHub Actions is operational
4. **Contact maintainer** - For complex issues

### Contributing Improvements

1. **Fork the repository**
2. **Make your changes**
3. **Test thoroughly**
4. **Submit a pull request**

## 🔄 Future Enhancements

### Potential Improvements

- **Slack/Teams integration** - Direct notifications
- **Release notes generation** - Automatic changelog updates
- **Staging deployment** - Pre-production testing
- **Rollback automation** - Quick rollback capabilities
- **Metrics collection** - Release success tracking

### Feedback and Suggestions

We welcome suggestions for improving the quarterly release automation. Please:

1. Create an issue with your idea
2. Tag it with `enhancement`
3. Provide detailed use cases
4. Consider implementation complexity

---

*This documentation is maintained alongside the quarterly release automation system. For questions or issues, please refer to the troubleshooting section or contact the maintainer.*
