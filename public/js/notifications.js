document.addEventListener('DOMContentLoaded', () => {
    initNotifications();
});

function initNotifications() {
    const bellBtn = document.getElementById('bellBtn');
    const badge = document.getElementById('bellBadge');
    const dropdown = document.getElementById('notificationDropdown');
    const list = document.getElementById('notificationList');

    if (!bellBtn) return; // Not logged in

    // 1. Poll for unread count
    fetchNotifications();
    setInterval(fetchNotifications, 30000); // Every 30s

    // 2. Toggle Dropdown
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            renderNotifications();
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    async function fetchNotifications() {
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const notes = await res.json();
                window.unreadNotifications = notes; // Local cache
                updateBadge(notes.length);
            }
        } catch (e) {
            console.error("Notify poll error", e);
        }
    }

    function updateBadge(count) {
        if (count > 0) {
            badge.innerText = count > 9 ? '9+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    function renderNotifications() {
        const notes = window.unreadNotifications || [];
        list.innerHTML = '';
        
        if (notes.length === 0) {
            list.innerHTML = '<div class="p-4 text-center opacity-50 text-sm">Nenhuma notificação nova.</div>';
            return;
        }

        notes.forEach(n => {
            const item = document.createElement('div');
            item.className = 'p-3 border-b border-base-300 hover:bg-base-200 cursor-pointer transition-colors';
            item.innerHTML = `
                <div class="font-bold text-sm text-primary mb-1">${n.title}</div>
                <div class="text-xs opacity-70 mb-2 line-clamp-2">${n.message}</div>
                <div class="text-[10px] uppercase font-mono opacity-50 text-right">${new Date(n.created_at).toLocaleTimeString()}</div>
            `;
            item.onclick = async () => {
                // Mark read
                await fetch(`/api/notifications/read/${n.id}`, { method: 'POST' });
                // Navigate
                if (n.link) window.location.href = n.link;
                else fetchNotifications(); // Refresh if no link
            };
            list.appendChild(item);
        });
    }
}

// Global function to request permission (called by Oracle)
window.requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
        alert("Este navegador não suporta notificações de sistema.");
        return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        new Notification("Mabus Protocol", {
             body: "Notificações ativas! Você será avisado quando a análise terminar.",
             icon: "/favicon.ico"
        });
        return true;
    }
    return false;
};
