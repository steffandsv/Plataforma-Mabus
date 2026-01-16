// Story Feed Navigation Engine
// Dopaminergic Engagement System

class StoryFeedEngine {
    constructor() {
        this.currentIndex = 0;
        this.cards = document.querySelectorAll('.story-card');
        this.totalCards = this.cards.length;
        this.touchStartY = 0;
        this.touchEndY = 0;
        this.isNavigating = false;

        this.init();
    }

    init() {
        if (this.totalCards === 0) return;

        this.setupSwipeListeners();
        this.setupKeyboardNavigation();
        this.highlightKeywords();
        this.showCard(0);
        this.hideHintsAfterDelay();
    }

    setupSwipeListeners() {
        const container = document.querySelector('.story-feed-container');
        if (!container) return;

        container.addEventListener('touchstart', (e) => {
            this.touchStartY = e.touches[0].clientY;
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            this.touchEndY = e.touches[0].clientY;
        }, { passive: true });

        container.addEventListener('touchend', () => {
            this.handleSwipe();
        });


    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (this.isNavigating) return;

            if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') {
                e.preventDefault();
                this.nextCard();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                this.prevCard();
            } else if (e.key === 'Home') {
                e.preventDefault();
                this.showCard(0);
            } else if (e.key === 'End') {
                e.preventDefault();
                this.showCard(this.totalCards - 1);
            }
        });
    }

    handleSwipe() {
        const swipeDistance = this.touchStartY - this.touchEndY;
        const threshold = 50;

        if (Math.abs(swipeDistance) > threshold && !this.isNavigating) {
            if (swipeDistance > 0) {
                this.nextCard(); // Swipe up
            } else {
                this.prevCard(); // Swipe down
            }
        }
    }

    showCard(index) {
        if (index < 0 || index >= this.totalCards) return;

        this.isNavigating = true;

        this.cards.forEach((card, i) => {
            card.classList.remove('active', 'prev', 'next');

            if (i === index) {
                card.classList.add('active');
                this.animateCardReveal(card);
            } else if (i < index) {
                card.classList.add('prev');
            } else {
                card.classList.add('next');
            }
        });

        this.currentIndex = index;

        // Reset navigation lock
        setTimeout(() => {
            this.isNavigating = false;
        }, 600);
    }

    animateCardReveal(card) {
        // Progressive reveal of information elements
        const elements = card.querySelectorAll('.story-card-header, .value-spotlight, .object-description, .info-pills, .story-actions');

        elements.forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';

            setTimeout(() => {
                el.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, i * 100);
        });
    }

    nextCard() {
        if (this.isNavigating) return;

        if (this.currentIndex < this.totalCards - 1) {
            this.showCard(this.currentIndex + 1);
        } else {
            this.showEndOfFeed();
        }
    }

    prevCard() {
        if (this.isNavigating) return;

        if (this.currentIndex > 0) {
            this.showCard(this.currentIndex - 1);
        }
    }

    highlightKeywords() {
        this.cards.forEach(card => {
            const description = card.querySelector('.object-description p[data-keywords]');
            if (!description) return;

            const keywords = description.dataset.keywords;
            if (!keywords || keywords.trim() === '') return;

            const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k);
            let html = description.innerHTML; // Use innerHTML to preserve existing tags

            keywordArray.forEach(keyword => {
                // Case-insensitive replacement with word boundaries
                const regex = new RegExp(`\\b(${this.escapeRegExp(keyword)})\\b`, 'gi');
                html = html.replace(regex, '<span class="keyword-highlight">$1</span>');
            });

            description.innerHTML = html;
        });
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    hideHintsAfterDelay() {
        const hints = document.getElementById('swipe-hints');
        if (hints) {
            setTimeout(() => {
                hints.style.display = 'none';
            }, 4000);
        }
    }

    showEndOfFeed() {
        // Show completion toast
        if (typeof showToast === 'function') {
            showToast('🎉 Você viu todas as oportunidades! Ajuste os filtros para mais resultados.', 'info');
        }
    }
}

// Initialize on page load
let storyFeed;
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.story-feed-container');
    if (container && container.querySelector('.story-card')) {
        storyFeed = new StoryFeedEngine();
    }
});

// Global Actions for Story Feed
function skipCard() {
    if (storyFeed) {
        storyFeed.nextCard();
    }
}

/* ============================================
   ITEMS MODAL CONTROLLER
   ============================================ */

const itemsCache = new Map();
let currentModalLicitacaoId = null;

async function openItemsModal(licitacaoId) {
    currentModalLicitacaoId = licitacaoId;
    const modal = document.getElementById('itemsModal');
    const modalBody = modal.querySelector('.items-modal-body');

    // Show modal
    modal.style.display = 'flex';

    // Check cache
    if (itemsCache.has(licitacaoId)) {
        renderModalItems(modalBody, itemsCache.get(licitacaoId));
        return;
    }

    // Show loading
    modalBody.innerHTML = `
        <div class="loading-items">
            <i class="fas fa-spinner fa-spin"></i>
            Carregando itens...
        </div>
    `;

    // Fetch items
    try {
        const response = await fetch(`/api/licitacoes/${licitacaoId}/items`);
        if (!response.ok) throw new Error('Failed to fetch items');

        const data = await response.json();
        itemsCache.set(licitacaoId, data.items || []);
        renderModalItems(modalBody, data.items || []);
    } catch (error) {
        console.error('Error fetching items:', error);
        modalBody.innerHTML = `
            <div class="no-items-message">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #EF4444; opacity: 0.5; margin-bottom: 12px;"></i>
                <p>Erro ao carregar itens. Tente novamente.</p>
            </div>
        `;
    }
}

