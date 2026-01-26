
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

        // Configuration - Tuned for 2D Performance
        this.gap = 20;
        this.cardWidth = 480; // Matches CSS
        this.snapThreshold = 0.2;
        this.springStiffness = 0.12; // Softer spring
        this.friction = 0.88; // More glide

        // Mobile adjustment
        if (window.innerWidth < 768) {
            this.cardWidth = window.innerWidth * 0.90;
        }

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
        this.bindEvents();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
        this.bindKeyboard();

        // Initial snap
        this.snapToIndex(0);

        console.log('🌌 Void Engine (2D Fan) Initialized');
    }

    bindEvents() {
        // Mouse
        this.container.addEventListener('mousedown', e => this.startDrag(e.clientX));
        window.addEventListener('mousemove', e => this.drag(e.clientX));
        window.addEventListener('mouseup', () => this.endDrag());
        window.addEventListener('mouseleave', () => this.endDrag());

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
        this.velocity = 0; // Stop momentum on grab
        this.track.style.cursor = 'grabbing';
    }

    drag(x) {
        if (!this.isDragging) return;

        const delta = x - this.lastX;
        this.lastX = x;
        this.dragOffset += delta;
        this.targetX += delta;
    }

    endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.track.style.cursor = 'grab';

        // Snap Logic
        const cardFullWidth = this.cardWidth + this.gap;
        // Determine closest index based on negative targetX (since moving left decreases X)
        const rawIndex = -this.targetX / cardFullWidth;
        let closestIndex = Math.round(rawIndex);

        // Add directional intent if drag was significant
        if (Math.abs(this.dragOffset) > 50) {
            if (this.dragOffset < 0) closestIndex = Math.ceil(rawIndex); // Dragging left -> Next
            else closestIndex = Math.floor(rawIndex); // Dragging right -> Prev
        }

        // Clamp index
        this.snapToIndex(Math.max(0, Math.min(closestIndex, this.cards.length - 1)));
        this.dragOffset = 0;
    }

    snapToIndex(index) {
        this.currentIndex = index;
        const cardFullWidth = this.cardWidth + this.gap;
        this.targetX = -index * cardFullWidth;
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
        // Physics Integration (Spring)
        // F = -k * (x - target) - c * v
        const displacement = this.targetX - this.currentX;
        const force = displacement * this.springStiffness;

        this.velocity += force;
        this.velocity *= this.friction;
        this.currentX += this.velocity;

        // Stop micro-movements
        if (Math.abs(displacement) < 0.1 && Math.abs(this.velocity) < 0.1) {
            this.currentX = this.targetX;
            this.velocity = 0;
        }

        this.updateCards();
        requestAnimationFrame(this.animate);
    }

    updateCards() {
        const cardFullWidth = this.cardWidth + this.gap;

        this.cards.forEach((card, index) => {
            // Position relative to the "virtual camera" (currentX)
            // relativePos is 0 when the card is centered
            const cardPos = index * cardFullWidth;
            const relativePos = cardPos + this.currentX;

            // 2D Fan Logic
            // Active card (relativePos ~ 0) is scale 1, opacity 1
            // Cards to the right (relativePos > 0) are scaled down, fanned out
            // Cards to the left (relativePos < 0) fade out quickly

            let x = relativePos;
            let scale = 1;
            let opacity = 1;
            let zIndex = 100 - Math.abs(index - this.currentIndex);

            // Normalize distance for effect calculation
            const distRatio = relativePos / window.innerWidth;

            if (relativePos > 0) {
                // Upcoming (Right side)
                // "Fan" effect: compress X space to show stack
                // x = actual pixels * compression
                x = relativePos * 0.4; // Strong overlap

                // Scale down progressively
                scale = Math.max(0.8, 1 - (distRatio * 0.5));

                // Fade out
                opacity = Math.max(0.5, 1 - (distRatio * 0.8));

            } else if (relativePos < 0) {
                // Past (Left side) - Stack visible on left
                x = relativePos * 0.4;
                scale = Math.max(0.8, 1 - (Math.abs(distRatio) * 0.5));
                opacity = Math.max(0.5, 1 - (Math.abs(distRatio) * 0.8));
            }

            // Apply 2D transforms - Key Fix: translateX(-50%) to center the element on its origin x
            // Using translate3d for hardware acceleration, but with Z=0 (or effectively 0 context)
            card.style.transform = `translate3d(${x}px, -50%, 0) translateX(-50%) scale(${scale})`;
            card.style.opacity = opacity;
            card.style.zIndex = zIndex;

            // Performance optimization: hide off-screen cards completely
            card.style.visibility = (opacity < 0.05) ? 'hidden' : 'visible';
        });
    }

    logView(card) {
        if (!card) return;
        const id = card.dataset.id;
        if (id) {
            clearTimeout(this.logTimer);
            this.logTimer = setTimeout(() => {
                fetch(`/api/licitacoes/${id}/view`, { method: 'POST' }).catch(() => { });
            }, 1000);
        }
    }
}

// Global Modal Functions
window.openDescriptionModal = function (id) {
    const fullText = document.getElementById(`full-desc-${id}`)?.value;
    const modal = document.getElementById('desc_modal');
    const content = document.getElementById('desc_modal_content');

    if (fullText && modal && content) {
        content.innerText = fullText;
        modal.showModal();
    }
};

window.openItemsModal = async function (id) {
    const modal = document.getElementById('items_modal');
    const content = document.getElementById('items_modal_content');

    if (!modal || !content) return;

    modal.showModal();
    content.innerHTML = `
        <div class="flex flex-col items-center justify-center h-40">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <span class="mt-4 text-white/50">Carregando itens...</span>
        </div>
    `;

    try {
        const response = await fetch(`/api/licitacoes/${id}/items`);
        const data = await response.json();

        if (data.success && data.items.length > 0) {
            let rows = data.items.map(item => `
                <tr class="hover:bg-white/5 border-b border-white/5 text-sm">
                    <td class="px-4 py-3 font-mono text-xs opacity-70">${item.numero_item}</td>
                    <td class="px-4 py-3 font-medium opacity-90">${item.descricao || 'Sem descrição'}</td>
                    <td class="px-4 py-3 text-right whitespace-nowrap opacity-80">${item.quantidade} <span class="text-xs opacity-50">un</span></td>
                    <td class="px-4 py-3 text-right whitespace-nowrap opacity-80">R$ ${(item.valor_unitario_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td class="px-4 py-3 text-right whitespace-nowrap font-bold text-emerald-400">R$ ${(item.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
            `).join('');

            content.innerHTML = `
                <div class="overflow-x-auto">
                    <table class="table w-full">
                        <thead class="text-xs uppercase bg-black/20 text-white/40 sticky top-0 back-glass">
                            <tr>
                                <th class="px-4 py-3">#</th>
                                <th class="px-4 py-3">Descrição</th>
                                <th class="px-4 py-3 text-right">Qtd</th>
                                <th class="px-4 py-3 text-right">Unit.</th>
                                <th class="px-4 py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="flex flex-col items-center justify-center h-40 opacity-50">
                    <i class="fas fa-box-open text-4xl mb-4"></i>
                    <p>Nenhum item encontrado.</p>
                </div>
            `;
        }
    } catch (e) {
        content.innerHTML = `
            <div class="flex flex-col items-center justify-center h-40 text-red-400">
                <i class="fas fa-exclamation-triangle text-3xl mb-2"></i>
                <p>Erro ao carregar itens.</p>
            </div>
        `;
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.voidStream = new PhysicsStream();
});

// External Actions
function skipCard() { window.voidStream?.next(); }
