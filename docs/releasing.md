# Releasing

1. Update the version in `package.json` and open a pull request.
2. Once it is merged, create a GitHub Release tagged `vX.Y.Z`.
3. `release.yml` checks the tag matches `package.json`, runs the full suite,
   builds, and publishes to npm with provenance.

The tag check exists because a mismatch means the release notes describe
something other than what was published.

## npm setup, once

Publishing needs the `@socialcaredata` scope to exist on npm and this repository
to be allowed to publish to it. Prefer
[trusted publishing](https://docs.npmjs.com/trusted-publishers): configure the
repository and workflow on npmjs.com, and no secret is needed at all.

Otherwise create a granular automation token with publish rights to the scope and
store it as the `NPM_TOKEN` secret in the `npm` environment.

## GitHub Pages, once

Settings → Pages → Source: **GitHub Actions**. `pages.yml` does the rest on every
push to `main` that touches the app, and the site lands at
`https://socialcaredata.github.io/validator/`.

## When a new MAIS release is cut

The ontology repository is tagged with its MAIS version. When that happens:

1. Change `DEFAULT_REF` in `src/catalogue/entries.ts` from `main` to the new tag.
2. `npm run test:conformance` — the examples must still behave.
3. Release a new version of this package.

Until the first tag exists, `DEFAULT_REF` stays on `main` and users who need
reproducibility pin with `--ref`.
