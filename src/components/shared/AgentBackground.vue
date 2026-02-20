<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const props = withDefaults(
  defineProps<{
    /** Number of particles rendered on the canvas. */
    particleCount?: number;
    /** Maximum pixel distance between two particles for a connection line to appear. */
    connectionDistance?: number;
    /** Radius (px) within which the mouse cursor attracts particles. */
    mouseRadius?: number;
    /** Strength of mouse attraction (0 = none, higher = stronger pull). */
    attractionStrength?: number;
    /** Velocity friction factor applied each frame (0–1; lower = more drag). */
    friction?: number;
    /** Base initial velocity magnitude for particles. */
    baseVelocity?: number;
    /** Minimum particle radius in px. */
    minSize?: number;
    /** Maximum additional particle radius in px (added to minSize). */
    sizeRange?: number;
    /** Maximum opacity multiplier for connection lines (0–1). */
    lineOpacity?: number;
    /** Particle color palette. */
    colors?: string[];
  }>(),
  {
    particleCount: 80,
    connectionDistance: 140,
    mouseRadius: 250,
    attractionStrength: 0.08,
    friction: 0.98,
    baseVelocity: 0.8,
    minSize: 1.5,
    sizeRange: 2,
    lineOpacity: 0.4,
    colors: () => ["#00f2ff", "#bd00ff", "#ffae00"],
  },
);

const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let particles: Particle[] = [];
let animationFrameId: number | null = null;

const mouse = { x: null as number | null, y: null as number | null };

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;

  constructor() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * props.baseVelocity;
    this.vy = (Math.random() - 0.5) * props.baseVelocity;
    this.size = Math.random() * props.sizeRange + props.minSize;
    this.color = props.colors[Math.floor(Math.random() * props.colors.length)];
  }

  update(): void {
    this.x += this.vx;
    this.y += this.vy;

    if (mouse.x != null && mouse.y != null) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < props.mouseRadius) {
        const forceDirectionX = dx / distance;
        const forceDirectionY = dy / distance;
        const force = (props.mouseRadius - distance) / props.mouseRadius;

        this.vx += forceDirectionX * force * props.attractionStrength;
        this.vy += forceDirectionY * force * props.attractionStrength;
      }
    }

    this.vx *= props.friction;
    this.vy *= props.friction;

    if (this.x < 0 || this.x > width) this.vx *= -1;
    if (this.y < 0 || this.y > height) this.vy *= -1;
  }

  draw(): void {
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

function effectiveParticleCount(): number {
  return width < 768 ? Math.min(props.particleCount, 40) : props.particleCount;
}

function effectiveConnectionDistance(): number {
  return width < 768 ? Math.min(props.connectionDistance, 90) : props.connectionDistance;
}

function initParticles(): void {
  particles = [];
  const count = effectiveParticleCount();
  for (let i = 0; i < count; i++) {
    particles.push(new Particle());
  }
}

function handleResize(): void {
  if (canvasRef.value) {
    width = canvasRef.value.width = window.innerWidth;
    height = canvasRef.value.height = window.innerHeight;
  }
}

function handleMouseMove(e: MouseEvent): void {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
}

function handleMouseLeave(): void {
  mouse.x = null;
  mouse.y = null;
}

function animate(): void {
  if (!ctx || !canvasRef.value) return;

  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < particles.length; i++) {
    particles[i].update();
    particles[i].draw();

    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < effectiveConnectionDistance()) {
        ctx.beginPath();
        const opacity = 1 - distance / props.connectionDistance;
        ctx.strokeStyle = `rgba(100, 116, 139, ${opacity * props.lineOpacity})`;
        ctx.lineWidth = 1;
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  animationFrameId = requestAnimationFrame(animate);
}

onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext("2d");
    handleResize();
    initParticles();
    animate();

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
  }
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseleave", handleMouseLeave);
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
});
</script>

<template>
  <canvas ref="canvasRef" class="agent-canvas"></canvas>
</template>

<style scoped>
.agent-canvas {
  display: block;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
