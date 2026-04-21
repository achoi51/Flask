export class Element {
    private name: string; 
    private density: number;
    private imageSrc: string;
    private width: number;
    private height: number;
    private x: number;
    private y: number;
    private vx: number;
    private vy: number;

    public constructor(
        name: string,
        density: number,
        imageSrc: string,
        width: number,
        height: number,
        x: number,
        y: number,
    ) {
        this.name = name;
        this.density = density;
        this.imageSrc = imageSrc;
        this.width = width;
        this.height = height;
        this.x = x;
        this.y = y;
        this.vx = 0.0;
        this.vy = 0.0;
    }

    public getName(): string {
        return this.name;
    }

    public getDensity(): number {
        return this.density;
    }

    public getImageSrc(): string {
        return this.imageSrc;
    }

    public setImageSrc(imageSrc: string): void {
        this.imageSrc = imageSrc;
    }

    public getWidth(): number {
        return this.width;
    }

    public getHeight(): number {
        return this.height;
    }

    public getX(): number {
        return this.x;
    }

    public getY(): number {
        return this.y;
    }

    public step(dt: number, gravityX: number, gravityY: number, damping = 0.995): void {
        this.vx += gravityX * dt;
        this.vy += gravityY * dt;

        this.vx *= damping;
        this.vy *= damping;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    public confineToBounds(minX: number, maxX: number, minY: number, maxY: number): void {
        if (this.x < minX) {
            this.x = minX;
            this.vx = 0.0;
        }
        if (this.x > maxX) {
            this.x = maxX;
            this.vx = 0.0;
        }
        if (this.y < minY) {
            this.y = minY;
            this.vy = 0.0;
        }
        if (this.y > maxY) {
            this.y = maxY;
            this.vy = 0.0;
        }
    }

}