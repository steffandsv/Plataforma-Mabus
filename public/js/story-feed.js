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
        this.truncateObjectDescriptions();
        this.highlightKeywords();
        this.showCard(0);
        this.hideHintsAfterDelay();

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.truncateObjectDescriptions(), 200);
        });
    }

    truncateObjectDescriptions() {
        this.cards.forEach(card => {
            const p = card.querySelector('.object-preview p');
            if (!p) return;

            const originalText = p.dataset.fullText;
            if (!originalText) return;

            // Use temp element to measure line height
            p.innerHTML = 'A';
            const lineHeight = p.clientHeight;
            const maxHeight = lineHeight * 2; // Target: 2 lines

            // Restore text
            p.innerHTML = escapeHtml(originalText);

            if (p.clientHeight > maxHeight + 5) { // +5 tolerance
                let low = 0;
                let high = originalText.length;
                let bestFit = 0;
                const ellipsis = '... ';
                const moreLink = `<a href="#" class="text-primary hover:text-primary/80 font-medium hover:underline inline-block ml-1" onclick="event.preventDefault(); openObjetoModal('${card.getAttribute('data-index')}')">Ver mais</a>`;

                // Binary search for optimal length
                while (low <= high) {
                    const mid = Math.floor((low + high) / 2);
                    p.innerHTML = escapeHtml(originalText.slice(0, mid)) + ellipsis + moreLink;

                    if (p.clientHeight <= maxHeight + 5) {
                        bestFit = mid;
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                }

                // Apply best fit
                p.innerHTML = escapeHtml(originalText.slice(0, bestFit)) + ellipsis + moreLink;
            }
        });
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
            // Ignore if modal is open
            if (document.getElementById('itemsModal').style.display === 'flex' ||
                document.getElementById('objetoModal').style.display === 'flex') {
                if (e.key === 'Escape') {
                    closeItemsModal();
                    closeObjetoModal();
                }
                return;
            }

            if (this.isNavigating) return;

            const key = e.key.toLowerCase();

            switch (key) {
                case 'arrowdown':
                case 'arrowright':
                case 'pagedown':
                    e.preventDefault();
                    this.nextCard();
                    break;
                case 'arrowup':
                case 'arrowleft':
                case 'pageup':
                    e.preventDefault();
                    this.prevCard();
                    break;
                case 'home':
                    e.preventDefault();
                    this.showCard(0);
                    break;
                case 'end':
                    e.preventDefault();
                    this.showCard(this.totalCards - 1);
                    break;
                case 's':
                    if (typeof saveOpportunity === 'function') {
                        const currentId = this.getCurrentCardId();
                        if (currentId) {
                            saveOpportunity(currentId);
                            this.showKeyFeedback('S', 'Salvo!');
                            setTimeout(() => this.nextCard(), 800); // Auto advances
                        }
                    }
                    break;
                case 'p':
                    if (typeof skipCardWithAPI === 'function') {
                        skipCardWithAPI();
                        this.showKeyFeedback('P', 'Pulado');
                    }
                    break;
                case 'd':
                    const currentId = this.getCurrentCardId();
                    if (currentId && typeof openDetailsModal === 'function') {
                        openDetailsModal(currentId);
                    } else if (currentId) {
                        // Fallback to link navigation if modal not ready
                        window.location.href = `/licitacoes/${currentId}`;
                    }
                    break;
            }
        });
    }

    getCurrentCardId() {
        if (this.currentIndex >= 0 && this.currentIndex < this.cards.length) {
            return this.cards[this.currentIndex].getAttribute('data-id');
        }
        return null;
    }

    showKeyFeedback(key, message) {
        // Visual feedback for keyboard actions
        const feedback = document.createElement('div');
        feedback.className = 'key-feedback';
        feedback.innerHTML = `<span class="key">${key.toUpperCase()}</span> ${message}`;
        document.body.appendChild(feedback);

        setTimeout(() => feedback.classList.add('show'), 10);
        setTimeout(() => {
            feedback.classList.remove('show');
            setTimeout(() => feedback.remove(), 300);
        }, 1000);
    }

    hideHintsAfterDelay() {
        setTimeout(() => {
            const hints = document.querySelectorAll('.keyboard-hints');
            hints.forEach(hint => hint.style.opacity = '0');
        }, 5000); // Fade out after 5s
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

                // Log view via API
                const id = card.getAttribute('data-id');
                if (id) {
                    // Debounce view logging (only if viewed for > 2s)
                    clearTimeout(this.viewTimer);
                    this.viewTimer = setTimeout(() => {
                        fetch(`/api/licitacoes/${id}/view`, { method: 'POST' }).catch(console.error);
                    }, 2000);
                }
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



/* ============================================
   GLOBAL API ACTIONS (Called by HTML & Shortcuts)
   ============================================ */

window.storyFeedEngine = null;
document.addEventListener('DOMContentLoaded', () => {
    window.storyFeedEngine = new StoryFeedEngine();
});

// Skip Action
window.skipCardWithAPI = function () {
    if (!window.storyFeedEngine) return;

    const id = window.storyFeedEngine.getCurrentCardId();
    if (!id) return;

    // Optimistic UI update
    window.storyFeedEngine.nextCard();

    // Call API in background
    fetch(`/api/licitacoes/${id}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).catch(err => console.error('Error skipping:', err));
};

// Save Action
window.saveOpportunity = async function (id) {
    if (!id) return;

    const btn = document.querySelector(`.story-card[data-id="${id}"] .save-btn-external`);
    if (btn) btn.classList.add('loading');

    try {
        const response = await fetch(`/api/licitacoes/${id}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Show success via Engine feedback if available
            if (window.storyFeedEngine) {
                window.storyFeedEngine.showKeyFeedback('S', 'Salvo!');
            }
            // Auto advance after short delay
            setTimeout(() => {
                if (window.storyFeedEngine) window.storyFeedEngine.nextCard();
            }, 800);
        }
    } catch (error) {
        console.error('Error saving:', error);
    } finally {
        if (btn) btn.classList.remove('loading');
    }
};

// Details Modal (Overlay)
window.openDetailsModal = function (id) {
    // For now, redirect to details page as modal implementation would require 
    // fetching entire partial view or specific API endpoint rendering HTML
    window.location.href = `/licitacoes/${id}`;
};

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
