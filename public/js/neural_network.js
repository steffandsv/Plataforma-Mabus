class NeuralLoader {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Configuration
        this.particleCount = 100;
        this.connectionDistance = 100;
        this.rotationSpeed = 0.002;
        this.baseRadius = 120;
        
        // Brand Colors
        this.colors = {
            nodes: 'rgba(255, 255, 255, 0.8)',      // White nodes
            lines: 'rgba(121, 40, 202, 0.4)',      // Purple lines
            accent: 'rgba(255, 77, 77, 0.8)'       // Red accents
        };

        this.points = [];
        this.initGlobe();
        this.animate();
    }

    resize() {
        if(!this.canvas) return;
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = 400; // Taller for 3D effect
        this.w = this.canvas.width;
        this.h = this.canvas.height;
        this.cx = this.w / 2;
        this.cy = this.h / 2;
    }

    initGlobe() {
        this.points = [];
        for(let i=0; i<this.particleCount; i++) {
            // Fibonacci Sphere distribution for even spread
            const phi = Math.acos(1 - 2 * (i + 0.5) / this.particleCount);
            const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
            
            const x = this.baseRadius * Math.sin(phi) * Math.cos(theta);
            const y = this.baseRadius * Math.sin(phi) * Math.sin(theta);
            const z = this.baseRadius * Math.cos(phi);
            
            this.points.push({ 
                x, y, z, 
                ox: x, oy: y, oz: z, // Original positions
                pulse: Math.random() * Math.PI 
            });
        }
    }

    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        this.points.forEach(p => {
            // Rotate Y
            const x1 = p.x * cos - p.z * sin;
            const z1 = p.z * cos + p.x * sin;
            
            // Rotate X (tilted axis)
            const y2 = p.y * cos - z1 * sin;
            const z2 = z1 * cos + p.y * sin;

            p.x = x1;
            p.y = y2;
            p.z = z2;
        });
    }

    animate() {
        if(!this.ctx) return;
        this.ctx.clearRect(0, 0, this.w, this.h);
        
        this.rotate(this.rotationSpeed);

        // Sort points by Z for depth sorting (simple painter's algorithm)
        this.points.sort((a, b) => b.z - a.z);

        // Draw connections first (behind nodes)
        this.ctx.lineWidth = 0.8;
        for (let i = 0; i < this.points.length; i++) {
            for (let j = i + 1; j < this.points.length; j++) {
                const p1 = this.points[i];
                const p2 = this.points[j];
                
                // Euclidean distance in 3D
                const d = Math.sqrt(
                    (p1.x - p2.x)**2 + 
                    (p1.y - p2.y)**2 + 
                    (p1.z - p2.z)**2
                );

                if (d < this.connectionDistance) {
                    const alpha = 1 - (d / this.connectionDistance);
                    // Depth cueing: fade out lines at the back
                    const depthAlpha = (p1.z + this.baseRadius) / (2 * this.baseRadius); 
                    
                    this.ctx.strokeStyle = `rgba(121, 40, 202, ${alpha * depthAlpha * 0.6})`;
                    this.ctx.beginPath();
                    // Project 3D to 2D
                    const scale1 = 300 / (300 - p1.z); // Perspective projection
                    const scale2 = 300 / (300 - p2.z);
                    
                    this.ctx.moveTo(this.cx + p1.x * scale1, this.cy + p1.y * scale1);
                    this.ctx.lineTo(this.cx + p2.x * scale2, this.cy + p2.y * scale2);
                    this.ctx.stroke();
                }
            }
        }

        // Draw Nodes
        this.points.forEach(p => {
            const scale = 300 / (300 - p.z);
            const x2d = this.cx + p.x * scale;
            const y2d = this.cy + p.y * scale;
            
            // Pulsing effect
            p.pulse += 0.05;
            const size = (2 + Math.sin(p.pulse)) * scale;
            
            // Depth opacity
            const alpha = ((p.z + this.baseRadius) / (2 * this.baseRadius)) * 0.8 + 0.2;

            this.ctx.fillStyle = this.colors.nodes;
            if(Math.random() > 0.98) this.ctx.fillStyle = this.colors.accent; // Occasional red flash

            this.ctx.globalAlpha = alpha;
            this.ctx.beginPath();
            this.ctx.arc(x2d, y2d, size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.globalAlpha = 1;
        this.frameId = requestAnimationFrame(() => this.animate());
    }
}
