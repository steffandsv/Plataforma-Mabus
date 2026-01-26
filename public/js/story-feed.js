
/**
 * DOPAMINE ENGINE v2 - JS CORE
 * Physics-Based Infinite Stream
 */

class PhysicsStream {
    constructor() {
        this.track = document.querySelector('.stream-track');
        this.cards = Array.from(document.querySelectorAll('.stream-card'));
        this.container = document.querySelector('.stream-container');

        if (!this.track || this.cards.length === 0) return;

        // Configuration
        this.gap = 40; // reduced gap
        this.cardWidth = 500; // base width matches CSS
        this.snapThreshold = 0.2; // 20% drag to snap
        this.springStiffness = 0.15;
        this.friction = 0.85;

        // State
        this.currentIndex = 0;
        this.targetX = 0;
        this.currentX = 0;
        this.velocity = 0;

        // Input State
        this.isDragging = false;
        this.startX = 0;
        this.lastX = 0;
        this.dragOffset = 0;

        this.init();
    }

    init() {
        // Initial Layout
        this.updateLayout();

        // Event Listeners
        this.bindEvents();

        // Animation Loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        // Keyboard Support
        this.bindKeyboard();

        console.log('🌌 Void Engine Initialized');
    }

    bindEvents() {
        // Mouse
        this.container.addEventListener('mousedown', e => this.startDrag(e.clientX));
        window.addEventListener('mousemove', e => this.drag(e.clientX));
        window.addEventListener('mouseup', () => this.endDrag());

        // Touch
        this.container.addEventListener('touchstart', e => this.startDrag(e.touches[0].clientX), { passive: false });
        window.addEventListener('touchmove', e => this.drag(e.touches[0].clientX), { passive: false });
        window.addEventListener('touchend', () => this.endDrag());
    }

    bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.next();
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.prev();
        });
    }

    startDrag(x) {
        this.isDragging = true;
        this.startX = x;
        this.lastX = x;
        this.velocity = 0;
        this.track.style.cursor = 'grabbing';
    }

    drag(x) {
        if (!this.isDragging) return;

        const delta = x - this.lastX;
        this.lastX = x;
        this.dragOffset += delta;

        // Direct manipulation
        this.targetX += delta;
    }

    endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.track.style.cursor = 'grab';

        // Snap Logic
        const cardFullWidth = this.cardWidth + this.gap;
        const movedCards = -this.targetX / cardFullWidth;
        const closestIndex = Math.round(movedCards);

        // Clamp index
        this.snapToIndex(Math.max(0, Math.min(closestIndex, this.cards.length - 1)));

        this.dragOffset = 0;
    }

    snapToIndex(index) {
        this.currentIndex = index;
        const cardFullWidth = this.cardWidth + this.gap;
        this.targetX = -index * cardFullWidth;

        // View logging
        this.logView(this.cards[index]);
    }

    next() {
        if (this.currentIndex < this.cards.length - 1) {
            this.snapToIndex(this.currentIndex + 1);
        }
    }

    prev() {
        if (this.currentIndex > 0) {
            this.snapToIndex(this.currentIndex - 1);
        }
    }

    animate() {
        // Physics Intergration (Spring)
        const force = (this.targetX - this.currentX) * this.springStiffness;
        this.velocity += force;
        this.velocity *= this.friction;
        this.currentX += this.velocity;

        // Apply Transform to Track center
        // We center the active card. 
        // Screen Center = 0. Since track starts at center (left:50%), we move it.
        // Actually, let's keep it simple: Track moves left/right.
        // CSS centers the clicked item if we offset correctly.

        // Because CSS defines cards at absolute 50% 50%, 
        // moving the track moves everything relative to center.

        this.updateCards();

        requestAnimationFrame(this.animate);
    }

    updateCards() {
        const center = window.innerWidth / 2;
        const cardFullWidth = this.cardWidth + this.gap;

        // Visual Logic: Logarithmic Scale
        // We iterate through cards and define their style based on distance from "Center Focus"
        // The "Center Focus" virtual position is -this.currentX

        this.cards.forEach((card, index) => {
            // Un-transform first to get raw position relative to track
            // Base position: index * stride
            const basePos = index * (this.cardWidth * 0.15); // Stacking them closer like a deck?

            // Wait, "Infinite Stream" usually means they are side-by-side but with depth.
            // Let's stick to the visual plan:
            // Active is flat.
            // Right ones are curved away.
            // Left ones are gone.

            // Interaction: 1:1 drag affects the "progress"
            // Progress = -this.currentX / cardFullWidth? 
            // Let's use a simpler model: standard slider but with z-index/scale hacks.

            const progress = (this.currentX / cardFullWidth) + index;
            // If index is active (0), and currentX is 0, progress = 0.
            // If we drag left (currentX negative), progress decreases.

            // We need a precise offset for the track.
            // Let's move the cards individually based on global progress?
            // No, move track, animate items relative.

            // Re-think: "Parabolic Flow"
            // We only set the Track properties here? No, each card needs unique 3D transform.

            const relativePos = index * cardFullWidth + this.currentX; // Distance from center of screen (px)

            // 0 means center.
            // Positive means right.
            // Negative means left.

            let scale = 1;
            let opacity = 1;
            let x = relativePos;
            let z = 0;
            let rotateY = 0;
            let blur = 0;

            const maxDist = 1200;

            if (relativePos > 0) {
                // To the right (Upcoming)
                const ratio = Math.min(relativePos / maxDist, 1);
                // Logarithmic curve for stacking
                // Instead of linear X, we pull them tighter
                x = Math.pow(ratio, 0.7) * maxDist * 0.8;
                z = -ratio * 500;
                scale = 1 - (ratio * 0.5);
                opacity = 1 - (ratio * 0.8);
                rotateY = -15 * ratio;
                blur = ratio * 10;
            } else if (relativePos < 0) {
                // To the left (Past) - Exit quickly
                scale = 1 + (relativePos / 1000); // shrink
                opacity = 1 + (relativePos / 500); // fade fast
                x = relativePos * 1.5; // move faster
                rotateY = 25;
            }

            // Apply style directly
            card.style.transform = `translate3d(${x}px, -50%, ${z}px) scale(${scale}) rotateY(${rotateY}deg)`;
            card.style.opacity = Math.max(0, opacity);
            card.style.filter = `blur(${blur}px)`;
            card.style.zIndex = Math.round(100 - Math.abs(index - (-this.currentX / cardFullWidth)));
        });
    }

    updateLayout() {
        // Adjust for mobile
        if (window.innerWidth < 768) {
            this.cardWidth = window.innerWidth * 0.85;
        }
    }

    logView(card) {
        if (!card) return;
        const id = card.dataset.id;
        if (id) {
            clearTimeout(this.logTimer);
            this.logTimer = setTimeout(() => {
                // fetch(`/api/${id}/view`...)
                console.log('View logged:', id);
            }, 2000);
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.voidStream = new PhysicsStream();
});

// External Actions
function skipCard() { window.voidStream?.next(); }
