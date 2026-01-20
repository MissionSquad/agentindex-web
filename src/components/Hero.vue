<script setup lang="ts">
defineProps<{
  title: string;
  subtitle: string;
}>();
</script>

<template>
  <v-container class="py-16 text-center">
    <v-row justify="center">
      <v-col cols="12" md="8">
        <h1 class="text-h2 text-md-h1 font-weight-bold mb-6">
          {{ title }}
        </h1>
        <p class="text-h5 text-medium-emphasis mb-10">
          {{ subtitle }}
        </p>
        <div class="d-flex justify-center flex-wrap" style="gap: 24px;">
          <v-btn size="x-large" color="primary" href="#">
            Get Started
            <v-icon end icon="mdi-arrow-right"></v-icon>
          </v-btn>
          <v-btn size="x-large" variant="outlined" href="#">
            Learn More
          </v-btn>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>
