import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { P5Generator } from './P5Generator';
import { InfographicGenerator } from './InfographicGenerator';
import { P5Data } from '../types';

// --- Types ---
interface ExampleCard {
  title: string;
  category: string;
  description: string;
  image: string;
  tagColor: string;
  colSpan?: string;
  rowSpan?: string;
}

interface EngineOption {
  id: string;
  name: string;
  locked?: boolean;
}

// --- Constants ---
const ENGINE_OPTIONS: EngineOption[] = [
  { id: 'motion-canvas', name: 'Motion Canvas' },
  { id: 'p5js', name: 'p5.js' },
  { id: 'geogebra', name: 'GeoGebra' },
  { id: 'canvas', name: 'Canvas' },
  { id: 'manim', name: 'Manim', locked: true },
];

const EXAMPLES: ExampleCard[] = [
  {
    title: "Vectors & Kinematics",
    category: "Physics",
    description: "Real-time analysis of parabolic trajectories with interactive velocity vectors.",
    image: "/animation-examples/vectors_kinematics.png",
    tagColor: "text-[#3d9bff] border-[#3d9bff]/20 bg-[#3d9bff]/10",
    colSpan: "md:col-span-2",
    rowSpan: "md:row-span-2"
  },
  {
    title: "Fourier Transform",
    category: "Mathematics",
    description: "Decompose complex signals into pure sine waves.",
    image: "/animation-examples/fourier_transform.png",
    tagColor: "text-[#93c5fd] border-[#93c5fd]/20 bg-[#93c5fd]/10",
    colSpan: "md:col-span-1",
    rowSpan: "md:row-span-1"
  },
  {
    title: "Pathfinding Viz",
    category: "Computer Science",
    description: "Interactive Dijkstra's and A* algorithms on weighted graphs.",
    image: "/animation-examples/pathfinding_viz.png",
    tagColor: "text-[#2563eb] border-[#2563eb]/20 bg-[#2563eb]/10",
    colSpan: "md:col-span-1",
    rowSpan: "md:row-span-2"
  },
  {
    title: "Neural Networks",
    category: "AI & ML",
    description: "Visualize backpropagation and activation functions in real-time.",
    image: "/animation-examples/neural_net.png",
    tagColor: "text-[#3d9bff] border-[#3d9bff]/20 bg-[#3d9bff]/10",
    colSpan: "md:col-span-2",
    rowSpan: "md:row-span-1"
  },
  {
    title: "Cellular Automata",
    category: "Simulation",
    description: "Conway's Game of Life with custom rule sets.",
    image: "/animation-examples/cellular.png",
    tagColor: "text-[#bfdbfe] border-[#bfdbfe]/20 bg-[#bfdbfe]/10",
    colSpan: "md:col-span-1",
    rowSpan: "md:row-span-1"
  },
  {
    title: "Fluid Dynamics",
    category: "Physics",
    description: "Interactive fluid simulation with Navier-Stokes equations.",
    image: "/animation-examples/fluid.png",
    tagColor: "text-[#93c5fd] border-[#93c5fd]/20 bg-[#93c5fd]/10",
    colSpan: "md:col-span-2",
    rowSpan: "md:row-span-1"
  }
];

// --- Theme Color Palette ---
const THEME = {
  text: '#e6f0fc',
  background: '#02040a',
  primary: '#3d9bff',
  secondary: '#1a4a7a',
  accent: '#7ec8ff',
};

