# PhysCanvas

Project website for **PhysCanvas: A Vision-Tactile World Model for Robot Policy
Evaluation and Learning**.

Project URL: https://zebinx.github.io/PhysCanvas_HomePage/

## Contents

- Contact-rich robot recordings and the overview video
- Interactive tactile examples and multimodal representations
- Ground-truth and world-model prediction comparisons
- Policy evaluation, learning, and real-world rollouts
- Qualitative baseline comparisons and the paper

The demos are curated qualitative examples, not an unbiased estimate of model
performance. Refer to the paper for evaluation protocols and aggregate results.

## Local Preview

This is a static website with no build step, backend, or API keys. Open
`index.html` directly, or serve this directory with a local static HTTP server.
All media, fonts, and runtime libraries required by the page are bundled.

## GitHub Pages

In this repository's **Settings > Pages**, select **Deploy from a branch**,
then choose **main** and **/ (root)**. The `.nojekyll` file keeps the static
assets intact. Relative resource URLs support the repository's project path.

Only files used by the published page are included. Experiment artifacts,
alternate candidate videos, backups, and machine-specific scripts are excluded.
The published files are kept below 500 MB (decimal), excluding Git history.
The overview video is compressed for delivery; tactile video dimensions and
frame rates are preserved.

## Attribution

The layout is adapted from the [FlexiTac website](https://flexitac.github.io/).
See [THIRD_PARTY.md](THIRD_PARTY.md) for template and dependency attribution.
The template license does not grant rights to the research paper or media.
