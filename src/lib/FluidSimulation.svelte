<script lang="ts">
	import { onMount } from 'svelte';
	import { Element } from '$lib/elements/Element';
	import aluminumImage from '$lib/assets/art/aluminum.png';
	import caesiumImage from '$lib/assets/art/caesium.png';
	import calciumImage from '$lib/assets/art/calcium.png';
	import carbonImage from '$lib/assets/art/carbon.png';
	import chromiumImage from '$lib/assets/art/chromium.png';
	import copperImage from '$lib/assets/art/copper.png';
	import ironImage from '$lib/assets/art/iron.png';
	import lithiumImage from '$lib/assets/art/lithium.png';
	import potassiumImage from '$lib/assets/art/potassium.png';
	import silverImage from '$lib/assets/art/silver.png';
	import silverSulfideImage from '$lib/assets/art/silver_sulfide.png';
	import sulfurImage from '$lib/assets/art/sulfur.png';
	import tinImage from '$lib/assets/art/tin.png';
	import zincImage from '$lib/assets/art/zinc.png';

	import { setupFluidScene, FluidRenderer, FLUID_CELL } from '$lib/fluid';
	import type { FlipFluid } from '$lib/fluid';
	import { setupGasScene, GasRenderer } from '$lib/gas';
	import type { FlipGas } from '$lib/gas';

	let {
		gravity = { x: 0, y: -9.81 },
		resolution = 70,
		fluidColor = { r: 0.09, g: 0.4, b: 1.0 },
		showLiquidParticles = false,
		spawnMaterial = { category: 'liquid', id: 'water' },
		gasColor = { r: 0.7, g: 0.7, b: 0.75, a: 0.22 },
		foamColor = { r: 0.85, g: 0.85, b: 0.9, a: 0.22 },
		colorDiffusionCoeff = 0.001,
		foamReturnRate = 0.6,
		onclick
	}: {
		gravity?: { x: number; y: number };
		resolution?: number;
		angle?: number;
		fluidColor?: { r: number; g: number; b: number };
		showLiquidParticles?: boolean;
		spawnMaterial?: { category: 'solid' | 'liquid' | 'gas'; id: string };
		gasColor?: { r: number; g: number; b: number; a: number };
		foamColor?: { r: number; g: number; b: number; a: number };
		colorDiffusionCoeff?: number;
		foamReturnRate?: number;
		onclick?: () => void;
	} = $props();

	let canvas: HTMLCanvasElement;
	let fluids: FlipFluid[] = [];
	let gases: Array<{ id: string; gas: FlipGas }> = [];
	let renderer: FluidRenderer;
	let gasRenderer: GasRenderer;
	let solidElement: Element;
	let animationId: number;
	let isDragging = false;
	let fluidTouchingElement = false;
	let activeSpawnFluid: FlipFluid | null = null;
	let activeSpawnGasId: string | null = null;
	let maxTotalParticles = 0;

	let simHeight = 3.0;
	let simWidth = 4.0;

	const dt = 1.0 / 120.0;
	const flipRatio = 0.95;
	const numPressureIters = 60;
	const numParticleIters = 3;
	const overRelaxation = 1.7;
	const compensateDrift = true;
	const separateParticles = true;
	const showGrid = false;
	const damping = 0.99;
	const clickSpawnCount = 40;
	const gasSpawnCount = 5;
	const clickSpawnRadius = 0.12;
	const clickSpawnSpeed = 0.0;

	// Particle count controls
	const relWaterWidth = 0.6; // Water width as fraction of tank (0.1 to 1.0)
	const relWaterHeight = 0.8; // Water height as fraction of tank (0.1 to 1.0)
	const elementWidth = 0.3;
	const elementHeight = 0.3;
	const minIntersectingFluidCells = 2; // Set for sensitivity of fluid-solid collisions
	const interFluidCollisionIters = 1;

	const solidImageById: Record<string, string> = {
		aluminum: aluminumImage,
		caesium: caesiumImage,
		calcium: calciumImage,
		carbon: carbonImage,
		chromium: chromiumImage,
		copper: copperImage,
		iron: ironImage,
		lithium: lithiumImage,
		potassium: potassiumImage,
		silver: silverImage,
		silver_sulfide: silverSulfideImage,
		sulfur: sulfurImage,
		tin: tinImage,
		zinc: zincImage
	};

	function resizeCanvas() {
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const devicePixelRatio = window.devicePixelRatio || 1;

		canvas.width = rect.width * devicePixelRatio;
		canvas.height = rect.height * devicePixelRatio;

		const cScale = canvas.height / simHeight;
		simWidth = canvas.width / cScale;

		if (renderer) {
			renderer.resize(canvas.width, canvas.height);
		}
	}

	function simulate() {
		if (!solidElement) return;

		for (const fluid of fluids) {
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

		for (const { gas } of gases) {
			// Gas is buoyant: apply negative gravity for upward float
			gas.simulate(
				dt,
				-gravity.x * 0.35,
				-gravity.y * 0.35,
				flipRatio,
				numPressureIters,
				numParticleIters,
				overRelaxation,
				compensateDrift,
				separateParticles,
				damping
			);
		}

        // Every frame, check if a fluid object can be destroyed
		fluids = fluids.filter((f) => f.numParticles > 0);
		gases = gases.filter((g) => g.gas.numParticles > 0);

		if (activeSpawnFluid && activeSpawnFluid.numParticles <= 0) {
			activeSpawnFluid = null;
		}
		if (activeSpawnGasId && !gases.find((g) => g.id === activeSpawnGasId)) {
			activeSpawnGasId = null;
		}

		resolveInterFluidCollisions(interFluidCollisionIters);

		solidElement.step(dt, gravity.x, gravity.y, damping);

		const halfW = solidElement.getWidth() * 0.5;
		const halfH = solidElement.getHeight() * 0.5;
		solidElement.confineToBounds(halfW, simWidth - halfW, halfH, simHeight - halfH);

		fluidTouchingElement = fluids.some((fluid) => isFluidTouchingElement(fluid, solidElement));
	}

	function getTotalParticles(): number {
		let total = 0;
		for (const fluid of fluids) {
			total += fluid.numParticles;
		}
		return total;
	}

	function resolveInterFluidCollisions(numIters: number): void {
		if (fluids.length < 2) return;

		for (let iter = 0; iter < numIters; iter++) {
			for (let a = 0; a < fluids.length; a++) {
				for (let b = a + 1; b < fluids.length; b++) {
					const fluidA = fluids[a];
					const fluidB = fluids[b];

					const minDist = fluidA.particleRadius + fluidB.particleRadius;
					const minDist2 = minDist * minDist;

					for (let i = 0; i < fluidA.numParticles; i++) {
						const ax = fluidA.particlePos[2 * i];
						const ay = fluidA.particlePos[2 * i + 1];

						for (let j = 0; j < fluidB.numParticles; j++) {
							const bx = fluidB.particlePos[2 * j];
							const by = fluidB.particlePos[2 * j + 1];

							const dx = bx - ax;
							const dy = by - ay;
							const d2 = dx * dx + dy * dy;

							if (d2 > minDist2 || d2 === 0.0) continue;

							const d = Math.sqrt(d2);
							const s = 0.5 * (minDist - d) / d;
							const deltaX = dx * s;
							const deltaY = dy * s;

							fluidA.particlePos[2 * i] -= deltaX;
							fluidA.particlePos[2 * i + 1] -= deltaY;
							fluidB.particlePos[2 * j] += deltaX;
							fluidB.particlePos[2 * j + 1] += deltaY;
						}
					}
				}
			}
		}
	}

	function isFluidTouchingElement(fluid: FlipFluid, element: Element): boolean {
		const requiredCells = Math.max(1, Math.floor(minIntersectingFluidCells));
		const halfW = element.getWidth() * 0.5;
		const halfH = element.getHeight() * 0.5;
		const minX = Math.max(0.0, element.getX() - halfW);
		const maxX = Math.min(simWidth, element.getX() + halfW);
		const minY = Math.max(0.0, element.getY() - halfH);
		const maxY = Math.min(simHeight, element.getY() + halfH);

		let fluidCellCount = 0;
		const x0 = Math.max(0, Math.floor(minX * fluid.fInvSpacing));
		const x1 = Math.min(fluid.fNumX - 1, Math.floor(maxX * fluid.fInvSpacing));
		const y0 = Math.max(0, Math.floor(minY * fluid.fInvSpacing));
		const y1 = Math.min(fluid.fNumY - 1, Math.floor(maxY * fluid.fInvSpacing));

		for (let xi = x0; xi <= x1; xi++) {
			for (let yi = y0; yi <= y1; yi++) {
				if (fluid.cellType[xi * fluid.fNumY + yi] === FLUID_CELL) {
					fluidCellCount++;
					if (fluidCellCount >= requiredCells) return true;
				}
			}
		}

		return false;
	}

	function render() {
		if (!renderer || !solidElement) return;

		renderer.renderFluids(fluids, {
			showFluid: true,
			showParticles: showLiquidParticles,
			showGrid,
			simWidth,
			simHeight,
			element: {
				x: solidElement.getX(),
				y: solidElement.getY(),
				width: solidElement.getWidth(),
				height: solidElement.getHeight(),
				imageSrc: solidElement.getImageSrc(),
				isTouching: fluidTouchingElement
			}
		});

		for (const { gas } of gases) {
			gasRenderer.render(gas, {
				showFluid: true,
				showParticles: false,
				showGrid: false,
				simWidth,
				simHeight
			});
		}
	}

	function update() {
		simulate();
		render();
		animationId = requestAnimationFrame(update);
	}

	function getSolidImage(solidId: string): string {
		return solidImageById[solidId] ?? carbonImage;
	}

	function spawnSolidAt(x: number, y: number, solidId: string) {
		solidElement = new Element(solidId, 1.0, getSolidImage(solidId), elementWidth, elementHeight, x, y);
		const halfW = solidElement.getWidth() * 0.5;
		const halfH = solidElement.getHeight() * 0.5;
		solidElement.confineToBounds(halfW, simWidth - halfW, halfH, simHeight - halfH);
	}

	function createSpawnFluid(liquidId: string): FlipFluid | null {
		const remainingGlobalCapacity = maxTotalParticles - getTotalParticles();
		if (remainingGlobalCapacity <= 0) {
			return null;
		}

		const spawnedFluid = setupFluidScene(
			simWidth,
			simHeight,
			resolution,
			relWaterWidth,
			relWaterHeight,
			fluidColor,
			undefined,
			0.01,
			1.0,
			2.0,
			0,
			liquidId,
			remainingGlobalCapacity
		);
		fluids = [...fluids, spawnedFluid];
		return spawnedFluid;
	}

    // Fluid spawning function. If the same liquid already exists, it reuses that 
    // existing FlipFluid Object instead of creating a new one
	function getOrCreateSpawnFluid(liquidId: string): FlipFluid | null {
		const existing = fluids.find((f) => f.name === liquidId);
		if (existing) return existing;

        // Global max particle detection, so that the max particles counts all fluid particles
		if (maxTotalParticles - getTotalParticles() <= 0) return null;
		return createSpawnFluid(liquidId);
	}

	function createSpawnGas(gasId: string): FlipGas {
		const gas = setupGasScene(
			simWidth,
			simHeight,
			resolution,
			relWaterWidth,
			relWaterHeight,
			gasColor,
			foamColor,
			colorDiffusionCoeff,
			foamReturnRate
		);
		gases = [...gases, { id: gasId, gas }];
		return gas;
	}

	function getOrCreateSpawnGas(gasId: string): FlipGas {
		const existing = gases.find((g) => g.id === gasId);
		if (existing) return existing.gas;
		return createSpawnGas(gasId);
	}

    // Fluid spawning at pointer function
	function spawnAtClient(clientX: number, clientY: number) {
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const nx = (clientX - rect.left) / rect.width;
		const ny = (clientY - rect.top) / rect.height;

		const x = nx * simWidth;
		const y = (1.0 - ny) * simHeight;

		if (spawnMaterial.category === 'solid') {
			spawnSolidAt(x, y, spawnMaterial.id);
			return;
		}

		if (spawnMaterial.category === 'gas') {
			if (!activeSpawnGasId || activeSpawnGasId !== spawnMaterial.id) {
				activeSpawnGasId = spawnMaterial.id;
			}
			const gas = getOrCreateSpawnGas(spawnMaterial.id);
			gas.addNewParticles(gasSpawnCount, x, y);
			return;
		}

		if (!activeSpawnFluid) {
			activeSpawnFluid = getOrCreateSpawnFluid(spawnMaterial.id);
		}

		if (!activeSpawnFluid) return;

		const remainingGlobalCapacity = maxTotalParticles - getTotalParticles();
		if (remainingGlobalCapacity <= 0) return;

		const remainingLocalCapacity = activeSpawnFluid.maxParticles - activeSpawnFluid.numParticles;
		const spawnCount = Math.min(clickSpawnCount, remainingGlobalCapacity, remainingLocalCapacity);
		if (spawnCount <= 0) return;

		activeSpawnFluid.spawnParticlesInRectangle(x, y, clickSpawnRadius, spawnCount, clickSpawnSpeed);
	}

	onMount(() => {
		let id: number | null = null;
		let activePointerId: number | null = null;
		let touchDragging = false;
		let lastClientX = 0;
		let lastClientY = 0;

		const startSpawnLoop = () => {
			if (id !== null) return;
			id = window.setInterval(() => {
				if (!isDragging && !touchDragging) return;
				spawnAtClient(lastClientX, lastClientY);
			}, 100);
		};

		const stopSpawnLoop = () => {
			if (id !== null) {
				clearInterval(id);
				id = null;
			}
		};

		const stopDragging = () => {
			isDragging = false;
			touchDragging = false;
			activePointerId = null;
			activeSpawnFluid = null;
			stopSpawnLoop();
		};

		canvas.style.touchAction = 'none';

		const handlePointerDown = (event: PointerEvent) => {
			if (event.pointerType === 'touch') return;
			stopSpawnLoop();
			isDragging = true;
			activePointerId = event.pointerId;
			lastClientX = event.clientX;
			lastClientY = event.clientY;
			canvas.setPointerCapture(event.pointerId);
			spawnAtClient(lastClientX, lastClientY);
			startSpawnLoop();
		};

		const handlePointerMove = (event: PointerEvent) => {
			if (event.pointerType === 'touch') return;
			if (activePointerId !== event.pointerId) return;
			if (!isDragging) return;
			lastClientX = event.clientX;
			lastClientY = event.clientY;
			spawnAtClient(lastClientX, lastClientY);
		};

		const handlePointerUp = (event: PointerEvent) => {
			if (event.pointerType === 'touch') return;
			if (activePointerId !== event.pointerId) return;
			stopDragging();
			if (canvas.hasPointerCapture(event.pointerId)) {
				canvas.releasePointerCapture(event.pointerId);
			}
		};

		const handlePointerCancel = (event: PointerEvent) => {
			if (event.pointerType === 'touch') return;
			if (activePointerId !== event.pointerId) return;
			stopDragging();
		};

		const handleLostPointerCapture = () => {
			stopDragging();
		};

		const handleTouchStart = (event: TouchEvent) => {
			if (!event.touches.length) return;
			event.preventDefault();
			stopSpawnLoop();
			touchDragging = true;
			const touch = event.touches[0];
			lastClientX = touch.clientX;
			lastClientY = touch.clientY;
			spawnAtClient(lastClientX, lastClientY);
			startSpawnLoop();
		};

		const handleTouchMove = (event: TouchEvent) => {
			if (!touchDragging || !event.touches.length) return;
			event.preventDefault();
			const touch = event.touches[0];
			lastClientX = touch.clientX;
			lastClientY = touch.clientY;
			spawnAtClient(lastClientX, lastClientY);
		};

		const handleTouchEnd = () => {
			if (!touchDragging) return;
			stopDragging();
		};

		const pointerOptions: AddEventListenerOptions = { passive: false };
		const touchOptions: AddEventListenerOptions = { passive: false };

		canvas.addEventListener('pointerdown', handlePointerDown, pointerOptions);
		canvas.addEventListener('pointermove', handlePointerMove, pointerOptions);
		canvas.addEventListener('pointerup', handlePointerUp, pointerOptions);
		canvas.addEventListener('pointercancel', handlePointerCancel, pointerOptions);
		canvas.addEventListener('lostpointercapture', handleLostPointerCapture, pointerOptions);
		canvas.addEventListener('touchstart', handleTouchStart, touchOptions);
		canvas.addEventListener('touchmove', handleTouchMove, touchOptions);
		canvas.addEventListener('touchend', handleTouchEnd, touchOptions);
		canvas.addEventListener('touchcancel', handleTouchEnd, touchOptions);

		return () => {
			stopDragging();
			canvas.removeEventListener('pointerdown', handlePointerDown, pointerOptions);
			canvas.removeEventListener('pointermove', handlePointerMove, pointerOptions);
			canvas.removeEventListener('pointerup', handlePointerUp, pointerOptions);
			canvas.removeEventListener('pointercancel', handlePointerCancel, pointerOptions);
			canvas.removeEventListener('lostpointercapture', handleLostPointerCapture, pointerOptions);
			canvas.removeEventListener('touchstart', handleTouchStart, touchOptions);
			canvas.removeEventListener('touchmove', handleTouchMove, touchOptions);
			canvas.removeEventListener('touchend', handleTouchEnd, touchOptions);
			canvas.removeEventListener('touchcancel', handleTouchEnd, touchOptions);
		};
	});

	onMount(() => {
		resizeCanvas();

		const baseFluid = setupFluidScene(simWidth, simHeight, resolution, relWaterWidth, relWaterHeight, fluidColor);
		maxTotalParticles = baseFluid.maxParticles;
		fluids = [baseFluid];
		renderer = new FluidRenderer(canvas);
		gasRenderer = new GasRenderer(canvas);
		solidElement = new Element(
			'block',
			1.0,
			carbonImage,
			elementWidth,
			elementHeight,
			simWidth * 0.5,
			simHeight * 0.75
		);

		for (const fluid of fluids) {
			fluid.setFluidColor(fluidColor);
		}

		const handleResize = () => {
			resizeCanvas();
		};
		window.addEventListener('resize', handleResize);

		update();

		return () => {
			window.removeEventListener('resize', handleResize);
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		};
	});

	$effect(() => {
		for (const fluid of fluids) {
			fluid.setFluidColor(fluidColor);
		}
		for (const { gas } of gases) {
			gas.setFluidColor(gasColor);
			gas.setFoamColor(foamColor);
			gas.setColorDiffusionCoeff(colorDiffusionCoeff);
			gas.setFoamReturnRate(foamReturnRate);
		}
	});
</script>

<canvas bind:this={canvas} class="absolute inset-0 z-10 h-full w-full"></canvas>