// --- Helper: Convert hex to rgba ---
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// --- Orbital Physics Background Simulation ---
const BackgroundSimulation: React.FC<{ isProcessing: boolean }> = React.memo(({ isProcessing }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });
  const rafId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let particles: Particle[] = [];
    const particleCount = window.innerWidth < 768 ? 20 : 35;
    const connectionDistance = isProcessing ? 280 : 220;

    // Orbital centers for gravitational pull
    const orbitalCenters = [
      { x: 0.25, y: 0.3, mass: 1.5 },
      { x: 0.75, y: 0.6, mass: 1.2 },
      { x: 0.5, y: 0.8, mass: 1.0 },
    ];

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseColor: string;
      orbitRadius: number;
      orbitAngle: number;
      orbitSpeed: number;
      centerIndex: number;
      phase: number;

      constructor(width: number, height: number) {
        this.centerIndex = Math.floor(Math.random() * orbitalCenters.length);
        const center = orbitalCenters[this.centerIndex];
        this.orbitRadius = 80 + Math.random() * 200;
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.orbitSpeed = (0.0005 + Math.random() * 0.002) * (Math.random() > 0.5 ? 1 : -1);
        this.phase = Math.random() * Math.PI * 2;

        this.x = center.x * width + Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = center.y * height + Math.sin(this.orbitAngle) * this.orbitRadius;
        this.vx = 0;
        this.vy = 0;
        this.radius = Math.random() * 1.5 + 0.5;

        // Theme colors for particles
        const colors = [
          THEME.primary,
          THEME.secondary,
          THEME.accent,
        ];
        this.baseColor = colors[Math.floor(Math.random() * colors.length)];
      }

      update(width: number, height: number, processing: boolean, time: number) {
        const speedMultiplier = processing ? 8 : 1;
        const center = orbitalCenters[this.centerIndex];

        // Orbital motion with organic wobble
        this.orbitAngle += this.orbitSpeed * speedMultiplier;
        const wobble = Math.sin(time * 0.001 + this.phase) * 20;
        const currentRadius = this.orbitRadius + wobble;

        // Target position based on orbit
        const targetX = center.x * width + Math.cos(this.orbitAngle) * currentRadius;
        const targetY = center.y * height + Math.sin(this.orbitAngle) * currentRadius;

        // Smooth interpolation with expo-like easing
        const easing = processing ? 0.08 : 0.015;
        this.x += (targetX - this.x) * easing;
        this.y += (targetY - this.y) * easing;

        // Mouse gravitational attraction during processing
        if (processing) {
          const dx = mouse.current.x - this.x;
          const dy = mouse.current.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 400 && dist > 0) {
            const force = (400 - dist) / 400 * 3;
            this.x += (dx / dist) * force;
            this.y += (dy / dist) * force;
          }
        } else {
          // Gentle mouse repulsion when idle
          const dx = mouse.current.x - this.x;
          const dy = mouse.current.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            const angle = Math.atan2(dy, dx);
            const force = (150 - dist) / 150;
            this.x -= Math.cos(angle) * force * 2;
            this.y -= Math.sin(angle) * force * 2;
          }
        }

        // Soft boundary wrapping
        if (this.x < -50) this.x = width + 50;
        else if (this.x > width + 50) this.x = -50;
        if (this.y < -50) this.y = height + 50;
        else if (this.y > height + 50) this.y = -50;
      }

      draw(context: CanvasRenderingContext2D, processing: boolean) {
        const glow = processing ? 20 : 8;

        // Outer glow
        const gradient = context.createRadialGradient(
          this.x, this.y, 0,
          this.x, this.y, this.radius + glow
        );
        gradient.addColorStop(0, hexToRgba(this.baseColor, processing ? 0.8 : 0.4));
        gradient.addColorStop(0.5, hexToRgba(this.baseColor, 0.2));
        gradient.addColorStop(1, hexToRgba(this.baseColor, 0));

        context.beginPath();
        context.arc(this.x, this.y, this.radius + glow, 0, Math.PI * 2);
        context.fillStyle = gradient;
        context.fill();

        // Core particle
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.baseColor;
        context.globalAlpha = processing ? 0.8 : 0.3;
        context.fill();
        context.globalAlpha = 1;
      }
    }

    const init = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = Array.from({ length: particleCount }, () => new Particle(canvas.width, canvas.height));
    };

    let time = 0;
    const animate = () => {
      if (!canvas || !ctx) return;
      time += 16;

      // Subtle fade trail effect
      ctx.fillStyle = 'rgba(5, 5, 5, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Ambient radial glow around mouse
      if (isProcessing) {
        const gradient = ctx.createRadialGradient(
          mouse.current.x, mouse.current.y, 0,
          mouse.current.x, mouse.current.y, 400
        );
        gradient.addColorStop(0, hexToRgba(THEME.primary, 0.08));
        gradient.addColorStop(0.5, hexToRgba(THEME.secondary, 0.03));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        p1.update(canvas.width, canvas.height, isProcessing, time);
        p1.draw(ctx, isProcessing);

        // Draw connections with theme gradient
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            const opacity = isProcessing ? 0.2 : 0.05;
            const alpha = opacity * (1 - dist / connectionDistance);

            if (alpha > 0.01) {
              const lineGradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
              lineGradient.addColorStop(0, hexToRgba(p1.baseColor, alpha));
              lineGradient.addColorStop(1, hexToRgba(p2.baseColor, alpha));

              ctx.beginPath();
              ctx.strokeStyle = lineGradient;
              ctx.lineWidth = isProcessing ? 1.5 : 0.6;
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }
      }

      rafId.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };

    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(init, 200);
    };

    init();
    animate();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [isProcessing]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none opacity-50 z-0" />;
});

