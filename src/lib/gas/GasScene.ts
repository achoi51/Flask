import { FlipGas } from './FlipGas';

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
    baseColor?: { r: number; g: number; b: number, a: number },
    foamColor?: { r: number; g: number; b: number, a: number },
    colorDiffusionCoeff: number = 0.01,
    foamReturnRate: number = 1.0
): FlipGas {
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
    const maxParticles = numX * numY * 2;

    // Create gas
    const gas = new FlipGas(
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


    // Setup grid cells for the tank boundaries
    const n = gas.fNumY;
    for (let i = 0; i < gas.fNumX; i++) {
        for (let j = 0; j < gas.fNumY; j++) {
            let s = 1.0; // Gas
            // Only left and right walls are solid; top and bottom are open for gas escape
            if (i === 0 || i === gas.fNumX - 1) {
                s = 0.0; // Solid
            }
            gas.s[i * n + j] = s;
        }
    }

    return gas;
}
