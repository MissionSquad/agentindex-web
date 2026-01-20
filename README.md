# Astro + Vue 3 + Vuetify 3 Template

A production-ready marketing website template using Astro's islands architecture, Vue 3 components, and Vuetify 3 for Material Design styling.

## 🚀 Features

- **Astro 5**: Fast static site generation with selective hydration.
- **Vue 3**: Composition API with `<script setup>` for interactive components.
- **Vuetify 3**: Complete Material Design component library.
- **TypeScript**: Full type safety across Astro and Vue.
- **Islands Architecture**: Zero JavaScript by default, only loaded where needed.
- **SEO Optimized**: Automatic sitemap generation and static HTML rendering.
- **Dark Theme**: Pre-configured dark theme following Material Design principles.

## 🛠️ Stack

- **Framework**: [Astro](https://astro.build/)
- **UI Framework**: [Vue 3](https://vuejs.org/)
- **Component Library**: [Vuetify 3](https://vuetifyjs.com/)
- **Icons**: [Material Design Icons (MDI)](https://pictogrammers.com/library/mdi/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)

## 📁 Project Structure

```text
/
├── src/
│   ├── components/      # Vue components (.vue)
│   ├── layouts/         # Astro layouts (.astro)
│   ├── pages/           # Astro pages (file-based routing)
│   ├── vue-setup.ts     # Vuetify/Vue initialization
│   └── env.d.ts         # TypeScript environment definitions
├── public/              # Static assets (favicons, etc.)
├── astro.config.mjs     # Astro configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

## 🚥 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development

```bash
npm run dev
```

The site will be available at `http://localhost:4321`.

### 3. Build for Production

```bash
npm run build
```

The static output will be in the `dist/` directory.

## 💡 Key Patterns

### Static Components
Use standard Vue components without any client directives in Astro files to render them as pure static HTML.
```astro
<Hero title="Hello" subtitle="World" />
```

### Interactive Components
Add `client:load` to components that require JavaScript interactivity (like menus, forms, or search).
```astro
<NavBar client:load />
```

### Vuetify Integration
Vuetify is initialized in `src/vue-setup.ts`. Most components work out of the box. Avoid `v-app-bar` and `v-navigation-drawer` as they require a single `v-app` wrapper which doesn't align with the islands architecture. Use custom `nav` elements with Vuetify components instead.

## 📄 License

MIT
