// Main JavaScript file for Secure File Upload App

document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function(popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
});

// Toast notification utility
class ToastManager {
    constructor() {
        this.toastElement = document.getElementById('upload-toast');
        this.toast = new bootstrap.Toast(this.toastElement);
    }

    show(title, message, type = 'info') {
        const header = this.toastElement.querySelector('.toast-header');
        const body = this.toastElement.querySelector('.toast-body');

        // Update header based on type
        let icon = 'bi-info-circle';
        let headerClass = 'bg-light';

        switch (type) {
            case 'success':
                icon = 'bi-check-circle';
                headerClass = 'bg-success text-white';
                break;
            case 'error':
                icon = 'bi-x-circle';
                headerClass = 'bg-danger text-white';
                break;
            case 'warning':
                icon = 'bi-exclamation-triangle';
                headerClass = 'bg-warning text-dark';
                break;
            default:
                icon = 'bi-info-circle';
                headerClass = 'bg-info text-white';
        }

        // Reset classes
        header.className = `toast-header ${headerClass}`;

        // Update icon
        const iconElement = header.querySelector('i');
        iconElement.className = `${icon} me-2`;

        // Update title
        const titleElement = header.querySelector('strong');
        titleElement.textContent = title;

        // Update message
        body.innerHTML = message;

        // Show toast
        this.toast.show();
    }

    hide() {
        this.toast.hide();
    }
}

// Global toast manager instance
window.toastManager = new ToastManager();

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds) {
    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

function sanitizeHtml(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

// File validation
function validateFile(file) {
    const maxSize = 500 * 1024 * 1024; // 500MB

    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File size (${formatFileSize(file.size)}) exceeds maximum limit of 500MB`
        };
    }

    return { valid: true };
}

// Add some smooth transitions and animations
document.addEventListener('DOMContentLoaded', function() {
    // Smooth scroll to top functionality
    function smoothScrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    // Add scroll to top button if needed
    let scrollTopBtn = null;

    function handleScroll() {
        if (window.pageYOffset > 300) {
            if (!scrollTopBtn) {
                scrollTopBtn = document.createElement('button');
                scrollTopBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
                scrollTopBtn.className = 'btn btn-primary btn-sm position-fixed';
                scrollTopBtn.style.cssText = 'bottom: 20px; right: 20px; z-index: 1000; border-radius: 50%; width: 50px; height: 50px;';
                scrollTopBtn.setAttribute('title', 'Scroll to top');
                scrollTopBtn.addEventListener('click', smoothScrollToTop);
                document.body.appendChild(scrollTopBtn);

                // Animate in
                setTimeout(() => {
                    scrollTopBtn.style.opacity = '1';
                    scrollTopBtn.style.transform = 'scale(1)';
                }, 10);
            }
        } else if (scrollTopBtn) {
            scrollTopBtn.style.opacity = '0';
            scrollTopBtn.style.transform = 'scale(0)';
            setTimeout(() => {
                if (scrollTopBtn && scrollTopBtn.parentNode) {
                    scrollTopBtn.parentNode.removeChild(scrollTopBtn);
                    scrollTopBtn = null;
                }
            }, 300);
        }
    }

    // Only add scroll handler if page is long enough
    if (document.body.scrollHeight > window.innerHeight + 300) {
        window.addEventListener('scroll', handleScroll);
    }

    // Add fade-in animation to cards
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
});