function closeItemsModal() {
    const modal = document.getElementById('itemsModal');
    modal.style.display = 'none';
    currentModalLicitacaoId = null;
}

function renderModalItems(container, items) {
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="no-items-message">
                <i class="fas fa-inbox" style="font-size: 48px; opacity: 0.3; margin-bottom: 12px;"></i>
                <p>Nenhum item encontrado para esta licitação.</p>
            </div>
        `;
        return;
    }

    const tableHTML = `
        <table class="items-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Descrição</th>
                    <th>Qtd</th>
                    <th>Valor Un.</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr>
                        <td class="item-number">${item.numero_item || '-'}</td>
                        <td class="item-description" title="${escapeHtml(item.descricao || 'N/D')}">
                            ${escapeHtml(truncate(item.descricao || 'N/D', 80))}
                        </td>
                        <td class="item-quantity">${formatNumber(item.quantidade)}</td>
                        <td class="item-value">${formatCurrency(item.valor_unitario_estimado)}</td>
                        <td class="item-value">${formatCurrency(item.valor_total)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = tableHTML;
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (currentModalLicitacaoId) {
            closeItemsModal();
        }
        if (currentObjetoIndex !== null) {
            closeObjetoModal();
        }
    }
});

/* ============================================
   OBJETO MODAL CONTROLLER
   ============================================ */

let currentObjetoIndex = null;

function openObjetoModal(cardIndex) {
    currentObjetoIndex = cardIndex;
    const modal = document.getElementById('objetoModal');
    const objetoElement = document.getElementById(`objeto-preview-${cardIndex}`);
    const fullText = objetoElement.dataset.fullText;

    const modalBody = document.getElementById('objetoFullText');
    modalBody.textContent = fullText;

    modal.style.display = 'flex';
}

function closeObjetoModal() {
    const modal = document.getElementById('objetoModal');
    modal.style.display = 'none';
    currentObjetoIndex = null;
}

// Helper functions
function formatCurrency(value) {
    if (!value || isNaN(value)) return 'R$ -';
    return 'R$ ' + parseFloat(value).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatNumber(value) {
    if (!value || isNaN(value)) return '-';
    return parseFloat(value).toLocaleString('pt-BR');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/* ============================================
   DEADLINE HUMANIZER - Temporal Psychology
   ============================================ */

function humanizeDeadline(deadlineStr, currentDate = new Date()) {
    const deadline = new Date(deadlineStr);
    const now = currentDate;

    // Calculate difference in milliseconds
    const diff = deadline - now;
    const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diff / (1000 * 60 * 60));

    // Urgency classification
    let urgency = 'safe';
    if (diffHours < 24) urgency = 'critical';
    else if (diffDays < 7) urgency = 'warning';

    // Day names in Portuguese
    const dayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const dayName = dayNames[deadline.getDay()];

    // Format time
    const hours = String(deadline.getHours()).padStart(2, '0');
    const minutes = String(deadline.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    // Format date
    const day = String(deadline.getDate()).padStart(2, '0');
    const month = String(deadline.getMonth() + 1).padStart(2, '0');
    const dateStr = `${day}/${month}`;

    let humanText = '';

    if (diffHours < 0) {
        humanText = 'Prazo encerrado';
        urgency = 'critical';
    } else if (diffHours < 24) {
        if (diffHours === 1) {
            humanText = `Daqui 1 hora (às ${timeStr})`;
        } else {
            humanText = `Daqui ${diffHours} horas (às ${timeStr})`;
        }
    } else if (diffDays === 1) {
        humanText = `Amanhã, ${dayName} (${dateStr}) às ${timeStr}`;
    } else if (diffDays <= 7) {
        humanText = `Daqui ${diffDays} dias, ${dayName} (${dateStr}) às ${timeStr}`;
    } else if (diffDays <= 14) {
        humanText = `Daqui ${diffDays} dias, ${dayName} que vem (${dateStr}) às ${timeStr}`;
    } else {
        humanText = `Daqui ${diffDays} dias (${dateStr}) às ${timeStr}`;
    }

    return { humanText, urgency };
}

function initializeDeadlines() {
    const deadlineBanners = document.querySelectorAll('.deadline-banner');
    const now = new Date();

    deadlineBanners.forEach(banner => {
        const deadlineTime = banner.querySelector('.deadline-time');
        const deadlineStr = deadlineTime.dataset.date;

        if (!deadlineStr) return;

        const { humanText, urgency } = humanizeDeadline(deadlineStr, now);

        deadlineTime.textContent = humanText;
        banner.setAttribute('data-urgency', urgency);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeDeadlines();
});
