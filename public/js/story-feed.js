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

        // Mouse wheel support (desktop)
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (this.isNavigating) return;

            if (e.deltaY > 0) {
                this.nextCard();
            } else {
                this.prevCard();
            }
        }, { passive: false });
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
