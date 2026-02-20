# Vue JSON Pretty — Comprehensive Guide for Astro / Vue / Vuetify / TypeScript

> A complete reference for integrating [`vue-json-pretty`](https://github.com/leezng/vue-json-pretty) into an Astro project that uses Vue 3, Vuetify, and TypeScript. Includes a real-world example from the `atomic-stream-web` project.

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Project Setup (Astro + Vue + TypeScript)](#project-setup-astro--vue--typescript)
4. [Basic Usage](#basic-usage)
5. [Importing the Component and Styles](#importing-the-component-and-styles)
6. [Full Real-World Example](#full-real-world-example)
7. [Props Reference](#props-reference)
8. [Events Reference](#events-reference)
9. [Slots Reference](#slots-reference)
10. [Common Patterns](#common-patterns)
    - [Dark Theme](#dark-theme)
    - [Collapsing / Expanding with `:deep`](#collapsing--expanding-with-deep)
    - [Conditional Rendering](#conditional-rendering)
    - [Virtual Scrolling for Large Data](#virtual-scrolling-for-large-data)
    - [Editable JSON](#editable-json)
    - [Path Selection](#path-selection)
    - [Custom Node Rendering](#custom-node-rendering)
11. [Styling and CSS Customization](#styling-and-css-customization)
12. [TypeScript Considerations](#typescript-considerations)
13. [Astro-Specific Notes](#astro-specific-notes)
14. [Vuetify Integration Tips](#vuetify-integration-tips)
15. [Troubleshooting](#troubleshooting)

---

## Overview

`vue-json-pretty` is a Vue 3 component that renders JSON data as an interactive, collapsible tree. Key features:

- JSON formatter / viewer with syntax highlighting
- Written in TypeScript with bundled type declarations (`d.ts`)
- Supports collapsing/expanding nodes by depth or bracket click
- Virtual scrolling for large datasets
- Editable mode with `v-model`
- Path selection (single or multiple)
- Light and dark themes
- Custom node rendering via props or slots
- SSR-compatible

---

## Installation

```bash
# npm
npm install vue-json-pretty --save

# yarn
yarn add vue-json-pretty

# pnpm
pnpm add vue-json-pretty
```

The `atomic-stream-web` project uses version `^2.6.0`:

```json
{
  "dependencies": {
    "vue-json-pretty": "^2.6.0"
  }
}
```

> **Vue 2 users:** install `vue-json-pretty@v1-latest` instead. This guide covers Vue 3 only.

---

## Project Setup (Astro + Vue + TypeScript)

### Prerequisites

An Astro project with the Vue integration and TypeScript enabled. Here is the relevant configuration from the `atomic-stream-web` project:

#### `astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

export default defineConfig({
  integrations: [
    vue({
      appEntrypoint: '/src/vue-setup.ts',
      jsx: true,
    }),
  ],
  vite: {
    resolve: {
      dedupe: ['vue'],
    },
  },
});
```

> **Note:** `vue-json-pretty` does **not** need to be added to `vite.ssr.noExternal`. It works out of the box with Astro's SSR handling.

#### `tsconfig.json`

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "types": ["astro/client", "@astrojs/vue/client"]
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

No special TypeScript configuration is needed for `vue-json-pretty` — it ships its own type declarations.

---

## Basic Usage

The minimal setup requires two things: importing the component and importing its CSS.

```vue
<script setup lang="ts">
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';

const data = { key: 'value', nested: { count: 42, items: [1, 2, 3] } };
</script>

<template>
  <vue-json-pretty :data="data" />
</template>
```

---

## Importing the Component and Styles

### Component Import

```ts
import VueJsonPretty from 'vue-json-pretty';
```

This is a local import — the component is **not** registered globally. Use it directly in any `<script setup>` SFC or register it in the `components` option.

### CSS Import

```ts
import 'vue-json-pretty/lib/styles.css';
```

**This is required.** Without it, the JSON tree will render without any styling. Import it in the same component that uses `vue-json-pretty`, or import it once globally in your app entry point (e.g., `vue-setup.ts`).

#### Global CSS Import (optional alternative)

If you use `vue-json-pretty` in many components, you can import the CSS once in your Vue setup file:

```ts
// src/vue-setup.ts
import type { App } from 'vue';
import 'vue-json-pretty/lib/styles.css';

export default (app: App) => {
  // other setup...
};
```

---

## Full Real-World Example

From `atomic-stream-web/src/components/stream-studio/StreamStudioOutput.vue` — a component that displays payment data, schema responses, and an event log as JSON trees in a tabbed Vuetify card:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
import type { PaymentRequired } from '@x402/core/types';

type StreamStudioOutputTab = 'payment' | 'schema' | 'events';

const props = defineProps<{
  paymentRequired: PaymentRequired | null;
  schemaResponse: unknown | null;
  eventLog: unknown[];
  lastEventAt: string | null;
  activeTab: StreamStudioOutputTab;
  freezeStream: boolean;
  expandEvents: boolean;
  maxEvents: number;
}>();

const emit = defineEmits<{
  (event: 'update:activeTab', value: StreamStudioOutputTab): void;
  (event: 'update:freezeStream', value: boolean): void;
  (event: 'update:expandEvents', value: boolean): void;
  (event: 'update:maxEvents', value: number): void;
  (event: 'clear'): void;
}>();

const expandEvents = computed({
  get: () => props.expandEvents,
  set: (value: boolean) => emit('update:expandEvents', value),
});

// Dynamic depth: collapsed (1 level) or fully expanded (99 levels)
const eventDepth = computed(() => (expandEvents.value ? 99 : 1));
</script>

<template>
  <v-card variant="outlined" class="pa-4">
    <v-tabs v-model="activeTab" density="comfortable" class="mt-3">
      <v-tab value="payment">Payment Required</v-tab>
      <v-tab value="schema">Schema Response</v-tab>
      <v-tab value="events">Events</v-tab>
    </v-tabs>

    <v-divider class="my-3" />

    <v-window v-model="activeTab">
      <!-- Simple usage: just :data and theme -->
      <v-window-item value="payment">
        <div class="json-container">
          <div v-if="paymentRequired">
            <vue-json-pretty :data="paymentRequired" theme="dark" />
          </div>
          <div v-else class="text-body-2 text-medium-emphasis">
            No payment required payload yet.
          </div>
        </div>
      </v-window-item>

      <!-- Same simple pattern for schema data -->
      <v-window-item value="schema">
        <div class="json-container">
          <div v-if="schemaResponse">
            <vue-json-pretty :data="schemaResponse" theme="dark" />
          </div>
          <div v-else class="text-body-2 text-medium-emphasis">
            No schema loaded yet.
          </div>
        </div>
      </v-window-item>

      <!-- Advanced: dynamic :deep prop for expand/collapse control -->
      <v-window-item value="events">
        <div class="json-container">
          <div v-if="eventLog.length > 0">
            <vue-json-pretty
              :data="eventLog"
              :deep="eventDepth"
              theme="dark"
            />
          </div>
          <div v-else class="text-body-2 text-medium-emphasis">
            Event log is empty.
          </div>
        </div>
      </v-window-item>
    </v-window>
  </v-card>
</template>

<style scoped>
.json-container {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  max-height: 520px;
  overflow: auto;
}

/* Customize vue-json-pretty internals using :deep() */
:deep(.vjs-tree) {
  line-height: 1.5;
}
</style>
```

### Key Takeaways from this Example

| Pattern | How It's Used |
|---|---|
| **Dark theme** | `theme="dark"` on all instances |
| **Conditional rendering** | `v-if` guard prevents rendering when data is `null` or empty |
| **Dynamic depth** | `:deep="eventDepth"` bound to a computed that toggles between `1` (collapsed) and `99` (expanded) |
| **Scoped CSS override** | `:deep(.vjs-tree)` to customize internal component styles |
| **Scrollable container** | Wrapping div with `max-height` and `overflow: auto` |

---

## Props Reference

### Data & Display

| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `JSON object` | — | **Required.** The JSON data to display. Supports `v-model` when `editable` is `true`. |
| `indent` | `number` | `2` | Number of spaces for each indent level. |
| `showLine` | `boolean` | `true` | Show guide lines connecting tree levels. |
| `showLineNumber` | `boolean` | `false` | Show line numbers on the left. |
| `showDoubleQuotes` | `boolean` | `true` | Show double quotes around object keys. |
| `showIcon` | `boolean` | `false` | Show expand/collapse icons next to nodes. |
| `showLength` | `boolean` | `false` | Show array/object length when a node is collapsed. |
| `theme` | `'light' \| 'dark'` | `'light'` | Color theme. Use `'dark'` for dark backgrounds. |

### Collapsing & Depth

| Prop | Type | Default | Description |
|---|---|---|---|
| `deep` | `number` | — | Paths deeper than this value are collapsed. Not set = all expanded. |
| `collapsedNodeLength` | `number` | — | Collapse arrays/objects with length greater than this threshold. |
| `collapsedOnClickBrackets` | `boolean` | `true` | Allow click on brackets `{}` / `[]` to toggle collapse. |

### Virtual Scrolling

| Prop | Type | Default | Description |
|---|---|---|---|
| `virtual` | `boolean` | `false` | Enable virtual scrolling for large datasets. |
| `height` | `number` | `400` | Height (px) of the virtual scroll container. |
| `itemHeight` | `number` | `20` | Estimated row height in pixels. Used before measurement when `dynamicHeight` is `true`. |
| `dynamicHeight` | `boolean` | `true` | Measure actual row heights dynamically (more accurate but slightly slower). |

### Selection

| Prop | Type | Default | Description |
|---|---|---|---|
| `selectableType` | `'multiple' \| 'single'` | — | Enable path selection mode. Not set = no selection. |
| `selectedValue` | `string \| string[]` | — | The selected path(s). Supports `v-model:selectedValue`. |
| `rootPath` | `string` | `'root'` | The root path prefix shown in selections. |
| `nodeSelectable` | `(node) => boolean` | — | Function to control which nodes can be selected. |
| `showSelectController` | `boolean` | `false` | Show checkbox/radio selection controls. |
| `selectOnClickNode` | `boolean` | `true` | Trigger selection when clicking anywhere on a node (not just the controller). |
| `highlightSelectedNode` | `boolean` | `true` | Highlight selected nodes with a background color. |

### Editing

| Prop | Type | Default | Description |
|---|---|---|---|
| `editable` | `boolean` | `false` | Enable inline editing. Use `v-model:data` to get changes. |
| `editableTrigger` | `'click' \| 'dblclick'` | `'click'` | Mouse action to enter edit mode. |

### Custom Rendering

| Prop | Type | Default | Description |
|---|---|---|---|
| `renderNodeKey` | `({ node, defaultKey }) => vNode` | — | Custom render function for node keys. Alternatively use the `#renderNodeKey` slot. |
| `renderNodeValue` | `({ node, defaultValue }) => vNode` | — | Custom render function for node values. Alternatively use the `#renderNodeValue` slot. |
| `renderNodeActions` | `boolean \| ({ node, defaultActions }) => vNode` | `false` | Render action buttons on nodes. Set to `true` for default edit/delete actions, or provide a custom function. |

---

## Events Reference

| Event | Parameters | Description |
|---|---|---|
| `nodeClick` | `(node: NodeData)` | Fired when a node is clicked. |
| `nodeMouseover` | `(node: NodeData)` | Fired when the mouse hovers over a node. |
| `bracketsClick` | `(collapsed: boolean, node: NodeData)` | Fired when brackets `{}` / `[]` are clicked. |
| `iconClick` | `(collapsed: boolean, node: NodeData)` | Fired when the expand/collapse icon is clicked. |
| `selectedChange` | `(newVal, oldVal)` | Fired when the selected path(s) change. |

### Example: Listening to Events

```vue
<script setup lang="ts">
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';

const data = { users: [{ name: 'Alice' }, { name: 'Bob' }] };

const handleNodeClick = (node: any) => {
  console.log('Clicked node:', node.path, node.content);
};

const handleBracketsClick = (collapsed: boolean, node: any) => {
  console.log(collapsed ? 'Collapsed' : 'Expanded', node.path);
};
</script>

<template>
  <vue-json-pretty
    :data="data"
    @node-click="handleNodeClick"
    @brackets-click="handleBracketsClick"
  />
</template>
```

---

## Slots Reference

| Slot Name | Scoped Props | Description |
|---|---|---|
| `renderNodeKey` | `{ node, defaultKey }` | Replace the default node key rendering. |
| `renderNodeValue` | `{ node, defaultValue }` | Replace the default node value rendering. |
| `renderNodeActions` | `{ node, defaultActions }` | Add custom action buttons to nodes. |

### Example: Custom Node Value Rendering

```vue
<template>
  <vue-json-pretty :data="data" theme="dark">
    <template #renderNodeValue="{ node, defaultValue }">
      <!-- Highlight URLs in blue -->
      <a
        v-if="typeof node.content === 'string' && node.content.startsWith('http')"
        :href="node.content"
        target="_blank"
        style="color: #64b5f6;"
      >
        {{ node.content }}
      </a>
      <component v-else :is="() => defaultValue" />
    </template>
  </vue-json-pretty>
</template>
```

---

## Common Patterns

### Dark Theme

For dark backgrounds (common with Vuetify dark mode):

```vue
<vue-json-pretty :data="data" theme="dark" />
```

### Collapsing / Expanding with `:deep`

Use a reactive `deep` value to let users toggle between collapsed and expanded views:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';

const expanded = ref(false);
const depth = computed(() => (expanded.value ? 99 : 1));
</script>

<template>
  <button @click="expanded = !expanded">
    {{ expanded ? 'Collapse' : 'Expand' }}
  </button>
  <vue-json-pretty :data="data" :deep="depth" theme="dark" />
</template>
```

| `deep` value | Behavior |
|---|---|
| Not set / omitted | Everything expanded |
| `0` | Only the root node visible |
| `1` | Root + first level of children |
| `N` | `N` levels deep |
| `99` | Effectively "expand all" for any realistic data |

### Conditional Rendering

Always guard against `null` / `undefined` / empty data to prevent rendering errors:

```vue
<div v-if="data">
  <vue-json-pretty :data="data" theme="dark" />
</div>
<div v-else>No data available.</div>
```

For arrays:

```vue
<div v-if="items.length > 0">
  <vue-json-pretty :data="items" theme="dark" />
</div>
```

### Virtual Scrolling for Large Data

When displaying very large JSON (thousands of nodes), enable virtual scrolling to avoid UI lag:

```vue
<vue-json-pretty
  :data="hugeData"
  :virtual="true"
  :height="600"
  :item-height="22"
  theme="dark"
/>
```

> **Tip:** Set `dynamicHeight` to `false` and provide an accurate `itemHeight` for best scrolling performance with very large datasets.

### Editable JSON

Allow users to edit JSON values inline:

```vue
<script setup lang="ts">
import { ref } from 'vue';

const jsonData = ref({ name: 'Alice', age: 30, roles: ['admin'] });
</script>

<template>
  <vue-json-pretty
    v-model:data="jsonData"
    :editable="true"
    editable-trigger="dblclick"
    :render-node-actions="true"
    theme="dark"
  />
  <pre>{{ JSON.stringify(jsonData, null, 2) }}</pre>
</template>
```

- `v-model:data` provides two-way binding — edits update `jsonData` reactively.
- `editableTrigger="dblclick"` requires double-click to enter edit mode (prevents accidental edits).
- `:render-node-actions="true"` shows default add/edit/delete action buttons on hover.

### Path Selection

Enable users to select paths within the JSON tree:

```vue
<script setup lang="ts">
import { ref } from 'vue';

const data = { user: { name: 'Alice', address: { city: 'NYC' } } };
const selectedPath = ref<string>('');

const onSelectedChange = (newVal: string, oldVal: string) => {
  console.log('Selected:', newVal);
};
</script>

<template>
  <vue-json-pretty
    :data="data"
    v-model:selected-value="selectedPath"
    selectable-type="single"
    :show-select-controller="true"
    :highlight-selected-node="true"
    theme="dark"
    @selected-change="onSelectedChange"
  />
  <p>Selected path: {{ selectedPath }}</p>
</template>
```

For **multiple** selection:

```vue
<script setup lang="ts">
const selectedPaths = ref<string[]>([]);
</script>

<template>
  <vue-json-pretty
    :data="data"
    v-model:selected-value="selectedPaths"
    selectable-type="multiple"
    :show-select-controller="true"
    theme="dark"
  />
</template>
```

### Custom Node Rendering

Use the `renderNodeKey` or `renderNodeValue` props (or slots) to customize how keys/values appear:

```vue
<script setup lang="ts">
import { h } from 'vue';

// Render function approach: highlight keys containing "id"
const renderKey = ({ node, defaultKey }: any) => {
  if (node.key?.toString().includes('id')) {
    return h('span', { style: 'color: #ff9800; font-weight: bold;' }, node.key);
  }
  return defaultKey;
};
</script>

<template>
  <vue-json-pretty
    :data="data"
    :render-node-key="renderKey"
    theme="dark"
  />
</template>
```

---

## Styling and CSS Customization

### Container Styling

Wrap `vue-json-pretty` in a styled container with scrolling for long content:

```vue
<style scoped>
.json-container {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  max-height: 520px;
  overflow: auto;
}
</style>
```

### Overriding Internal Styles

`vue-json-pretty` uses CSS classes prefixed with `vjs-`. Since it's a child component, use Vue's `:deep()` selector to pierce scoped styles:

```vue
<style scoped>
/* Adjust line height */
:deep(.vjs-tree) {
  line-height: 1.5;
}

/* Customize key color */
:deep(.vjs-key) {
  color: #80cbc4;
}

/* Customize string values */
:deep(.vjs-value-string) {
  color: #ce9178;
}

/* Customize number values */
:deep(.vjs-value-number) {
  color: #b5cea8;
}

/* Customize boolean values */
:deep(.vjs-value-boolean) {
  color: #569cd6;
}

/* Customize null values */
:deep(.vjs-value-null) {
  color: #808080;
}

/* Change font */
:deep(.vjs-tree) {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
}
</style>
```

### Key CSS Classes

| Class | Target |
|---|---|
| `.vjs-tree` | Root tree container |
| `.vjs-tree-node` | Individual tree node row |
| `.vjs-key` | Object key text |
| `.vjs-value` | Any value |
| `.vjs-value-string` | String values |
| `.vjs-value-number` | Number values |
| `.vjs-value-boolean` | Boolean values |
| `.vjs-value-null` | Null values |
| `.vjs-tree__brackets` | Brackets `{}` `[]` |
| `.vjs-tree__content` | Node content area |
| `.vjs-checkbox` | Selection checkboxes (when `showSelectController` is true) |

---

## TypeScript Considerations

### Types Ship with the Package

`vue-json-pretty` is written in TypeScript and ships its own type declarations. No `@types/` package or custom declarations needed.

### Typing the `data` Prop

The `data` prop accepts any valid JSON value. In TypeScript, type your data as a specific interface or use `unknown`:

```ts
import type { PaymentRequired } from '@x402/core/types';

const props = defineProps<{
  paymentRequired: PaymentRequired | null;
  schemaResponse: unknown | null;
  eventLog: unknown[];
}>();
```

### Event Handler Types

Event handler parameters use the library's internal `NodeData` type. In practice, use `any` or create your own interface:

```ts
interface NodeData {
  key: string | number;
  path: string;
  content: unknown;
  type: string;
}

const handleClick = (node: NodeData) => {
  console.log(node.path, node.content);
};
```

---

## Astro-Specific Notes

### Client Directives

Since `vue-json-pretty` is a Vue component, it must run on the client. When using it inside an Astro page via an island, ensure the parent Vue component has a `client:` directive:

```astro
---
// SomePage.astro
import StreamStudioOutput from '../components/stream-studio/StreamStudioOutput.vue';
---

<!-- Must use a client directive for interactive Vue components -->
<StreamStudioOutput client:load />

<!-- Or lazy-load for below-the-fold content -->
<StreamStudioOutput client:visible />
```

### No SSR Configuration Required

Unlike some Vue libraries (e.g., Vuetify, Solana wallet adapters), `vue-json-pretty` does **not** need to be added to `vite.ssr.noExternal`. It works out of the box with Astro's SSR and island architecture.

### No Global Registration Required

Import `vue-json-pretty` directly in the components that use it. There's no need to register it in `vue-setup.ts` or any Astro plugin.

---

## Vuetify Integration Tips

### Dark Theme Consistency

If your Vuetify app uses dark mode, always pass `theme="dark"` to `vue-json-pretty` to match:

```vue
<vue-json-pretty :data="data" theme="dark" />
```

For dynamic theme switching, bind it to Vuetify's theme:

```vue
<script setup lang="ts">
import { useTheme } from 'vuetify';

const theme = useTheme();
const jsonTheme = computed(() => theme.global.current.value.dark ? 'dark' : 'light');
</script>

<template>
  <vue-json-pretty :data="data" :theme="jsonTheme" />
</template>
```

### Inside Vuetify Cards and Tabs

The `atomic-stream-web` example shows `vue-json-pretty` used inside `v-card`, `v-tabs`, and `v-window` components. It integrates seamlessly — just wrap it in a styled container div:

```vue
<v-card variant="outlined" class="pa-4">
  <v-tabs v-model="tab">
    <v-tab value="raw">Raw JSON</v-tab>
    <v-tab value="formatted">Formatted</v-tab>
  </v-tabs>

  <v-window v-model="tab">
    <v-window-item value="raw">
      <pre>{{ JSON.stringify(data, null, 2) }}</pre>
    </v-window-item>
    <v-window-item value="formatted">
      <div class="json-container">
        <vue-json-pretty :data="data" theme="dark" />
      </div>
    </v-window-item>
  </v-window>
</v-card>
```

### Vuetify Controls for JSON Interaction

Pair Vuetify controls with `vue-json-pretty` props for a polished UX:

```vue
<v-switch v-model="expanded" label="Expand All" inset hide-details />
<vue-json-pretty :data="data" :deep="expanded ? 99 : 1" theme="dark" />
```

---

## Troubleshooting

### No Styles / Unstyled Output

**Cause:** Missing CSS import.
**Fix:** Add `import 'vue-json-pretty/lib/styles.css';` in the component or globally.

### Component Not Rendering (Astro)

**Cause:** Missing `client:` directive on the Vue island.
**Fix:** Add `client:load` or `client:visible` to the component in your `.astro` file.

### TypeScript Error: "Cannot find module 'vue-json-pretty'"

**Cause:** Package not installed or TypeScript can't resolve it.
**Fix:**
1. Ensure the package is installed: `npm install vue-json-pretty`
2. Check that `node_modules/vue-json-pretty` exists
3. Restart your TypeScript server / IDE

### Data Not Displaying

**Cause:** Passing `null`, `undefined`, or non-JSON-serializable data.
**Fix:** Guard with `v-if`:

```vue
<vue-json-pretty v-if="data != null" :data="data" />
```

### Performance Issues with Large JSON

**Cause:** Rendering thousands of DOM nodes.
**Fix:** Enable virtual scrolling:

```vue
<vue-json-pretty :data="data" :virtual="true" :height="500" />
```

Or limit initial depth:

```vue
<vue-json-pretty :data="data" :deep="2" />
```

### Styles Conflict with Vuetify

**Cause:** Vuetify's global styles may override `vue-json-pretty` classes.
**Fix:** Use `:deep()` selectors with higher specificity:

```css
:deep(.vjs-tree) {
  font-family: monospace !important;
}
```

### Editable Mode Not Working

**Cause:** Using `:data` instead of `v-model:data`.
**Fix:** Use two-way binding:

```vue
<!-- Wrong -->
<vue-json-pretty :data="myData" :editable="true" />

<!-- Correct -->
<vue-json-pretty v-model:data="myData" :editable="true" />
```
