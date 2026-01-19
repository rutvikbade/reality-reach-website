/* ========================================
   REALITY REACH TECHNOLOGIES — SCRIPTS v4
   Category Filter & Progress Carousel
   ======================================== */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        initNavbarScroll();
        initMobileMenu();
        initSmoothScroll();
        initFramedAnimations();
        initCareersCategoryFilter();
        initImpactCarousel();
    }

    // ========== NAVBAR SCROLL ==========
    function initNavbarScroll() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;

        let lastScrollY = window.scrollY;
        let ticking = false;
        const heroHeight = window.innerHeight;

        function updateNavbar() {
            const currentScrollY = window.scrollY;

            if (currentScrollY < heroHeight - 100) {
                navbar.classList.remove('navbar--solid');
                navbar.classList.add('navbar--transparent');
            } else {
                navbar.classList.remove('navbar--transparent');
                navbar.classList.add('navbar--solid');
            }

            if (currentScrollY > heroHeight) {
                if (currentScrollY > lastScrollY && currentScrollY > heroHeight + 200) {
                    navbar.classList.add('navbar--hidden');
                } else if (currentScrollY < lastScrollY) {
                    navbar.classList.remove('navbar--hidden');
                }
            } else {
                navbar.classList.remove('navbar--hidden');
            }

            lastScrollY = currentScrollY;
            ticking = false;
        }

        window.addEventListener('scroll', function () {
            if (!ticking) {
                window.requestAnimationFrame(updateNavbar);
                ticking = true;
            }
        }, { passive: true });

        updateNavbar();
    }

    // ========== MOBILE MENU ==========
    function initMobileMenu() {
        const hamburger = document.getElementById('hamburger');
        const mobileMenu = document.getElementById('mobile-menu');

        if (!hamburger || !mobileMenu) return;

        hamburger.addEventListener('click', function () {
            const isOpen = hamburger.classList.contains('active');

            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        const mobileLinks = mobileMenu.querySelectorAll('.navbar__link');
        mobileLinks.forEach(function (link) {
            link.addEventListener('click', closeMenu);
        });

        function openMenu() {
            hamburger.classList.add('active');
            hamburger.setAttribute('aria-expanded', 'true');
            mobileMenu.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeMenu() {
            hamburger.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
                closeMenu();
            }
        });
    }

    // ========== SMOOTH SCROLL ==========
    function initSmoothScroll() {
        const links = document.querySelectorAll('a[href^="#"]');

        links.forEach(function (link) {
            link.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href === '#') return;

                const target = document.querySelector(href);
                if (!target) return;

                e.preventDefault();

                const navbarHeight = document.getElementById('navbar')?.offsetHeight || 0;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - navbarHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                history.pushState(null, '', href);
            });
        });
    }

    // ========== FRAMED ANIMATIONS ==========
    function initFramedAnimations() {
        const framedElements = document.querySelectorAll('.framed');

        if (framedElements.length === 0) return;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            framedElements.forEach(function (el) {
                el.classList.add('visible');
            });
            return;
        }

        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    // Trigger animation
                    entry.target.classList.add('animate-in');

                    // After animation completes, make content permanently visible
                    setTimeout(function () {
                        entry.target.classList.add('visible');
                    }, 1400); // After perimeter + content animation
                }
            });
        }, observerOptions);

        framedElements.forEach(function (el) {
            observer.observe(el);
        });
    }

    // ========== CAREERS CATEGORY FILTER ==========
    function initCareersCategoryFilter() {
        const categories = document.querySelectorAll('.careers__category');
        const jobCards = document.querySelectorAll('.job-card');

        if (categories.length === 0 || jobCards.length === 0) return;

        categories.forEach(function (category) {
            category.addEventListener('click', function () {
                const selectedCategory = this.dataset.category;

                // Update active category
                categories.forEach(function (cat) {
                    cat.classList.remove('active');
                });
                this.classList.add('active');

                // Show/hide job cards
                jobCards.forEach(function (card) {
                    if (card.dataset.category === selectedCategory) {
                        card.classList.remove('hidden');
                    } else {
                        card.classList.add('hidden');
                    }
                });
            });
        });
    }

    // ========== IMPACT CAROUSEL (Mobile) ==========
    function initImpactCarousel() {
        const grid = document.querySelector('.impact__grid');
        const progressFill = document.getElementById('impact-progress');
        const currentText = document.getElementById('impact-current');
        const prevBtn = document.getElementById('impact-prev');
        const nextBtn = document.getElementById('impact-next');

        if (!grid) return;

        const cards = grid.querySelectorAll('.impact-card');
        const totalCards = cards.length;

        if (totalCards === 0) return;

        let currentIndex = 0;
        let autoAdvanceTimer = null;
        const AUTO_ADVANCE_INTERVAL = 5000; // 5 seconds

        // Check if mobile
        function isMobile() {
            return window.innerWidth <= 768;
        }

        // Show specific card
        function showCard(index) {
            // Wrap around
            if (index < 0) index = totalCards - 1;
            if (index >= totalCards) index = 0;

            currentIndex = index;

            // Update card visibility
            cards.forEach(function (card, i) {
                if (i === currentIndex) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
            });

            // Update progress
            updateProgress();

            // Restart timer animation
            restartProgressAnimation();
        }

        // Update progress display
        function updateProgress() {
            if (!currentText) return;
            currentText.textContent = currentIndex + 1;
        }

        // Restart progress bar animation
        function restartProgressAnimation() {
            if (!progressFill) return;

            // Reset animation
            progressFill.classList.remove('animating');
            void progressFill.offsetWidth; // Force reflow
            progressFill.classList.add('animating');
        }

        // Auto-advance to next card
        function autoAdvance() {
            showCard(currentIndex + 1);
        }

        // Start auto-advance timer
        function startAutoAdvance() {
            stopAutoAdvance();
            autoAdvanceTimer = setInterval(autoAdvance, AUTO_ADVANCE_INTERVAL);
        }

        // Stop auto-advance timer
        function stopAutoAdvance() {
            if (autoAdvanceTimer) {
                clearInterval(autoAdvanceTimer);
                autoAdvanceTimer = null;
            }
        }

        // Previous button click
        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                showCard(currentIndex - 1);
                startAutoAdvance(); // Restart timer
            });
        }

        // Next button click
        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                showCard(currentIndex + 1);
                startAutoAdvance(); // Restart timer
            });
        }

        // Initialize carousel
        showCard(0);
        startAutoAdvance();
    }

})();
