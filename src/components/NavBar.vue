<script setup lang="ts">
import { ref } from 'vue';

const menuOpen = ref(false);
const items = [
  { title: 'Home', path: '/' },
  { title: 'About', path: '#' },
  { title: 'Pricing', path: '#' },
];
</script>

<template>
  <nav class="d-flex align-center px-6 py-3" style="background: #1e1e1e; border-bottom: 1px solid rgba(255,255,255,0.1); position: sticky; top: 0; z-index: 100;">
    <a href="/" class="text-h6 font-weight-bold text-white text-decoration-none">Astro Vue Template</a>
    
    <v-spacer />
    
    <!-- Desktop -->
    <div class="d-none d-md-flex" style="gap: 16px;">
      <v-btn v-for="item in items" :key="item.title" :href="item.path" variant="text">{{ item.title }}</v-btn>
      <v-btn color="primary" variant="flat" href="#">Get Started</v-btn>
    </div>

    <!-- Mobile -->
    <v-menu v-model="menuOpen">
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" icon="mdi-menu" variant="text" class="d-md-none"></v-btn>
        </template>
        <v-list>
          <v-list-item v-for="item in items" :key="item.title" :href="item.path" :title="item.title"></v-list-item>
        </v-list>
    </v-menu>
  </nav>
</template>
