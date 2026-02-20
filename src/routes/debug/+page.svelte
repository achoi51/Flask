<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	let gravityX: number = $state(0);
	let gravityY: number = $state(0);
	let hasReceivedData: boolean = $state(false);
	let permission: string = $state('unknown');
	let showDebug: boolean = $state(true);

	type DebugState = {
		listening: boolean;
		motionListening: boolean;
		eventCount: number;
		motionEventCount: number;
		lastBeta: number | null;
		lastGamma: number | null;
		lastAlpha: number | null;
		lastBetaRad: number | null;
		lastGammaRad: number | null;
		lastAbsolute: boolean | null;
		lastTimestamp: string;
		lastError: string;
		userAgent: string;
		secureContext: boolean;
		deviceOrientationSupported: boolean;
		requestPermissionSupported: boolean;
		deviceMotionSupported: boolean;
		screenOrientationType: string;
		screenAngle: number | null;
		innerWidth: number;
		innerHeight: number;
		gxMin: number;
		gxMax: number;
		gyMin: number;
		gyMax: number;
		lastAccelX: number | null;
		lastAccelY: number | null;
		lastAccelZ: number | null;
		lastAccelGX: number | null;
		lastAccelGY: number | null;
		lastAccelGZ: number | null;
	};

	let debug = $state<DebugState>({
		listening: false,
		motionListening: false,
		eventCount: 0,
		motionEventCount: 0,
		lastBeta: null,
		lastGamma: null,
		lastAlpha: null,
		lastBetaRad: null,
		lastGammaRad: null,
		lastAbsolute: null,
		lastTimestamp: '',
		lastError: '',
		userAgent: '',
		secureContext: false,
		deviceOrientationSupported: false,
		requestPermissionSupported: false,
		deviceMotionSupported: false,
		screenOrientationType: '',
		screenAngle: null,
		innerWidth: 0,
		innerHeight: 0,
		gxMin: Infinity,
		gxMax: -Infinity,
		gyMin: Infinity,
		gyMax: -Infinity,
		lastAccelX: null,
		lastAccelY: null,
		lastAccelZ: null,
		lastAccelGX: null,
		lastAccelGY: null,
		lastAccelGZ: null
	});

	let logs = $state<string[]>([]);

	function addLog(message: string) {
		const time = new Date().toLocaleTimeString();
		logs = [`[${time}] ${message}`, ...logs].slice(0, 30);
		console.log(`[gravity-debug] ${message}`);
	}

	function setError(message: string, error?: unknown) {
		const suffix =
			error instanceof Error ? `: ${error.message}` : error ? `: ${String(error)}` : '';
		debug.lastError = `${message}${suffix}`;
		addLog(`ERROR ${debug.lastError}`);
		console.error(message, error);
	}

	function refreshEnvironmentInfo() {
		if (!browser) return;
		debug.innerWidth = window.innerWidth;
		debug.innerHeight = window.innerHeight;
		debug.screenOrientationType = screen.orientation?.type ?? 'unknown';
		debug.screenAngle = screen.orientation?.angle ?? (window.orientation as number | undefined) ?? null;
	}

	function resetDebugRanges() {
		debug.gxMin = Infinity;
		debug.gxMax = -Infinity;
		debug.gyMin = Infinity;
		debug.gyMax = -Infinity;
		addLog('Reset min/max ranges');
	}

	async function copyDebugSnapshot() {
		const snapshot = {
			permission,
			hasReceivedData,
			gravityX,
			gravityY,
			debug,
			recentLogs: logs
		};

		const text = JSON.stringify(snapshot, null, 2);

		try {
			await navigator.clipboard.writeText(text);
			addLog('Copied debug snapshot to clipboard');
		} catch (error) {
			setError('Failed to copy debug snapshot', error);
		}
	}

	const requestPermission = async () => {
		if (!browser) return;

		addLog('requestPermission() called');

		if (
			'DeviceOrientationEvent' in window &&
			typeof (DeviceOrientationEvent as any).requestPermission === 'function'
		) {
			try {
				addLog('Using DeviceOrientationEvent.requestPermission()');
				const response = await (DeviceOrientationEvent as any).requestPermission();
				permission = response;
				addLog(`Orientation permission response: ${response}`);

				if (response === 'granted') {
					startListening();
					startMotionListening();
				}
			} catch (error) {
				permission = 'denied';
				setError('Error requesting device orientation permission', error);
			}
		} else if ('DeviceOrientationEvent' in window) {
			permission = 'granted';
			addLog('No explicit orientation permission required');
			startListening();
			startMotionListening();
		} else {
			permission = 'not-supported';
			addLog('DeviceOrientationEvent not supported');
		}
	};

	const startListening = () => {
		if (!browser || debug.listening) return;
		window.addEventListener('deviceorientation', onOrientationChange);
		debug.listening = true;
		addLog('Started listening for deviceorientation');
	};

	const startMotionListening = () => {
		if (!browser || debug.motionListening) return;
		window.addEventListener('devicemotion', onMotionChange);
		debug.motionListening = true;
		addLog('Started listening for devicemotion');
	};

	const onOrientationChange = (event: DeviceOrientationEvent) => {
		debug.eventCount += 1;
		debug.lastBeta = event.beta;
		debug.lastGamma = event.gamma;
		debug.lastAlpha = event.alpha;
		debug.lastAbsolute = event.absolute;
		debug.lastTimestamp = new Date().toLocaleTimeString();

		if (event.beta !== null && event.gamma !== null) {
			const beta = event.beta;
			const gamma = event.gamma;

			const betaRad = beta * (Math.PI / 180);
			const gammaRad = gamma * (Math.PI / 180);

			debug.lastBetaRad = betaRad;
			debug.lastGammaRad = gammaRad;

			const cosBeta = Math.cos(betaRad);
			const sinBeta = Math.sin(betaRad);
			const sinGamma = Math.sin(gammaRad);

			const gx = sinGamma * cosBeta;
			const gy = sinBeta;

			gravityX = Math.max(-1, Math.min(1, gx));
			gravityY = Math.max(-1, Math.min(1, gy));

			debug.gxMin = Math.min(debug.gxMin, gravityX);
			debug.gxMax = Math.max(debug.gxMax, gravityX);
			debug.gyMin = Math.min(debug.gyMin, gravityY);
			debug.gyMax = Math.max(debug.gyMax, gravityY);

			if (!hasReceivedData) {
				hasReceivedData = true;
				addLog('First valid orientation payload received');
			}

			if (debug.eventCount <= 5 || debug.eventCount % 50 === 0) {
				addLog(
					`orientation #${debug.eventCount}: beta=${beta?.toFixed?.(2)}, gamma=${gamma?.toFixed?.(2)}, gx=${gravityX.toFixed(3)}, gy=${gravityY.toFixed(3)}`
				);
			}
		} else {
			if (debug.eventCount <= 5 || debug.eventCount % 20 === 0) {
				addLog(
					`orientation #${debug.eventCount}: received event with null beta/gamma`
				);
			}
		}
	};

	const onMotionChange = (event: DeviceMotionEvent) => {
		debug.motionEventCount += 1;

		debug.lastAccelX = event.acceleration?.x ?? null;
		debug.lastAccelY = event.acceleration?.y ?? null;
		debug.lastAccelZ = event.acceleration?.z ?? null;

		debug.lastAccelGX = event.accelerationIncludingGravity?.x ?? null;
		debug.lastAccelGY = event.accelerationIncludingGravity?.y ?? null;
		debug.lastAccelGZ = event.accelerationIncludingGravity?.z ?? null;

		if (debug.motionEventCount <= 3 || debug.motionEventCount % 50 === 0) {
			addLog(
				`motion #${debug.motionEventCount}: axg=${debug.lastAccelGX}, ayg=${debug.lastAccelGY}, azg=${debug.lastAccelGZ}`
			);
		}
	};

	function handleVisibilityChange() {
		addLog(`Document visibility: ${document.visibilityState}`);
	}

	function handleResize() {
		refreshEnvironmentInfo();
		addLog(`Resize: ${debug.innerWidth}x${debug.innerHeight}`);
	}

	function handleScreenOrientationChange() {
		refreshEnvironmentInfo();
		addLog(
			`Screen orientation changed: ${debug.screenOrientationType}, angle=${debug.screenAngle}`
		);
	}

	onMount(() => {
		if (!browser) return;

		debug.userAgent = navigator.userAgent;
		debug.secureContext = window.isSecureContext;
		debug.deviceOrientationSupported = 'DeviceOrientationEvent' in window;
		debug.requestPermissionSupported =
			'DeviceOrientationEvent' in window &&
			typeof (DeviceOrientationEvent as any).requestPermission === 'function';
		debug.deviceMotionSupported = 'DeviceMotionEvent' in window;

		refreshEnvironmentInfo();

		addLog(`Mounted. secureContext=${debug.secureContext}`);
		addLog(`Orientation supported=${debug.deviceOrientationSupported}`);
		addLog(`Motion supported=${debug.deviceMotionSupported}`);
		addLog(`requestPermission supported=${debug.requestPermissionSupported}`);
		addLog(`Initial screen orientation=${debug.screenOrientationType}, angle=${debug.screenAngle}`);

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('resize', handleResize);
		screen.orientation?.addEventListener?.('change', handleScreenOrientationChange);

		if (
			!(
				'DeviceOrientationEvent' in window &&
				typeof (DeviceOrientationEvent as any).requestPermission === 'function'
			)
		) {
			requestPermission();
		}
	});

	onDestroy(() => {
		if (!browser) return;

		window.removeEventListener('deviceorientation', onOrientationChange);
		window.removeEventListener('devicemotion', onMotionChange);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('resize', handleResize);
		screen.orientation?.removeEventListener?.('change', handleScreenOrientationChange);

		debug.listening = false;
		debug.motionListening = false;
		addLog('Cleaned up listeners');
	});

	const xBarStyle = $derived.by(() => {
		const width = Math.abs(gravityX) * 50;
		if (gravityX > 0) return `left: 50%; width: ${width}%;`;
		return `right: 50%; width: ${width}%;`;
	});

	const yBarStyle = $derived.by(() => {
		const height = Math.abs(gravityY) * 50;
		if (gravityY > 0) return `top: 50%; height: ${height}%;`;
		return `bottom: 50%; height: ${height}%;`;
	});

	const debugSummary = $derived.by(() =>
		JSON.stringify(
			{
				permission,
				hasReceivedData,
				gravityX: Number(gravityX.toFixed(4)),
				gravityY: Number(gravityY.toFixed(4)),
				eventCount: debug.eventCount,
				motionEventCount: debug.motionEventCount,
				lastBeta: debug.lastBeta,
				lastGamma: debug.lastGamma,
				lastAlpha: debug.lastAlpha,
				lastError: debug.lastError
			},
			null,
			2
		)
	);
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-slate-800 px-4 text-white">
	{#if permission === 'unknown'}
		<div class="text-center">
			<h1 class="mb-4 text-2xl font-bold">Gravity Vectors</h1>
			<p class="mb-6 max-w-sm">
				This demo needs access to your device's orientation sensors to work.
			</p>
			<button
				on:click={requestPermission}
				class="rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white shadow-lg hover:bg-blue-600"
			>
				Enable Device Orientation
			</button>
		</div>
	{:else if permission === 'denied'}
		<p class="max-w-sm text-center text-xl">
			Permission denied. Please enable Motion & Orientation Access for this site in your browser
			settings.
		</p>
	{:else if permission === 'not-supported'}
		<p class="text-center text-xl">Device orientation not supported on this device.</p>
	{:else if !hasReceivedData}
		<p>Waiting for orientation data...</p>
	{:else}
		<div
			class="relative mb-8 h-64 w-64 rounded-lg border-2 border-slate-500 bg-slate-900/50 shadow-lg"
		>
			<div
				class="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-slate-600"
				aria-hidden="true"
			></div>
			<div
				class="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-slate-600"
				aria-hidden="true"
			></div>

			<div
				class="absolute left-1/2 w-4 -translate-x-1/2 rounded-full bg-blue-400/80 transition-[height]"
				style={yBarStyle}
			></div>

			<div
				class="absolute top-1/2 h-4 -translate-y-1/2 rounded-full bg-red-400/80 transition-[width]"
				style={xBarStyle}
			></div>

			<span class="absolute top-1 right-2 text-xs text-red-400">gX</span>
			<span class="absolute top-2 left-1 text-xs text-blue-400">gY</span>
		</div>

		<div class="mb-6 text-center font-mono">
			<p>Gravity X: <span class="font-bold text-red-400">{gravityX.toFixed(3)}</span></p>
			<p>Gravity Y: <span class="font-bold text-blue-400">{gravityY.toFixed(3)}</span></p>
		</div>
	{/if}

	<div class="mb-3 flex flex-wrap items-center justify-center gap-2">
		<button
			on:click={() => (showDebug = !showDebug)}
			class="rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
		>
			{showDebug ? 'Hide' : 'Show'} Debug
		</button>

		<button
			on:click={resetDebugRanges}
			class="rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
		>
			Reset Ranges
		</button>

		<button
			on:click={copyDebugSnapshot}
			class="rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
		>
			Copy Snapshot
		</button>
	</div>

	{#if showDebug}
		<div class="w-full max-w-3xl rounded-lg border border-slate-600 bg-slate-900 p-4 text-xs font-mono">
			<h2 class="mb-3 text-sm font-bold text-yellow-300">Debug Panel</h2>

			<div class="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
				<div>permission</div><div>{permission}</div>
				<div>hasReceivedData</div><div>{String(hasReceivedData)}</div>

				<div>listening</div><div>{String(debug.listening)}</div>
				<div>motionListening</div><div>{String(debug.motionListening)}</div>

				<div>eventCount</div><div>{debug.eventCount}</div>
				<div>motionEventCount</div><div>{debug.motionEventCount}</div>

				<div>lastBeta</div><div>{debug.lastBeta ?? 'null'}</div>
				<div>lastGamma</div><div>{debug.lastGamma ?? 'null'}</div>

				<div>lastAlpha</div><div>{debug.lastAlpha ?? 'null'}</div>
				<div>lastAbsolute</div><div>{String(debug.lastAbsolute)}</div>

				<div>lastBetaRad</div><div>{debug.lastBetaRad ?? 'null'}</div>
				<div>lastGammaRad</div><div>{debug.lastGammaRad ?? 'null'}</div>

				<div>gxMin</div><div>{Number.isFinite(debug.gxMin) ? debug.gxMin.toFixed(3) : 'n/a'}</div>
				<div>gxMax</div><div>{Number.isFinite(debug.gxMax) ? debug.gxMax.toFixed(3) : 'n/a'}</div>

				<div>gyMin</div><div>{Number.isFinite(debug.gyMin) ? debug.gyMin.toFixed(3) : 'n/a'}</div>
				<div>gyMax</div><div>{Number.isFinite(debug.gyMax) ? debug.gyMax.toFixed(3) : 'n/a'}</div>

				<div>secureContext</div><div>{String(debug.secureContext)}</div>
				<div>orientationSupported</div><div>{String(debug.deviceOrientationSupported)}</div>

				<div>motionSupported</div><div>{String(debug.deviceMotionSupported)}</div>
				<div>requestPermission</div><div>{String(debug.requestPermissionSupported)}</div>

				<div>screenType</div><div>{debug.screenOrientationType}</div>
				<div>screenAngle</div><div>{debug.screenAngle ?? 'null'}</div>

				<div>viewport</div><div>{debug.innerWidth}×{debug.innerHeight}</div>
				<div>lastEvent</div><div>{debug.lastTimestamp || 'none'}</div>

				<div>accel x/y/z</div>
				<div>{debug.lastAccelX ?? 'null'} / {debug.lastAccelY ?? 'null'} / {debug.lastAccelZ ?? 'null'}</div>

				<div>accel+g x/y/z</div>
				<div>{debug.lastAccelGX ?? 'null'} / {debug.lastAccelGY ?? 'null'} / {debug.lastAccelGZ ?? 'null'}</div>
			</div>

			{#if debug.lastError}
				<div class="mb-4 rounded border border-red-500 bg-red-950 p-2 text-red-200">
					<strong>Last error:</strong> {debug.lastError}
				</div>
			{/if}

			<div class="mb-4">
				<div class="mb-1 text-slate-300">Summary</div>
				<pre class="overflow-auto rounded bg-slate-950 p-2 text-slate-300">{debugSummary}</pre>
			</div>

			<div>
				<div class="mb-1 text-slate-300">Logs</div>
				<div class="max-h-72 overflow-auto rounded bg-slate-950 p-2">
					{#each logs as log}
						<div class="mb-1 break-all text-slate-300">{log}</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>