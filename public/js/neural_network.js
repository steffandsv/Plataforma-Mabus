class NeuralLoader {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        window.addEventListener('resize', () => this.resize());

        this.points = [];
        this.phase = 'NETWORK'; // NETWORK, ZOOM, SQUARE, EXPLODE, CIRCLE
        this.phaseTime = 0;
        
        // Colors from user request
        this.colors = {
            white: '#FFFFFF',
            gray: '#888888',
            purple: '#7928CA',
            red: '#FF4D4D'
        };

        this.zoomTarget = null;
        this.zoomLevel = 1;
        this.particles = [];
        this.circleProgress = 0;
        
        this.initNetwork();
        this.frameId = requestAnimationFrame(() => this.animate());
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = 300; // Fixed height for loader
        this.w = this.canvas.width;
        this.h = this.canvas.height;
    }

    initNetwork() {
        this.points = [];
        for(let i=0; i<30; i++) {
            this.points.push({
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5
            });
        }
        this.phase = 'NETWORK';
        this.phaseTime = 0;
        this.zoomLevel = 1;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.w, this.h);
        this.phaseTime++;

        switch(this.phase) {
            case 'NETWORK':
                this.drawNetwork();
                if(this.phaseTime > 180) { // 3 seconds
                    this.phase = 'ZOOM';
                    this.phaseTime = 0;
                    // Pick a point near center
                    const center = {x: this.w/2, y: this.h/2};
                    this.zoomTarget = this.points.reduce((prev, curr) => {
                        const dPrev = Math.hypot(prev.x - center.x, prev.y - center.y);
                        const dCurr = Math.hypot(curr.x - center.x, curr.y - center.y);
                        return dCurr < dPrev ? curr : prev;
                    });
                }
                break;
            case 'ZOOM':
                this.drawZoom();
                if(this.zoomLevel > 15) {
                    this.phase = 'SQUARE';
                    this.phaseTime = 0;
                }
                break;
            case 'SQUARE':
                this.drawSquare();
                if(this.phaseTime > 60) {
                    this.phase = 'EXPLODE';
                    this.phaseTime = 0;
                    this.initExplosion();
                }
                break;
            case 'EXPLODE':
                this.drawExplosion();
                if(this.phaseTime > 100) {
                    this.phase = 'CIRCLE';
                    this.phaseTime = 0;
                }
                break;
            case 'CIRCLE':
                this.drawCircle();
                if(this.phaseTime > 120) {
                    this.initNetwork();
                }
                break;
        }

        this.frameId = requestAnimationFrame(() => this.animate());
    }

    drawNetwork() {
        this.ctx.fillStyle = this.colors.white;
        this.ctx.strokeStyle = this.colors.purple;
        
        // Update points
        this.points.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if(p.x < 0 || p.x > this.w) p.vx *= -1;
            if(p.y < 0 || p.y > this.h) p.vy *= -1;
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
            this.ctx.fill();
        });

        // Draw connections
        this.ctx.lineWidth = 0.5;
        for(let i=0; i<this.points.length; i++) {
            for(let j=i+1; j<this.points.length; j++) {
                const d = Math.hypot(this.points[i].x - this.points[j].x, this.points[i].y - this.points[j].y);
                if(d < 100) {
                    this.ctx.globalAlpha = 1 - (d/100);
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.points[i].x, this.points[i].y);
                    this.ctx.lineTo(this.points[j].x, this.points[j].y);
                    this.ctx.stroke();
                }
            }
        }
        this.ctx.globalAlpha = 1;
    }

    drawZoom() {
        // Zoom functionality: Translate context to center of target, scale, then draw network
        this.zoomLevel *= 1.05;
        
        this.ctx.save();
        this.ctx.translate(this.w/2, this.h/2);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.translate(-this.zoomTarget.x, -this.zoomTarget.y);
        
        this.drawNetwork();
        
        this.ctx.restore();
    }

    drawSquare() {
        // Draw the "Target Point" transforming into a square
        const cx = this.w/2;
        const cy = this.h/2;
        const size = 60 + Math.sin(this.phaseTime * 0.1) * 5;
        
        this.ctx.strokeStyle = this.colors.purple;
        this.ctx.lineWidth = 4;
        this.ctx.fillStyle = 'rgba(121, 40, 202, 0.2)';
        
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(this.phaseTime * 0.05);
        this.ctx.beginPath();
        this.ctx.rect(-size/2, -size/2, size, size);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }

    initExplosion() {
        this.particles = [];
        const cx = this.w/2;
        const cy = this.h/2;
        for(let i=0; i<20; i++) {
            this.particles.push({
                x: cx + (Math.random()-0.5)*40,
                y: cy + (Math.random()-0.5)*40,
                vx: (Math.random()-0.5)*10,
                vy: (Math.random()-0.5)*10,
                size: Math.random()*20 + 5,
                color: Math.random() > 0.5 ? this.colors.purple : this.colors.red
            });
        }
    }

    drawExplosion() {
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95; // friction
            p.vy *= 0.95;
            
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        
        // Find one particle to become center circle
        const centerP = this.particles[0];
        if(centerP) {
             // Slowly move it to center
             centerP.x += (this.w/2 - centerP.x) * 0.1;
             centerP.y += (this.h/2 - centerP.y) * 0.1;
        }
    }

    drawCircle() {
        const cx = this.w/2;
        const cy = this.h/2;
        
        this.ctx.strokeStyle = this.colors.red;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 30, 0, Math.PI * 2 * (this.phaseTime / 80));
        this.ctx.stroke();

        // Rays connecting to invisible points outside
        if (this.phaseTime > 40) {
             this.ctx.strokeStyle = this.colors.gray;
             this.ctx.lineWidth = 1;
             const rays = 8;
             for(let i=0; i<rays; i++) {
                 const angle = (Math.PI*2 / rays) * i + (this.phaseTime*0.02);
                 const r = 30 + (this.phaseTime-40) * 5;
                 this.ctx.beginPath();
                 this.ctx.moveTo(cx + Math.cos(angle)*30, cy + Math.sin(angle)*30);
                 this.ctx.lineTo(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r);
                 this.ctx.stroke();
             }
        }
    }
}
