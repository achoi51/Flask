<script lang="ts">
	import { onMount } from 'svelte';

	import { setupGasScene, FluidRenderer } from '$lib/fluid';
	import type { FlipFluid } from '$lib/fluid';

	let {
		gravity = { x: 0, y: -3.0 },
		resolution = 40,
		fluidColor = { r: 0.09, g: 0.4, b: 1.0 },
		foamColor = { r: 0.75, g: 0.9, b: 1.0 },
		colorDiffusionCoeff = 0.0008,
		foamReturnRate = 0.5,
		onclick
	}: {
		gravity?: { x: number; y: number };
		resolution?: number;
		angle?: number;
		fluidColor?: { r: number; g: number; b: number };
		foamColor?: { r: number; g: number; b: number };
		colorDiffusionCoeff?: number;
		foamReturnRate?: number;
		onclick?: () => void;
	} = $props();

	let canvas: HTMLCanvasElement;
	let fluid: FlipFluid;
	let renderer: FluidRenderer;
	let animationId: number;

	let simHeight = 3.0;
	let simWidth = 4.0;

	//Particle spawning variables
	let isHold = false; // Know if click is held
	let currentTime;
	let lastTime = 0;
	let mouse = $state({ x: 0, y: 0 });
	const yOffset = 0.25;
	const numberOfParticles = 5;
	const seperation = 10; // The range where particles can spawn around the mouse

	const dt = 1.0 / 120.0;
	const flipRatio = 0.95;
	const numPressureIters = 30;
	const numParticleIters = 2;
	const overRelaxation = 1.7;
	const compensateDrift = true;
	const separateParticles = true;
	const showParticles = false; // set true to overlay raw particles on top
	const showFluid = true;      // metaball fluid surface
	const showGrid = false;
	const damping = 0.95;

	// Particle count controls
	const relWaterWidth = 0.4; // Water width as fraction of tank (0.1 to 1.0)
	const relWaterHeight = 0.3; // Water height as fraction of tank (0.1 to 1.0)

	function resizeCanvas() {
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const devicePixelRatio = window.devicePixelRatio || 1;

		canvas.width = rect.width * devicePixelRatio;
		canvas.height = rect.height * devicePixelRatio;

		// Update simulation dimensions to maintain aspect ratio
		const cScale = canvas.height / simHeight;
		simWidth = canvas.width / cScale;

		if (renderer) {
			renderer.resize(canvas.width, canvas.height);
		}
	}

	function simulate() {
		if (!fluid) return;

		fluid.simulate(
			dt,
			gravity.x,
			gravity.y,
			flipRatio,
			numPressureIters,
			numParticleIters,
			overRelaxation,
			compensateDrift,
			separateParticles,
			damping
		);
	}

	function render() {
		if (!fluid || !renderer) return;

		renderer.render(fluid, {
			showParticles,
			showFluid,
			showGrid,
			simWidth,
			simHeight
		});
	}

	function update() {
		simulate();
		render();
		currentTime = performance.now();
		if (isHold && currentTime - lastTime > seperation) {
			spawnParticle();
			lastTime = currentTime;
		}
		animationId = requestAnimationFrame(update);
	}

	onMount(() => {
		resizeCanvas();

		// Initialize gas simulation
		fluid = setupGasScene(
			simWidth,
			simHeight,
			resolution,
			relWaterWidth,
			relWaterHeight,
			fluidColor,
			foamColor,
			colorDiffusionCoeff,
			foamReturnRate
		);
		renderer = new FluidRenderer(canvas);

		// Initial color is already set via constructor, keep setter for consistency
		if (fluid) {
			fluid.setFluidColor(fluidColor);
			fluid.setFoamColor(foamColor);
			fluid.setColorDiffusionCoeff(colorDiffusionCoeff);
			fluid.setFoamReturnRate(foamReturnRate);
		}

		// Handle window resize
		const handleResize = () => {
			resizeCanvas();
		};
		window.addEventListener('resize', handleResize);

		// Start animation loop
		update();

		return () => {
			window.removeEventListener('resize', handleResize);
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		};
	});

	const spawnParticle = () => {
		let x: number;
		let y: number;
		x = (mouse.x / window.innerWidth) * simWidth; //Transforms window position to simulation position
		y = simHeight - ((mouse.y / window.innerHeight) * simHeight) + yOffset;
		fluid.addNewParticles(numberOfParticles, x, y);
	};
	
	function handleMousemove(event: any) {
		mouse.x = event.clientX;
		mouse.y = event.clientY;
  	}

	// Watch for color changes and update fluid (supports live changes later)
	$effect(() => {
		if (fluid) {
			fluid.setFluidColor(fluidColor);
		}
	});

	// Watch for foam color changes
	$effect(() => {
		if (fluid) {
			fluid.setFoamColor(foamColor);
		}
	});

	// Watch for diffusion coefficient changes
	$effect(() => {
		if (fluid) {
			fluid.setColorDiffusionCoeff(colorDiffusionCoeff);
		}
	});

	// Watch for foam return rate changes
	$effect(() => {
		if (fluid) {
			fluid.setFoamReturnRate(foamReturnRate);
		}
	});
</script>

<svelte:window 
  onpointerdown={() => isHold = true} 
  onpointerup={() => isHold = false} 
  onpointermove={handleMousemove}
  on:touchstart={(e) => { e.preventDefault(); isHold = true; mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }}
  on:touchend={() => isHold = false}
  on:touchmove={(e) => { e.preventDefault(); mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }}
/>


<canvas bind:this={canvas} class="absolute inset-0 z-10 h-full w-full touch-none"></canvas>
