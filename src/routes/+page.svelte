<script lang="ts">
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import Smartphone from '@lucide/svelte/icons/smartphone';

	import { onMount, onDestroy } from 'svelte';

	import Palette from '@lucide/svelte/icons/palette';
	import X from '@lucide/svelte/icons/x';

	import { browser } from '$app/environment';
	import FluidSimulation from '$lib/FluidSimulation.svelte';

	const MAX_GRAVITY = 9.81;

	type AppState = 'loading' | 'needs-permission' | 'ready' | 'denied' | 'not-supported';
	type MaterialCategory = 'solid' | 'liquid' | 'gas';
	type MaterialTab = 'solids' | 'liquids' | 'gases';

	type MaterialOption = {
		id: string;
		label: string;
		category: MaterialCategory;
		fluidColor?: { r: number; g: number; b: number };
		gasColor?: { r: number; g: number; b: number; a: number };
		foamColor?: { r: number; g: number; b: number; a: number };
	};

	const solidOptions: MaterialOption[] = [
		{ id: 'aluminum', label: 'Aluminum', category: 'solid' },
		{ id: 'caesium', label: 'Caesium', category: 'solid' },
		{ id: 'calcium', label: 'Calcium', category: 'solid' },
		{ id: 'carbon', label: 'Carbon', category: 'solid' },
		{ id: 'chromium', label: 'Chromium', category: 'solid' },
		{ id: 'copper', label: 'Copper', category: 'solid' },
		{ id: 'iron', label: 'Iron', category: 'solid' },
		{ id: 'lithium', label: 'Lithium', category: 'solid' },
		{ id: 'potassium', label: 'Potassium', category: 'solid' },
		{ id: 'silver', label: 'Silver', category: 'solid' },
		{ id: 'silver_sulfide', label: 'Silver Sulfide', category: 'solid' },
		{ id: 'sulfur', label: 'Sulfur', category: 'solid' },
		{ id: 'tin', label: 'Tin', category: 'solid' },
		{ id: 'zinc', label: 'Zinc', category: 'solid' }
	];

	const liquidOptions: MaterialOption[] = [
		{ id: 'water', label: 'Water', category: 'liquid', fluidColor: { r: 0.09, g: 0.4, b: 1.0 } }
	];

	const gasOptions: MaterialOption[] = [
		{
			id: 'steam',
			label: 'Steam',
			category: 'gas',
			gasColor: { r: 0.5, g: 0.5, b: 0.5, a: 0.2 },
			foamColor: { r: 0.5, g: 0.5, b: 0.5, a: 0.2 }
		}
	];

	let selectedMaterial = $state<MaterialOption>(liquidOptions[0]);
	let materialWindowOpen = $state(false);
	let activeTab = $state<MaterialTab>('liquids');
	let showLiquidParticles = $state(false);

	const defaultFluidColor = { r: 0.09, g: 0.4, b: 1.0 };
	const defaultGasColor = { r: 0.7, g: 0.7, b: 0.75, a: 0.22 };
	const defaultFoamColor = { r: 0.85, g: 0.85, b: 0.9, a: 0 };

	let currentFluidColor = defaultFluidColor;
	let currentGasColor = defaultGasColor;

	function toCSS(c: { r: number; g: number; b: number }) {
		return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;
	}

	function selectMaterial(material: MaterialOption) {
		selectedMaterial = material;
		if (selectedMaterial.category == 'liquid') {
			currentFluidColor = selectedMaterial.fluidColor ?? defaultFluidColor;
		}
		if (selectedMaterial.category == 'gas') {
			currentGasColor = selectedMaterial.gasColor ?? defaultGasColor;
		}
	}

	const activeFluidColor = $derived(currentFluidColor ?? defaultFluidColor);
	const activeGasColor = $derived(currentGasColor ?? defaultGasColor);
	const activeFoamColor = $derived(defaultFoamColor);
	const activePreviewColor = $derived(
		selectedMaterial.fluidColor ??
			(selectedMaterial.gasColor
				? {
						r: selectedMaterial.gasColor.r,
						g: selectedMaterial.gasColor.g,
						b: selectedMaterial.gasColor.b
					}
				: defaultFluidColor)
	);

	let angle: number | undefined = $state(0);
	let gravity: { x: number; y: number } = $state({ x: 0, y: -MAX_GRAVITY });

	let appState: AppState = $state('loading');

	// Shake detection
	let lastShakeTime = 0;
	let lastAcceleration = { x: 0, y: 0, z: 0 };
	let shakeThreshold = 15;
	let shakeTimeThreshold = 600;

	const requestPermission = async () => {
		if (!browser) return;

		if (
			'DeviceOrientationEvent' in window &&
			typeof (DeviceOrientationEvent as any).requestPermission === 'function'
		) {
			// iOS 13+ permission request
			try {
				const orientationResponse = await (DeviceOrientationEvent as any).requestPermission();
				let motionResponse = 'granted';

				// Also request motion permission if available
				if (
					'DeviceMotionEvent' in window &&
					typeof (DeviceMotionEvent as any).requestPermission === 'function'
				) {
					motionResponse = await (DeviceMotionEvent as any).requestPermission();
				}

				if (orientationResponse === 'granted' && motionResponse === 'granted') {
					startListening();
					appState = 'ready';
				} else {
					appState = 'denied';
				}
			} catch (error) {
				console.error('Error requesting device motion/orientation permission:', error);
				appState = 'denied';
			}
		} else if ('DeviceOrientationEvent' in window) {
			startListening();
			appState = 'ready';
		} else {
			appState = 'not-supported';
		}
	};

	const startListening = () => {
		if (!browser) return;
		window.addEventListener('deviceorientation', onOrientationChange);
		window.addEventListener('devicemotion', onDeviceMotion);
	};

	const onDeviceMotion = (event: DeviceMotionEvent) => {
		if (!event.accelerationIncludingGravity) return;

		const acceleration = event.accelerationIncludingGravity;
		const x = acceleration.x || 0;
		const y = acceleration.y || 0;
		const z = acceleration.z || 0;

		// Calculate the magnitude of acceleration change
		const deltaX = Math.abs(x - lastAcceleration.x);
		const deltaY = Math.abs(y - lastAcceleration.y);
		const deltaZ = Math.abs(z - lastAcceleration.z);

		const totalDelta = deltaX + deltaY + deltaZ;
		const currentTime = Date.now();

		// Check if shake threshold is exceeded and enough time has passed
		if (totalDelta > shakeThreshold && currentTime - lastShakeTime > shakeTimeThreshold) {
			onShake();
			lastShakeTime = currentTime;
		}

		// Update last acceleration values
		lastAcceleration = { x, y, z };
	};

	const onOrientationChange = (event: DeviceOrientationEvent) => {
		if (event.beta !== null && event.gamma !== null) {
			const beta = event.beta;
			const gamma = event.gamma;

			const betaRad = beta * (Math.PI / 180);
			const gammaRad = gamma * (Math.PI / 180);

			const cosBeta = Math.cos(betaRad);
			const sinBeta = Math.sin(betaRad);
			const sinGamma = Math.sin(gammaRad);

			const gx = sinGamma * cosBeta;
			const gy = -sinBeta;

			gravity.x = MAX_GRAVITY * Math.max(-1, Math.min(1, gx));
			gravity.y = MAX_GRAVITY * Math.max(-1, Math.min(1, gy));
		}
	};

	onMount(async () => {
		if (!browser) return;

		if (!('DeviceOrientationEvent' in window)) {
			gravity = { x: 0, y: -MAX_GRAVITY };
			angle = 0;
			appState = 'not-supported';
			return;
		}

		if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
			appState = 'needs-permission';
		} else {
			startListening();
			appState = 'ready';
		}
	});

	onDestroy(() => {
		if (browser && window) {
			window.removeEventListener('deviceorientation', onOrientationChange);
			window.removeEventListener('devicemotion', onDeviceMotion);
		}
	});

	const onShake = () => {};
