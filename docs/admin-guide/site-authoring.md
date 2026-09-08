---
title: "Build and customize this documentation"
description: "Three-part content structure, native Starlight layout, styled diagrams, and the static publishing pipeline."
---

Documentation source lives in `docs/`; the Astro Starlight site, CSS, header, and container live in `site/`. The content loader reads Markdown and MDX directly from the repository-level documentation folder.

## Content structure

```text title="Three folders, three perspectives"
docs/
├── index.md
├── user-guide/
│   ├── index.md
│   └── nextcloud.md
├── infrastructure/
│   ├── index.md
│   ├── platform.md
│   └── nextcloud.md
└── admin-guide/
    ├── index.md
    ├── bootstrap.md
    ├── nextcloud.md
    └── nextcloud-upgrades.md
```

A new deployed service gets the same slug in each folder. Use its overview for purpose, access, user workflows, and official manuals; infrastructure for component paths, state, and failure boundaries; administration for prerequisites, exact manifest inputs, identity/integrations, and recovery.

Keep shared workflows in the administrator section and link to them from app pages. Put complex application-specific procedures, such as Nextcloud upgrades, beside the main app guide in that same section.

## Author a page

Start with block-style frontmatter:

```yaml title="Page metadata"
---
title: Example service · Overview and User Guide
description: What the service does, how to start using it, and where to find its official manual.
---
```

Use task-based headings, concise introductions, and sequential steps with expected outcomes. Keep current versions in the shared variables reference instead of embedding a historical upgrade as a permanent instruction. Discover pod names in examples; never retain a pod name copied from an incident.

Navigation is **explicitly configured** in `site/astro.config.mjs`. Add the three app links under their corresponding section and update the section index tables. Each application page includes a guide-switcher linking to the same slug in all three folders.

## Diagrams that render without a runtime

Architecture diagrams use semantic HTML figures styled by `site/src/styles/antalos.css`. The three columns describe an entry/declaration boundary, a serving/controller boundary, and the dependencies or consumers. They become a vertical flow on small screens and inherit the light/dark theme. The labels remain selectable text and readable without JavaScript.

```html title="Diagram structure"
<figure class="architecture-diagram" aria-label="Example service request path">
  <div class="diagram-heading">Example service · request path</div>
  <ol class="diagram-flow" role="list">
    <li class="diagram-stage">
      <span class="diagram-label">Entry</span>
      <ul><li>HTTPS ingress</li></ul>
    </li>
    <li class="diagram-stage">
      <span class="diagram-label">Application</span>
      <ul><li>Two web replicas</li></ul>
    </li>
    <li class="diagram-stage">
      <span class="diagram-label">Persistence</span>
      <ul><li>Primary / standby database</li></ul>
    </li>
  </ol>
  <figcaption>Requests reach a healthy web replica; writes use the database service.</figcaption>
</figure>
```

In Markdown, leave a blank line before and after the complete HTML block, with no blank lines inside it. Keep topology-specific details in both the diagram and accompanying prose. A third voter must be labeled separately from a data replica.

No Mermaid rendering integration is installed. A `mermaid` fence would display source text, so use the existing diagram pattern or deliberately add a renderer as a separately reviewed site change. See [Starlight’s content-authoring reference](https://starlight.astro.build/guides/authoring-content/) for supported Markdown features.

## Code examples

Use fenced code blocks with the actual language and an informative `title="…"` attribute. Expressive Code, included with Starlight, supplies syntax highlighting and copy controls. Keep commands copyable by omitting shell prompts and placing expected output in a separate block.

Use block-style YAML, quote shell variables, state the working directory, and make placeholders obvious. Never use a code block merely to highlight a hostname or file path when inline code is clearer. Keep credentials out of examples and write private outputs outside Git.

## Layout and theme

Starlight owns the left sidebar, article column, responsive breakpoints, and On this page placement. The custom stylesheet sets color, readable article width, typography, cards, tables, and diagram appearance. It does not pin the TOC to the viewport edge or override its container width.

Adjust supported tokens such as `--sl-content-width` instead of adding competing `.main-pane` or `.right-sidebar` positioning rules. See [Starlight CSS customization](https://starlight.astro.build/guides/css-and-tailwind/). Preserve keyboard focus, reduced-motion support, and light/dark contrast when changing the theme.

`site/src/components/Header.astro` keeps the Antalos logo, search, social link, and theme toggle. Avoid overriding the content layout just to align a header element.

## Develop locally

Use the Node version family and package-manager version declared by the site build inputs. From the repository root:

```bash title="Start the documentation development server"
cd site
pnpm install --frozen-lockfile
pnpm dev
```

The local URL is printed by Astro. The loader watches content from `../docs`. Builds and previews are available when validation is authorized for the task:

```bash title="Build and preview when requested"
cd site
pnpm run build
pnpm preview
```

The build runs `astro check` before `astro build`. Do not commit `node_modules` or `dist`. Follow repository instructions about checks and publication; a documentation edit does not automatically authorize running every command in this guide.

## Publish through the existing pipeline

`.github/workflows/docs-image.yaml` builds the repository-root Docker context using `site/Dockerfile`. GitHub Actions publishes the main-branch image and an immutable commit tag. `apps/docs/` deploys the selected image with NGINX, a Service, ingress, disruption budget, and certificate.

For a manual local container build, supply the actual shared variable values rather than copying an old tag:

```bash title="Build a local documentation image"
DOCS_BUILD_NODE_TAG='REPLACE_WITH_DOCS_NODE_IMAGE_TAG'
DOCS_BUILD_NGINX_TAG='REPLACE_WITH_DOCS_NGINX_IMAGE_TAG'

docker build \
  --build-arg "NODE_IMAGE_TAG=$DOCS_BUILD_NODE_TAG" \
  --build-arg "NGINX_IMAGE_TAG=$DOCS_BUILD_NGINX_TAG" \
  --tag antalos-docs:local \
  --file site/Dockerfile \
  .
```

Deploy a published immutable tag through `DOCS_IMAGE_TAG` for repeatable releases. The checked-in rollout uses one surge pod and zero unavailable replicas, so sufficient eligible placement is required. `/healthz` reports NGINX health; it does not validate page content.

## Preserve old links

When moving a page, update current navigation and internal links, then add its old URL to `redirects` in `site/astro.config.mjs`. Static Astro output provides a redirect page. The matching exact locations in `site/nginx.conf` provide HTTP 301 redirects for the container deployment, including old URLs with and without a trailing slash.

Keep these mappings together when moving a route again. Remove the old source only after its content has a destination, so it does not shadow the redirect with a duplicate page.
