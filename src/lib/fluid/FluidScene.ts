import { FlipFluid } from './FlipFluid';

export interface SceneConfig {
    gravity: number;
    dt: number;
    flipRatio: number;
    numPressureIters: number;
    numParticleIters: number;
    overRelaxation: number;
    compensateDrift: boolean;
    separateParticles: boolean;
    showParticles: boolean;
    showGrid: boolean;
}

export const DEFAULT_SCENE_CONFIG: SceneConfig = {
    gravity: 0.4,
    dt: 1.0 / 120.0,
    flipRatio: 0.9,
    numPressureIters: 100,
    numParticleIters: 2,
    overRelaxation: 1.9,
    compensateDrift: true,
    separateParticles: true,
    showParticles: true,
    showGrid: false
};

export function setupGasScene(
    simWidth: number,
    simHeight: number,
    resolution = 70,
    relWaterWidth = 0.6,
    relWaterHeight = 0.8,
    baseColor?: { r: number; g: number; b: number },
    foamColor?: { r: number; g: number; b: number },
    colorDiffusionCoeff: number = 0.01,
    foamReturnRate: number = 1.0
): FlipFluid {
    const tankHeight = simHeight;
    const tankWidth = simWidth;
    const h = tankHeight / resolution;
    const density = 0.3;

    // Particle setup
    const r = 0.3 * h;
    const dx = 2.0 * r;
    const dy = Math.sqrt(3.0) / 2.0 * dx;

    const numX = Math.floor((relWaterWidth * tankWidth - 2.0 * h - 2.0 * r) / dx);
    const numY = Math.floor((relWaterHeight * tankHeight - 2.0 * h - 2.0 * r) / dy);
    const maxParticles = numX * numY;

    // Create fluid
    const fluid = new FlipFluid(
        density,
        tankWidth,
        tankHeight,
        h,
        r,
        maxParticles,
        baseColor,
        foamColor,
        colorDiffusionCoeff,
        foamReturnRate
    );

    // Create particles randomly distributed in the tank
    fluid.numParticles = maxParticles;

// Spawn particles at the bottom for rising gas effect - spread out widely
	let p = 0;
	const startY = h + 0.02 * tankHeight; // Very bottom of tank (2%)
	const endY = h + 0.30 * tankHeight;   // Up to 30% of tank (wider vertical spread)
	const startX = tankWidth * 0.1;       // 10% from left
	const endX = tankWidth * 0.9;         // 10% from right (much wider)
	for (let i = 0; i < maxParticles; i++) {
		fluid.particlePos[p++] = startX + Math.random() * (endX - startX);
		fluid.particlePos[p++] = startY + Math.random() * (endY - startY);
	}

	// Setup grid cells for the tank boundaries
	const n = fluid.fNumY;
	for (let i = 0; i < fluid.fNumX; i++) {
		for (let j = 0; j < fluid.fNumY; j++) {
			let s = 1.0; // Gas
			if (i === 0 || i === fluid.fNumX - 1) {
				s = 0.0; // Solid
			}
			fluid.s[i * n + j] = s;
		}
	}

	return fluid;
}