</script>

<div
	class="relative flex h-dvh overflow-hidden flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-950"
>
	{#if appState === 'loading'}
		<div class="text-center">
			<Loader2 class="mx-auto mb-4 h-12 w-12 animate-spin text-blue-400" />
			<h1 class="mb-2 text-2xl font-bold text-white">Fluid Simulation</h1>
			<p class="text-gray-300">Initializing...</p>
		</div>
	{:else if appState === 'needs-permission'}
		<div class="text-center">
			<Smartphone class="mx-auto mb-6 h-16 w-16 text-blue-400" />
			<h1 class="mb-4 text-2xl font-bold text-white">Motion Sensors Required</h1>
			<p class="mb-6 max-w-sm text-gray-300">
				This fluid simulation responds to your device's tilt and orientation. It also detects shake
				gestures to change fluid colors! Please grant permission to access motion sensors for the
				best experience.
			</p>
			<button
				onclick={requestPermission}
				class="rounded-lg bg-blue-500 px-8 py-3 font-semibold text-white shadow-lg transition-colors hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 focus:outline-none"
			>
				Enable Motion Sensors
			</button>
		</div>
	{:else if appState === 'denied'}
		<div class="text-center">
			<div class="mb-6 text-6xl">🚫</div>
			<h2 class="mb-4 text-xl font-semibold text-white">Permission Denied</h2>
			<p class="max-w-sm text-center text-gray-300">
				Motion sensor access was denied. You can still use the simulation, but it won't respond to
				device tilt. To enable this feature, please allow motion access in your browser settings.
			</p>
			<button
				onclick={requestPermission}
				class="mt-4 rounded-lg bg-gray-600 px-6 py-2 text-white transition-colors hover:bg-gray-500"
			>
				Try Again
			</button>
		</div>
	{:else}
		<FluidSimulation
			{gravity}
			fluidColor={activeFluidColor}
			{showLiquidParticles}
			gasColor={activeGasColor}
			foamColor={activeFoamColor}
			spawnMaterial={{ category: selectedMaterial.category, id: selectedMaterial.id }}
		/>

		<!-- Material picker window -->
		<div class="absolute top-5 right-5 z-20 flex flex-col items-center gap-2">
			<button
				onclick={() => (materialWindowOpen = !materialWindowOpen)}
				class="flex h-10 w-10 items-center justify-center rounded-full shadow-lg backdrop-blur-sm transition-colors"
				style:background-color={materialWindowOpen ? 'rgba(255,255,255,0.2)' : toCSS(activePreviewColor)}
			>
				{#if materialWindowOpen}
					<X class="h-5 w-5 text-white" />
				{:else}
					<Palette class="h-5 w-5 text-white drop-shadow" />
				{/if}
			</button>

			{#if materialWindowOpen}
				<div class="w-64 rounded-xl bg-black/50 p-3 backdrop-blur-md">
					<button
						onclick={() => (showLiquidParticles = !showLiquidParticles)}
						class="mb-3 flex w-full items-center justify-between rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
					>
						<span>Show Liquid Particles</span>
						<span>{showLiquidParticles ? 'ON' : 'OFF'}</span>
					</button>

					<div class="mb-3 grid grid-cols-3 gap-1">
						<button
							onclick={() => (activeTab = 'solids')}
							class={`rounded-md px-2 py-1 text-xs font-semibold text-white transition-colors ${activeTab === 'solids' ? 'bg-white/20' : 'bg-white/5'}`}
						>Solids</button>
						<button
							onclick={() => (activeTab = 'liquids')}
							class={`rounded-md px-2 py-1 text-xs font-semibold text-white transition-colors ${activeTab === 'liquids' ? 'bg-white/20' : 'bg-white/5'}`}
						>Liquids</button>
						<button
							onclick={() => (activeTab = 'gases')}
							class={`rounded-md px-2 py-1 text-xs font-semibold text-white transition-colors ${activeTab === 'gases' ? 'bg-white/20' : 'bg-white/5'}`}
						>Gases</button>
					</div>

					{#if activeTab === 'solids'}
						<div class="space-y-2">
							{#each solidOptions as item}
								<button
									onclick={() => selectMaterial(item)}
									class={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-white transition-colors ${selectedMaterial.id === item.id && selectedMaterial.category === item.category ? 'bg-white/20' : 'bg-white/10'}`}
								>
									<span>{item.label}</span>
									<span class="text-xs text-white/70">Solid</span>
								</button>
							{/each}
						</div>
					{:else if activeTab === 'liquids'}
						<div class="space-y-2">
							{#each liquidOptions as item}
								<button
									onclick={() => selectMaterial(item)}
									class={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-white transition-colors ${selectedMaterial.id === item.id && selectedMaterial.category === item.category ? 'bg-white/20' : 'bg-white/10'}`}
								>
									<span>{item.label}</span>
									<span class="text-xs text-white/70">Liquid</span>
								</button>
							{/each}
						</div>
					{:else}
						<div class="space-y-2">
							{#each gasOptions as item}
								<button
									onclick={() => selectMaterial(item)}
									class={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-white transition-colors ${selectedMaterial.id === item.id && selectedMaterial.category === item.category ? 'bg-white/20' : 'bg-white/10'}`}
								>
									<span>{item.label}</span>
									<span class="text-xs text-white/70">Gas</span>
								</button>
							{/each}
						</div>
					{/if}

					<div class="mt-3 rounded-md bg-white/10 px-3 py-2 text-xs text-white/80">
						Brush: {selectedMaterial.label} ({selectedMaterial.category})
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
