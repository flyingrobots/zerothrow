# Changesets Guide for ZeroThrow

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and publishing of our packages with independent versioning.

## Quick Start

### Adding a changeset

When you make a change that should be released:

```bash
npm run changeset
```

This will prompt you to:
1. Select which packages have changed
2. Choose the version bump type (major/minor/patch)
3. Write a summary of the changes

### Release Process

1. **During development**: Add changesets as you work
   ```bash
   npm run changeset
   ```

2. **When ready to release**: Merge PRs to main
   - GitHub Actions will automatically create a "Version Packages" PR
   - This PR updates versions and changelogs

3. **To publish**: Merge the "Version Packages" PR
   - GitHub Actions will automatically publish to npm
   - Requires `NPM_TOKEN` secret to be set

## Version Strategy

We use **independent versioning**:
- Each package has its own version number
- Only changed packages get version bumps
- Packages can evolve at their own pace

## Examples

### Adding a changeset for a new feature
```bash
$ npm run changeset
🦋  Which packages would you like to include? @zerothrow/core
🦋  Which packages should have a minor bump? @zerothrow/core
🦋  Please enter a summary: Added tryAsync function for better async handling
```

### Adding a changeset for a bug fix
```bash
$ npm run changeset
🦋  Which packages would you like to include? @zerothrow/jest
🦋  Which packages should have a patch bump? @zerothrow/jest
🦋  Please enter a summary: Fixed TypeScript types for Vitest compatibility
```

### Adding a changeset for breaking changes
```bash
$ npm run changeset
🦋  Which packages would you like to include? @zerothrow/core
🦋  Which packages should have a major bump? @zerothrow/core
🦋  Please enter a summary: BREAKING: Removed deprecated tryR function
```

## Changeset Files

Changesets are stored in `.changeset/*.md` files:
- Don't edit these manually
- Commit them with your PR
- They're automatically deleted after release

## Pre-release Mode

For alpha/beta releases:

```bash
# Enter pre-release mode
npx changeset pre enter alpha

# Make changes and add changesets as normal
npm run changeset

# Exit pre-release mode when ready for stable
npx changeset pre exit
```

## Local Testing

To see what would be published without actually publishing:

```bash
# See version changes
npm run version

# Dry run of publish
npm run release -- --dry-run
```

## Troubleshooting

**Q: I forgot to add a changeset to my PR**
A: Add one in a follow-up PR, or ask a maintainer to add one

**Q: CI is failing on "No changesets found"**
A: Some changes don't need releases (docs, tests). That's OK!

**Q: How do I release all packages together?**
A: Add a changeset that includes all packages

## Best Practices

1. **Write good changeset summaries**: They become your changelog
2. **Be semantic**: Use patch for fixes, minor for features, major for breaking changes
3. **Think about consumers**: Will this change break their code?
4. **One changeset per logical change**: Not per commit or per file

## Required Secrets

For automated publishing, set in GitHub repo settings:
- `NPM_TOKEN`: npm automation token with publish access