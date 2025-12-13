// Sistema de notificaciones
const Notifications = {
    show(message, type = 'success') {
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transform = 'translateX(500px)';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }
};