// --- Main Application Component ---
export const AnimationHome: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [prompt, setPrompt] = useState<string>("");
  const [engine, setEngine] = useState<string>("Motion Canvas");
  const [selectedModel, setSelectedModel] = useState<string>("Gemini");
  const [systemPrompt, setSystemPrompt] = useState<string>("You are an expert animator and physics educator. Create a high-quality simulation based on the user's request.");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState<boolean>(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [shimmerPosition, setShimmerPosition] = useState<number>(0);
  const [showP5Generator, setShowP5Generator] = useState<boolean>(false);
  const [showInfographics, setShowInfographics] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const welcomeTextRef = useRef<HTMLHeadingElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Geometric Shapes State ---
  const [showShapes, setShowShapes] = useState(true);
  const shapesContainerRef = useRef<HTMLDivElement>(null);

  // --- Shimmer Track Effect for Input ---
  useEffect(() => {
    if (!isInputFocused || !inputRef.current) return;

    const updateShimmer = (e: MouseEvent) => {
      const rect = inputRef.current?.parentElement?.getBoundingClientRect();
      if (rect) {
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        setShimmerPosition(Math.max(0, Math.min(100, x)));
      }
    };

    window.addEventListener('mousemove', updateShimmer);
    return () => window.removeEventListener('mousemove', updateShimmer);
  }, [isInputFocused]);

  // --- GSAP Setup with Organic Absorption Animation ---
  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    let tl: any = null;

    const loadGSAP = () => {
      return new Promise<void>((resolve) => {
        if ((window as any).gsap) {
          resolve();
          return;
        }
        script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js";
        script.async = true;
        document.head.appendChild(script);
        script.onload = () => resolve();
      });
    };

    const runAnimations = () => {
      const gsap = (window as any).gsap;
      if (!gsap) return;

      // Register custom ease curves
      gsap.registerEase("expo.out", (progress: number) => {
        return progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      });

      gsap.registerEase("power4.out", (progress: number) => {
        return 1 - Math.pow(1 - progress, 4);
      });

      // === ORGANIC ABSORPTION SHAPES TO WORDS ANIMATION ===
      if (shapesContainerRef.current && welcomeTextRef.current) {
        const shapes = shapesContainerRef.current.querySelectorAll('.geo-shape');
        const chars = welcomeTextRef.current.querySelectorAll('.char');
        const containerRect = shapesContainerRef.current.getBoundingClientRect();

        // Map each character's center position
        const charPositions = Array.from(chars).map(char => {
          const rect = char.getBoundingClientRect();
          return {
            x: (rect.left + rect.width / 2) - containerRect.left,
            y: (rect.top + rect.height / 2) - containerRect.top
          };
        });

        tl = gsap.timeline();

        // --- Phase 1: Shapes materialize with soft glow ---
        tl.set(shapes, {
          opacity: 0,
          scale: 0,
          rotation: () => Math.random() * 180 - 90,
          filter: "blur(20px) brightness(2)",
        })
          .set(chars, { opacity: 0, scale: 0.3, filter: "blur(20px)", y: 30 })

          // Shapes appear with their distinct base scales
          .to(shapes, {
            opacity: 0.9,
            scale: (i) => flowerShapes[i].baseScale,
            filter: "blur(0px) brightness(1)",
            duration: 1.5,
            stagger: { amount: 0.8, from: "random" },
            ease: "back.out(1.4)"
          })

          // Shapes float naturally with subtle Brownian-like drift
          .to(shapes, {
            rotation: () => (Math.random() - 0.5) * 360,
            x: () => (Math.random() - 0.5) * 150,
            y: () => (Math.random() - 0.5) * 100,
            duration: 2,
            ease: "power1.inOut",
          }, "-=0.8")

          // --- Phase 2: Shapes converge with organic gravitational pull ---
          .to(shapes, {
            x: (i: number, el: Element) => {
              const target = charPositions[i % charPositions.length];
              const rect = el.getBoundingClientRect();
              return target.x - (parseFloat(getComputedStyle(el).left) + 64);
            },
            y: (i: number, el: Element) => {
              const target = charPositions[i % charPositions.length];
              return target.y - (parseFloat(getComputedStyle(el).top) + 64);
            },
            scale: (i) => flowerShapes[i].baseScale * 0.4, // Keep hierarchy during convergence
            rotation: (i: number) => i % 2 === 0 ? "+=720" : "-=720",
            filter: "blur(4px) brightness(1.8)",
            duration: 2,
            stagger: { amount: 0.6, from: "edges" },
            ease: "power3.inOut"
          })

          // --- Phase 3: Smooth Petal Dissolve - organic bloom into abstraction ---
          .to(shapes, {
            opacity: 0,
            scale: 1.8, // Gentle bloom instead of explosion
            filter: "blur(12px) brightness(1.5)", // Soft dreamy focus
            rotation: "+=45", // Subtle final twist
            duration: 1.5,
            stagger: { amount: 0.8, from: "center" },
            ease: "power2.inOut", // Silky smooth easing
          })

          // Letters emerge absorbing the shape energy
          .to(chars, {
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            y: 0,
            duration: 1.4,
            stagger: { amount: 0.7, from: "center" },
            ease: "expo.out",
            onComplete: () => setShowShapes(false)
          }, "-=0.7")

          // --- Phase 4: Energy shimmer sweep with theme glow ---
          .to(chars, {
            textShadow: `0 0 60px ${THEME.primary}, 0 0 120px ${THEME.secondary}88, 0 0 180px ${THEME.accent}44`,
            duration: 0.5,
            stagger: { amount: 0.6, from: "start" }
          })
          .to(chars, {
            textShadow: `0 0 25px ${THEME.secondary}66`,
            duration: 0.8,
            stagger: { amount: 0.5, from: "start" }
          }, "-=0.3")

          // Hero elements fade in with cinematic timing
          .fromTo(".hero-element",
            { opacity: 0, y: 60, filter: "blur(20px)" },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 1.8,
              stagger: 0.25,
              ease: "expo.out"
            },
            "-=1.2"
          );

        // Continuous organic floating for letters
        gsap.to(chars, {
          y: -10,
          duration: 5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: { amount: 3, from: "edges" },
          delay: 5
        });

        // === Alien AI Morph Sequence ===
        // "SIMULATE" -> U(3), L(4) -> Morph to "A", "I"
        const morphChars = [chars[3], chars[4]];
        const alienTL = gsap.timeline({ delay: 16.8 }); // Start after main intro

        // 1. Spin out to hidden with 3D pop
        alienTL.to(morphChars, {
          rotationX: 90,
          scale: 1.2,
          z: 50,
          duration: 0.6,
          ease: "expo.in",
          stagger: 0.1
        })
          // 2. Swap visual state to "Alien Mode"
          .call(() => {
            if (chars[3]) {
              const el = chars[3] as HTMLElement;
              el.textContent = "A";
              el.style.color = "#4ade80"; // Alien Green
              el.style.fontFamily = "JetBrains Mono";
              el.style.textShadow = "0 0 25px rgba(74, 222, 128, 0.6), 0 0 50px rgba(74, 222, 128, 0.3)";
            }
            if (chars[4]) {
              const el = chars[4] as HTMLElement;
              el.textContent = "I";
              el.style.color = "#4ade80";
              el.style.fontFamily = "JetBrains Mono";
              el.style.textShadow = "0 0 25px rgba(74, 222, 128, 0.6), 0 0 50px rgba(74, 222, 128, 0.3)";
            }
          })
          // 3. Spin in with settle
          .to(morphChars, {
            rotationX: 0,
            scale: 1,
            z: 0,
            duration: 0.8,
            ease: "expo.out",
            stagger: 0.1
          })
          // 4. Ultra-High Speed Multi-Language Scramble (Video Glitch Style)
          .to(morphChars, {
            duration: 1.9,
            onUpdate: function () {
              const alienChars = [
                "∆⟟",     // Delta + Signal spike (logic + intelligence)
                "⟁⧫",     // Neural node + core
                "λΩ",     // Learning + omniscience
                "⟊⟡",     // Emergence + crystal mind
                "⌬⌁",     // Synthetic thought flow
                "Ϟ⟁",     // Energy + structure
                "⋔⟟",     // Binary bridge
                "⧉∆",     // Machine pyramid
                "⊗⟊",     // Cross-network cognition
                "⌶⌬",     // Autonomous core
                "ϟ⧫",     // Electric mind
                "⟁⌁",     // Artificial awareness
                "⟡⟡",     // Self-reflecting intelligence
                "∴∆",     // Logic synthesis
                "⌁Ω",   // Infinite learning
                "⚛", "⌘", "⌥", "⌃", "⌬",
              ];

              // Dynamic Velocity Curve: Slow → Fast → Sudden Slow
              const progress = this.progress(); // 0 to 1
              let updateChance;

              if (progress < 0.15) {
                // Phase 1: Slow Start (brain notices change)
                updateChance = 0.3 + progress * 2; // 30% → 60%
              } else if (progress < 0.75) {
                // Phase 2: Fast Middle (excitement/energy)
                updateChance = 0.95; // Max speed
              } else {
                // Phase 3: Sudden Slow End (satisfaction + clarity)
                const slowdownProgress = (progress - 0.75) / 0.25; // 0 → 1
                updateChance = 0.95 - (slowdownProgress * 0.85); // 95% → 10%
              }

              if (Math.random() < updateChance) {
                const colors = [
                  '#3d9bff', '#4ade80', '#22d3ee', '#f472b6', '#60a5fa', '#f87171', '#c084fc',
                  '#00fff7', '#ff00ff', '#39ff14', '#ff3131', '#0ff0fc', '#7ec8ff',
                  '#3a86ff', '#8338ec', '#2563eb', '#1a4a7a',
                  '#a5b4fc', '#fda4af', '#99f6e4', '#fde68a', '#ddd6fe'
                ];
                // Also scale jitter based on velocity
                const jitterScale = progress < 0.75 ? 1 : (1 - (progress - 0.75) * 3);

                if (chars[3]) {
                  const el = chars[3] as HTMLElement;
                  el.textContent = alienChars[Math.floor(Math.random() * alienChars.length)];
                  const randColor = colors[Math.floor(Math.random() * colors.length)];
                  el.style.color = randColor;
                  el.style.textShadow = `0 0 15px ${randColor}, 0 0 30px ${randColor}88`;
                  el.style.transform = `scale(${0.72 + Math.random() * 0.13 * jitterScale}) rotate(${(Math.random() - 0.5) * 12 * jitterScale}deg)`;
                  el.style.opacity = `${0.7 + Math.random() * 0.3}`;
                }
                if (chars[4]) {
                  const el = chars[4] as HTMLElement;
                  el.textContent = alienChars[Math.floor(Math.random() * alienChars.length)];
                  const randColor = colors[Math.floor(Math.random() * colors.length)];
                  el.style.color = randColor;
                  el.style.textShadow = `0 0 15px ${randColor}, 0 0 30px ${randColor}88`;
                  el.style.transform = `scale(${0.72 + Math.random() * 0.13 * jitterScale}) rotate(${(Math.random() - 0.5) * 12 * jitterScale}deg)`;
                  el.style.opacity = `${0.7 + Math.random() * 0.3}`;
                }
              }
            },
            onComplete: () => {
              // Final lock on target 'A' and 'I'
              if (chars[3]) {
                const el = chars[3] as HTMLElement;
                el.textContent = "A";
                el.style.color = "#4ade80";
                el.style.textShadow = "0 0 25px rgba(74, 222, 128, 0.6), 0 0 50px rgba(74, 222, 128, 0.3)";
                el.style.transform = "scale(1) rotate(0deg)";
                el.style.opacity = "1";
              }
              if (chars[4]) {
                const el = chars[4] as HTMLElement;
                el.textContent = "I";
                el.style.color = "#4ade80";
                el.style.textShadow = "0 0 25px rgba(74, 222, 128, 0.6), 0 0 50px rgba(74, 222, 128, 0.3)";
                el.style.transform = "scale(1) rotate(0deg)";
                el.style.opacity = "1";
              }
            }
          })
          // 5. Spin out again for restore
          .to(morphChars, {
            rotationX: -90,
            scale: 1.2,
            z: 50,
            duration: 0.6,
            ease: "expo.in",
            stagger: 0.1
          })
          // 6. Restore Original State
          .call(() => {
            if (chars[3]) {
              const el = chars[3] as HTMLElement;
              el.textContent = "U";
              el.style.color = "";
              el.style.fontFamily = "";
              el.style.textShadow = "";
            }
            if (chars[4]) {
              const el = chars[4] as HTMLElement;
              el.textContent = "L";
              el.style.color = "";
              el.style.fontFamily = "";
              el.style.textShadow = "";
            }
          })
          // 7. Spin in to restore "SIMULATE"
          .to(morphChars, {
            rotationX: 0,
            scale: 1,
            z: 0,
            duration: 0.8,
            ease: "expo.out",
            stagger: 0.1
          });
      }

      // Card Stagger with cinematic easing
      if (gridRef.current) {
        gsap.fromTo(gridRef.current.children,
          { opacity: 0, y: 120, scale: 0.92 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 1.5,
            stagger: 0.25,
            ease: "expo.out",
            delay: 7
          }
        );
      }

      // Enhanced Magnetic Button Physics
      [sendBtnRef, closeBtnRef].forEach(ref => {
        if (!ref.current) return;
        const btn = ref.current;

        const handleMove = (e: MouseEvent) => {
          const rect = btn.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distX = e.clientX - centerX;
          const distY = e.clientY - centerY;
          const distance = Math.sqrt(distX * distX + distY * distY);
          const maxDist = 100;

          if (distance < maxDist) {
            // Non-linear magnetic pull with refined physics
            const pull = Math.pow(1 - distance / maxDist, 2);
            const x = distX * pull * 0.4;
            const y = distY * pull * 0.4;
            const scale = 1 + pull * 0.08;

            gsap.to(btn, {
              x,
              y,
              scale,
              duration: 0.4,
              ease: "power4.out"
            });
          }
        };

        const handleLeave = () => {
          gsap.to(btn, {
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.6,
            ease: "elastic.out(1, 0.4)"
          });
        };

        btn.addEventListener('mousemove', handleMove);
        btn.addEventListener('mouseleave', handleLeave);
      });
    };

    loadGSAP().then(runAnimations);

    return () => {
      if (tl) tl.kill();
      const gsap = (window as any).gsap;
      if (gsap) gsap.globalTimeline.clear();
    };
  }, []);

  const handleSend = () => {
    if (!prompt || isProcessing) return;

    // Check if p5.js engine is selected - open P5Generator modal
    if (engine === 'p5.js') {
      setShowP5Generator(true);
      return;
    }

    // Check if Canvas engine is selected - open InfographicGenerator modal
    if (engine.toLowerCase() === 'canvas') {
      setShowInfographics(true);
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setPrompt("");
    }, 2500);
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>, card: HTMLDivElement) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleCardMouseLeave = (card: HTMLDivElement) => {
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  };

  const welcomeText = "SIMULATE";

  // Refined Floral Path Data - Normal vs Exotic/Weird
  const flowerPaths = {
    // "Not Weird" - Elegant and Symmetrical
    lotus: "M50 20 C65 20 80 40 80 60 C80 80 50 90 50 90 C50 90 20 80 20 60 C20 40 35 20 50 20",
    daisy: "M50 40 C55 10 65 10 70 35 C95 30 95 40 75 50 C95 65 85 75 65 65 C65 90 55 90 50 65 C45 90 35 90 35 65 C15 75 5 65 25 50 C5 40 5 30 30 35 C35 10 45 10 50 40 Z",
    lily: "M50 10 C65 30 90 40 80 60 C70 80 50 90 50 90 C50 90 30 80 20 60 C10 40 35 30 50 10 Z",

    // "Weird" - Exotic, Asymmetrical, Complex
    orchid: "M50 50 C20 20 5 40 30 60 C10 90 40 100 50 70 C60 100 90 90 70 60 C95 40 80 20 50 50 M50 50 C60 40 70 50 60 60 C50 70 40 60 50 50",
    protea: "M50 5 C60 25 85 15 80 45 C95 55 90 85 70 80 C75 105 50 95 50 95 C50 95 25 105 30 85 C10 85 5 55 20 45 C15 15 40 25 50 5 Z M50 35 C65 35 75 50 50 75 C25 50 35 35 50 35",
    rose: "M50 10 C75 10 95 35 85 60 C75 85 50 95 50 95 C50 95 25 85 15 60 C5 35 25 10 50 10 M50 25 C65 25 75 40 65 55 C55 70 45 70 35 55 C25 40 35 25 50 25 M50 40 C55 40 60 45 58 52 C56 59 44 59 42 52 C40 45 45 40 50 40"
  };

  // Organic Floral Palette - Differentiating by scale
  const flowerShapes = [
    { color: '#FF9B9B', type: 'rose', x: '8%', y: '12%', baseScale: 2.2 },      // Weird (Large)
    { color: '#7EC8FF', type: 'daisy', x: '82%', y: '8%', baseScale: 0.8 },     // Normal (Small)
    { color: '#FFB7B2', type: 'lotus', x: '12%', y: '78%', baseScale: 0.9 },    // Normal (Small)
    { color: '#A0D8EF', type: 'lily', x: '78%', y: '82%', baseScale: 0.8 },     // Normal (Small)
    { color: '#FF99CC', type: 'orchid', x: '52%', y: '62%', baseScale: 2.5 },   // Weird (Large)
    { color: '#DDA0DD', type: 'rose', x: '18%', y: '42%', baseScale: 1.8 },     // Weird (Large)
    { color: '#60A5FA', type: 'daisy', x: '92%', y: '52%', baseScale: 0.7 },    // Normal (Small)
    { color: '#4ADE80', type: 'orchid', x: '35%', y: '15%', baseScale: 2.3 },   // Weird (Large)
    { color: '#D8BFD8', type: 'lily', x: '58%', y: '15%', baseScale: 0.9 },     // Normal (Small)
    { color: '#FF5E5E', type: 'protea', x: '30%', y: '88%', baseScale: 2.4 },   // Weird (Large)
    { color: '#FF69B4', type: 'rose', x: '88%', y: '35%', baseScale: 2.0 },     // Weird (Large)
  ];

  return (
    <div ref={containerRef} className={`bg-[${THEME.background}] text-[${THEME.text}] font-['Inter'] h-[100dvh] flex flex-col relative selection:bg-[${THEME.accent}]/40 ${isProcessing ? 'cursor-wait' : ''} overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth`}>
      <link href="https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Inter:wght@200;300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />

      {/* Fixed Background Layer */}
      <div className="fixed inset-0 z-0">
        <BackgroundSimulation isProcessing={isProcessing} />
        {/* Soft Theme Ambient Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-[10%] left-[20%] w-[70vw] h-[70vw] rounded-full blur-[180px] opacity-[0.05] mix-blend-screen transition-all duration-1000`} style={{ background: THEME.secondary }} />
          <div className={`absolute top-[20%] right-[10%] w-[60vw] h-[60vw] rounded-full blur-[200px] opacity-[0.06] mix-blend-screen transition-all duration-1000`} style={{ background: THEME.primary }} />
          <div className={`absolute -bottom-[10%] left-[30%] w-[60vw] h-[60vw] rounded-full blur-[220px] opacity-[0.05] mix-blend-screen transition-all duration-1000`} style={{ background: THEME.secondary }} />
        </div>
        {/* Glossy Sheen Overlay - Glass Paper Effect */}
        <div className="absolute inset-0 z-0 pointer-events-none mix-blend-soft-light opacity-30"
          style={{
            background: `radial-gradient(circle at 50% 0%, rgba(61, 155, 255, 0.15) 0%, rgba(26, 74, 122, 0.17) 60%, transparent 100%)`
          }}
        />
        {/* Paper Fiber Texture */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.04' numOctaves='5' result='noise' seed='15'/%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='2'%3E%3CfeDistantLight azimuth='45' elevation='60'/%3E%3C/feDiffuseLighting%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paper)'/%3E%3C/svg%3E")`,
          }}
        />

      </div>

      {/* Shapes Layer for Morph Animation */}
      {showShapes && (
        <div ref={shapesContainerRef} className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {/* Realistic Flower Shapes */}
          {flowerShapes.map((shape, i) => (
            <div
              key={i}
              className="geo-shape absolute w-32 h-32 opacity-0"
              style={{ left: shape.x, top: shape.y }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: `drop-shadow(0 0 15px ${shape.color}66)` }}>
                <path
                  d={flowerPaths[shape.type as keyof typeof flowerPaths]}
                  fill={shape.color}
                  fillOpacity="0.85"
                />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* Close Button */}
      {onClose && (
        <button
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Close Animation Home"
          className="fixed top-8 right-8 z-[100] group w-12 h-12 flex items-center justify-center rounded-full glass-panel-deep hover:bg-white/10 transition-all duration-300 shadow-xl"
        >
          <span className="material-symbols-outlined text-slate-400 group-hover:text-white transition-colors">close</span>
        </button>
      )}

      <main className="flex-grow flex flex-col items-center w-full z-10 relative">
        {/* === HERO SECTION === */}
        {/* === HERO SECTION === */}
        <div ref={heroRef} className="w-full min-h-screen flex flex-col items-center justify-center gap-6 sm:gap-8 md:gap-12 pb-20 snap-start shrink-0">

          {/* Header Badge - Industrial Style */}
          <div className={`hero-element flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full glass-panel-soft hover:border-[${THEME.primary}]/30 transition-all cursor-default`}>
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse" style={{ backgroundColor: THEME.primary, boxShadow: `0 0 12px ${THEME.primary}` }} />
            <span className="text-[8px] sm:text-[10px] font-semibold tracking-[0.2em] sm:tracking-[0.25em] uppercase font-['JetBrains_Mono']" style={{ color: THEME.text }}>AI Ready</span>
          </div>

          {/* Main Title */}
          <div className="relative p-2 sm:p-4 perspective-1000 text-center px-4">
            <h1
              ref={welcomeTextRef}
              className="text-[clamp(2rem,10vw,9rem)] font-['Syncopate'] font-bold tracking-[-0.02em] sm:tracking-[-0.03em] leading-[0.95] select-none"
              style={{ textShadow: "0 10px 40px rgba(0,0,0,0.6)" }}
            >
              {welcomeText.split("").map((char, i) => (
                <span
                  key={i}
                  className="char inline-block bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(180deg, ${THEME.text} 0%, ${THEME.primary} 100%)`,
                    transformStyle: 'preserve-3d'
                  }}
                >
                  {char}
                </span>
              ))}
            </h1>
            <div className={`hero-element absolute -inset-20 blur-[100px] -z-10 rounded-full transition-opacity duration-1000 ${isProcessing ? 'opacity-30' : 'opacity-[0.08]'}`} style={{ background: `radial-gradient(circle closest-side, ${THEME.secondary}33 0%, ${THEME.primary}11 50%, transparent 100%)` }} />
          </div>

          {/* Subtitle - Refined Typography */}
          <p className="hero-element text-[clamp(0.875rem,2.5vw,1.25rem)] max-w-2xl text-center font-light leading-relaxed px-3 tracking-wide" style={{ color: `${THEME.text}99` }}>
            Describe a phenomenon. <span className="font-medium" style={{ color: THEME.text }}>Visualize it instantly.</span><br className="hidden sm:block" />
            <span className="opacity-60">From physics engines to mathematical proofs.</span>
          </p>

          {/* Interactive Prompt Bar - Enhanced & Bigger */}
          <div className={`hero-element w-full max-w-[92%] sm:max-w-xl md:max-w-2xl lg:max-w-4xl relative group z-30 transition-all duration-700 ${isInputFocused ? 'scale-[1.01] sm:scale-[1.015]' : ''}`}>
            {/* Multi-layer glow effect */}
            <div className={`absolute -inset-2 rounded-3xl blur-2xl transition-opacity duration-700 ${isInputFocused ? 'opacity-40' : 'opacity-15 group-hover:opacity-25'}`} style={{ background: `linear-gradient(135deg, ${THEME.primary}66, ${THEME.secondary}66, ${THEME.accent}66)` }} />
            <div className={`absolute -inset-0.5 rounded-3xl blur-md transition-opacity duration-500 ${isInputFocused ? 'opacity-30' : 'opacity-0'}`} style={{ background: `linear-gradient(90deg, ${THEME.secondary}44, ${THEME.primary}44)` }} />

            {/* Main prompt container with grain texture */}
            <div className="prompt-bar relative flex flex-col md:flex-row items-center rounded-3xl shadow-2xl">

              {/* Background & Effects Container - Isolated for clipping */}
              <div className={`absolute inset-0 rounded-3xl overflow-hidden border transition-all duration-500 pointer-events-none -z-10 bg-[#000000] ${isInputFocused ? 'border-white/20' : 'border-white/5'}`}>
                {/* Grain texture overlay */}
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />

                {/* Neural scanning line animation */}
                {isInputFocused && (
                  <div className="neural-scan absolute inset-0 overflow-hidden rounded-3xl">
                    <div className="scan-line" />
                  </div>
                )}

                {/* Shimmer track that follows input */}
                {isInputFocused && (
                  <div
                    className="absolute top-0 w-24 h-full opacity-30 blur-xl transition-all duration-100"
                    style={{
                      left: `${shimmerPosition}%`,
                      transform: 'translateX(-50%)',
                      background: `linear-gradient(90deg, transparent, ${THEME.accent}, transparent)`
                    }}
                  />
                )}
              </div>

              {/* Input Area */}
              <div className="flex-grow w-full md:w-auto relative border-b md:border-b-0 md:border-r border-white/5 z-10">
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-500 scale-110`} style={{ color: isInputFocused ? THEME.accent : THEME.text }}>
                  <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  disabled={isProcessing}
                  placeholder="Generate a simulation..."
                  className="w-full bg-transparent border-none outline-none text-base sm:text-lg md:text-xl py-5 sm:py-6 md:py-8 pl-12 sm:pl-14 md:pl-16 pr-12 sm:pr-14 font-medium tracking-wide"
                  style={{ color: THEME.text, caretColor: THEME.accent }}
                  autoComplete="off"
                />

                {/* Customize Button */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
                  <button
                    onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
                    className={`p-2 rounded-lg transition-all duration-300 ${isCustomizeOpen ? 'shadow-lg' : 'hover:bg-white/10'}`}
                    style={{ color: isCustomizeOpen ? '#000' : THEME.text, backgroundColor: isCustomizeOpen ? THEME.primary : undefined }}
                    title="AI Settings"
                  >
                    <span className="material-symbols-outlined text-xl">tune</span>
                  </button>

                  {/* Customize Panel - Frosted Glass */}
                  {isCustomizeOpen && (
                    <div className="absolute top-full right-0 mt-4 w-72 rounded-2xl shadow-2xl p-4 z-[60] animate-in fade-in slide-in-from-top-2 glass-panel-deep">
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] font-['JetBrains_Mono']" style={{ color: `${THEME.text}80` }}>Selected Model</span>
                            <button
                              onClick={() => { setIsEditingPrompt(!isEditingPrompt); if (!isEditingPrompt) setIsInputFocused(false); }}
                              className="p-1 hover:bg-white/5 rounded transition-colors"
                              style={{ color: THEME.primary }}
                              title="Edit System Prompt"
                            >
                              <span className="material-symbols-outlined text-sm">{isEditingPrompt ? 'check' : 'edit'}</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {['Gemini', 'ChatGPT', 'Claude'].map(mod => (
                              <button
                                key={mod}
                                onClick={() => setSelectedModel(mod)}
                                className={`py-2 px-1 rounded-lg text-[9px] font-bold uppercase tracking-tighter transition-all font-['JetBrains_Mono'] ${selectedModel === mod ? 'text-black' : 'bg-white/5 hover:bg-white/10'}`}
                                style={{ color: selectedModel === mod ? '#000' : `${THEME.text}80`, backgroundColor: selectedModel === mod ? THEME.primary : undefined }}
                              >
                                {mod}
                              </button>
                            ))}
                          </div>
                        </div>

                        {isEditingPrompt && (
                          <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] font-['JetBrains_Mono']" style={{ color: `${THEME.text}80` }}>System Instructions</span>
                            <textarea
                              value={systemPrompt}
                              onChange={(e) => setSystemPrompt(e.target.value)}
                              className="w-full h-24 bg-black/50 border border-white/5 rounded-xl p-2 text-xs outline-none focus:border-white/20 resize-none font-['JetBrains_Mono'] transition-colors"
                              style={{ color: THEME.text }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 w-full md:w-auto bg-black/20 rounded-b-3xl md:rounded-r-3xl md:rounded-bl-none z-10">

                {/* Engine Selector */}
                <div className="relative flex-grow md:flex-grow-0">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl hover:bg-white/5 transition-all text-[10px] sm:text-xs font-semibold tracking-[0.1em] sm:tracking-[0.15em] uppercase w-full md:w-[130px] lg:w-[150px] justify-between font-['JetBrains_Mono']"
                    style={{ color: THEME.text }}
                  >
                    <span style={{ color: isDropdownOpen ? THEME.accent : THEME.text }}>{engine}</span>
                    <span className="material-symbols-outlined text-sm">unfold_more</span>
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute top-full mt-2 left-0 md:right-0 md:left-auto w-full md:w-48 rounded-xl shadow-xl overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 z-[60] glass-panel-deep">
                      {ENGINE_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => { if (!opt.locked) { setEngine(opt.name); setIsDropdownOpen(false); } }}
                          disabled={opt.locked}
                          className={`w-full text-left px-3 py-2 text-[10px] font-semibold tracking-[0.15em] uppercase hover:bg-white/5 flex items-center justify-between font-['JetBrains_Mono'] transition-colors ${opt.locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          style={{ color: engine === opt.name ? THEME.accent : THEME.text }}
                        >
                          {opt.name}
                          {opt.locked && <span className="material-symbols-outlined text-[10px]">lock</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Send Button - Refined Magnetic Interactive */}
                <button
                  ref={sendBtnRef}
                  onClick={handleSend}
                  disabled={!prompt && !isProcessing}
                  className={`h-10 sm:h-12 px-4 sm:px-6 md:px-8 rounded-xl font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[10px] sm:text-xs transition-all duration-500 flex items-center justify-center gap-1 sm:gap-2 flex-grow md:flex-grow-0 min-w-[100px] sm:min-w-[140px] font-['JetBrains_Mono'] ${isProcessing
                    ? 'cursor-wait'
                    : prompt
                      ? 'text-black'
                      : 'bg-white/10 cursor-not-allowed'
                    }`}
                  style={{
                    backgroundColor: isProcessing ? hexToRgba(THEME.secondary, 0.3) : (prompt ? THEME.accent : undefined),
                    color: isProcessing ? THEME.text : (prompt ? '#000' : `${THEME.text}50`),
                    boxShadow: prompt ? `0 0 30px ${hexToRgba(THEME.accent, 0.4)}` : undefined
                  }}
                >
                  {isProcessing ? (
                    <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <>
                      Create
                      <span className="material-symbols-outlined text-sm">bolt</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* === EXAMPLES SECTION === */}
        <div className="w-full min-h-screen max-w-7xl px-6 py-24 flex flex-col justify-center snap-start shrink-0">
          <div className="flex items-center gap-4 mb-12 opacity-0 animate-in fade-in slide-in-from-top-2" style={{ animationDelay: '7s' }}>
            <div className="h-px flex-grow bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="text-xs font-semibold tracking-[0.3em] uppercase opacity-50 font-['JetBrains_Mono']" style={{ color: THEME.text }}>Popular Simulations</span>
            <div className="h-px flex-grow bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* Example Cards Grid - Bento Layout */}
          <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[200px] sm:auto-rows-[250px] md:auto-rows-[300px] gap-4 sm:gap-6 perspective-1000">
            {EXAMPLES.map((ex, idx) => (
              <div
                key={idx}
                className={`group relative w-full h-full rounded-2xl sm:rounded-[2rem] bg-[#111111] border border-white/5 overflow-hidden transition-all duration-500 cursor-pointer shadow-xl ${ex.colSpan?.replace('md:', 'lg:') || ''} ${ex.rowSpan?.replace('md:', 'lg:') || ''}`}
                onMouseMove={(e) => handleCardMouseMove(e, e.currentTarget)}
                onMouseLeave={(e) => handleCardMouseLeave(e.currentTarget)}
                style={{ transition: 'transform 2.45s cubic-bezier(0.2, 0, 0.2, 1)' }}
              >
                {/* Background Image with Zoom Effect */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="w-full h-full bg-cover bg-center opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-[1.5s]"
                    style={{
                      backgroundImage: `url(${ex.image})`,
                      transitionTimingFunction: 'cubic-bezier(0.2, 0, 0.2, 1)'
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                </div>

                {/* Content */}
                <div className="absolute bottom-0 left-0 w-full p-8 flex flex-col gap-4 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-700 pointer-events-none" style={{ transitionTimingFunction: 'cubic-bezier(0.2, 0, 0.2, 1)' }}>
                  <div className={`self-start px-3 py-1 rounded-full text-[9px] uppercase font-semibold tracking-[0.2em] backdrop-blur-md border font-['JetBrains_Mono'] ${ex.tagColor}`}>
                    {ex.category}
                  </div>
                  <h3 className="text-xl md:text-2xl font-['Syncopate'] font-bold uppercase group-hover:text-[#3d9bff] transition-colors duration-500" style={{ color: THEME.text }}>
                    {ex.title}
                  </h3>
                  <p className="text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100 font-light tracking-wide leading-relaxed" style={{ color: `${THEME.text}aa` }}>
                    {ex.description}
                  </p>
                </div>

                {/* Hover Glow Overlay */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-overlay pointer-events-none" style={{ background: `linear-gradient(135deg, ${THEME.primary}22, ${THEME.accent}22)` }} />
              </div>
            ))}
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        .perspective-1000 { perspective: 1000px; }
        
        /* Frosted Glass Panels */
        .glass-panel-soft {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        
        .glass-panel-deep {
          background: rgba(10, 10, 10, 0.85);
          backdrop-filter: blur(40px) saturate(150%);
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        /* Neural Scanning Animation */
        .neural-scan .scan-line {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            ${THEME.primary}08 40%,
            ${THEME.primary}15 50%,
            ${THEME.primary}08 60%,
            transparent 100%
          );
          animation: neuralScan 3s ease-in-out infinite;
        }
        
        @keyframes neuralScan {
          0% {
            left: -100%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            left: 100%;
            opacity: 0;
          }
        }
        
        /* Smooth animate-in classes */
        .animate-in {
          animation: animateIn 0.3s cubic-bezier(0.2, 0, 0.2, 1) forwards;
        }
        
        .fade-in {
          opacity: 0;
        }
        
        .slide-in-from-top-2 {
          transform: translateY(-8px);
        }
        
        .slide-in-from-top-1 {
          transform: translateY(-4px);
        }
        
        @keyframes animateIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Custom scrollbar for textareas */
        textarea::-webkit-scrollbar {
          width: 4px;
        }
        
        textarea::-webkit-scrollbar-track {
          background: transparent;
        }
        
        textarea::-webkit-scrollbar-thumb {
          background: rgba(23, 22, 22, 0.1);
          border-radius: 2px;
        }
        
        textarea::-webkit-scrollbar-thumb:hover {
          background: rgba(17, 16, 16, 0.99);
        }
      `}} />

      {/* P5.js Generator Modal */}
      {showP5Generator && (
        <P5Generator
          onClose={() => setShowP5Generator(false)}
          onInsert={(p5Data) => {
            // Create a standalone HTML file with the p5.js code
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${p5Data.topic || 'P5.js Animation'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      overflow: hidden; 
      background: #1a1a1a;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    canvas { display: block; max-width: 100%; max-height: 100%; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
</head>
<body>
  <script>
${p5Data.code}
  </script>
</body>
</html>`;

            // Download as HTML file
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `p5-animation-${Date.now()}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Also copy code to clipboard
            navigator.clipboard.writeText(p5Data.code).then(() => {
              console.log('[AnimationHome] P5.js code copied to clipboard and downloaded!');
            }).catch(err => {
              console.warn('[AnimationHome] Failed to copy to clipboard:', err);
            });

            // Close the generator modal
            setShowP5Generator(false);
          }}
          initialPrompt={prompt}
        />
      )}

      {showInfographics && (
        <InfographicGenerator
          onClose={() => setShowInfographics(false)}
          initialPrompt={prompt}
        />
      )}
    </div>
  );
};

export default AnimationHome;