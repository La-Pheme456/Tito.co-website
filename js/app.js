/* Small, dependency-free interactions. All reading content works without JavaScript. */
document.documentElement.classList.add("js-enabled");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileLayout = window.matchMedia("(max-width: 760px)");
const compactStory = window.matchMedia("(max-width: 1100px), (max-height: 740px)");

// Older Safari uses addListener for media query changes.
function observeMedia(query, listener) {
    if (typeof query.addEventListener === "function") query.addEventListener("change", listener);
    else if (typeof query.addListener === "function") query.addListener(listener);
}

// Mobile navigation stays in normal document flow: no overlay or focus trap.
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#main-nav");
if (menuButton && navigation) {
    function closeMenu() {
        navigation.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.querySelector("span").textContent = "+";
    }
    menuButton.addEventListener("click", () => {
        const open = navigation.classList.toggle("open");
        menuButton.setAttribute("aria-expanded", String(open));
        menuButton.querySelector("span").textContent = open ? "−" : "+";
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && navigation.classList.contains("open")) {
            closeMenu();
            menuButton.focus();
        }
    });
    observeMedia(mobileLayout, closeMenu);
}

// Carousel: manual controls, keyboard arrows, swipe, and respectful autoplay.
const carousel = document.querySelector(".carousel");
const slides = [...document.querySelectorAll(".slide")];
let currentSlide = 0;
let manuallyPaused = motionPreference.matches;
if (carousel && slides.length) {
    const controls = document.querySelector(".controls");
    const pauseButton = controls.querySelector("[data-pause]");
    const count = controls.querySelector("#count");
    let pointerInside = false;
    let touchStart = null;

    function updatePauseButton() {
        pauseButton.textContent = manuallyPaused ? "Play" : "Pause";
        pauseButton.setAttribute("aria-label", manuallyPaused ? "Play carousel" : "Pause carousel");
        pauseButton.setAttribute("aria-pressed", String(manuallyPaused));
    }

    function showSlide(index) {
        currentSlide = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
            const active = i === currentSlide;
            slide.classList.toggle("active", active);
            slide.classList.toggle("is-next", i === (currentSlide + 1) % slides.length);
            slide.setAttribute("aria-hidden", String(!active));
            slide.setAttribute("role", "group");
            slide.setAttribute("aria-roledescription", "slide");
            slide.setAttribute("aria-label", `${i + 1} of ${slides.length}`);
        });
        count.textContent = `${String(currentSlide + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    }

    controls.querySelector("[data-prev]").addEventListener("click", () => showSlide(currentSlide - 1));
    controls.querySelector("[data-next]").addEventListener("click", () => showSlide(currentSlide + 1));
    pauseButton.addEventListener("click", () => {
        manuallyPaused = !manuallyPaused;
        updatePauseButton();
    });
    carousel.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            showSlide(currentSlide + (event.key === "ArrowRight" ? 1 : -1));
        }
    });
    const carouselArea = carousel.closest(".carousel-wrap");
    carouselArea.addEventListener("pointerenter", () => {
        pointerInside = true;
    });
    carouselArea.addEventListener("pointerleave", () => {
        pointerInside = false;
    });
    carousel.addEventListener(
        "touchstart",
        (event) => {
            const touch = event.changedTouches[0];
            if (!touch) return;
            touchStart = { x: touch.clientX, y: touch.clientY };
        },
        { passive: true }
    );
    carousel.addEventListener(
        "touchend",
        (event) => {
            if (!touchStart) return;
            const touch = event.changedTouches[0];
            const dx = touch.clientX - touchStart.x;
            const dy = touch.clientY - touchStart.y;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                showSlide(currentSlide + (dx < 0 ? 1 : -1));
            }
            touchStart = null;
        },
        { passive: true }
    );
    window.setInterval(() => {
        const box = carousel.getBoundingClientRect();
        const visible = box.bottom > 0 && box.top < window.innerHeight;
        if (
            !manuallyPaused &&
            !motionPreference.matches &&
            !pointerInside &&
            !document.hidden &&
            visible &&
            !carouselArea.contains(document.activeElement)
        ) {
            showSlide(currentSlide + 1);
        }
    }, 6500);
    observeMedia(motionPreference, () => {
        if (motionPreference.matches) manuallyPaused = true;
        updatePauseButton();
    });
    showSlide(0);
    updatePauseButton();
}

// Native scroll-linked storytelling. No timers or one-time reveal classes.
// Each style is a pure function of current geometry, so scrolling back reverses it.
const scrollElements = [...document.querySelectorAll("[data-scroll]")];
const spotlight = document.querySelector(".spotlight-track");
const spotlightDetails = [...document.querySelectorAll("[data-detail]")];
const activeElements = new Set(scrollElements);
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
let framePending = false;

function renderScroll() {
    framePending = false;
    const viewport = window.innerHeight;
    activeElements.forEach((element) => {
        if (motionPreference.matches) {
            element.style.removeProperty("--reveal-opacity");
            element.style.removeProperty("--reveal-y");
            return;
        }
        const box = element.getBoundingClientRect();
        const progress = clamp((viewport * 0.98 - box.top) / (viewport * 0.28));
        const eased = 1 - Math.pow(1 - progress, 2);
        element.style.setProperty("--reveal-opacity", (0.92 + 0.08 * eased).toFixed(3));
        element.style.setProperty("--reveal-y", `${(25 * (1 - eased)).toFixed(2)}px`);
    });
    // A staged product sequence driven only by scroll position. Reverses without play-once state.
    if (spotlight) {
        const box = spotlight.getBoundingClientRect();
        const simple = motionPreference.matches || compactStory.matches;
        const stage = spotlight.querySelector(".spotlight-stage");
        const availableTravel = Math.max(1, box.height - stage.offsetHeight);
        const progress = clamp((106 - box.top) / availableTravel);
        const settle = clamp(progress / 0.28);
        const exit = clamp((progress - 0.78) / 0.22);
        spotlight.style.setProperty("--spot-progress", simple ? "1" : progress.toFixed(4));
        spotlight.style.setProperty("--spot-scale", simple ? "1" : (1.17 - settle * 0.17 - exit * 0.035).toFixed(4));
        spotlight.style.setProperty("--spot-x", simple ? "0px" : ((1 - settle) * 25 - exit * 12).toFixed(2) + "px");
        spotlight.style.setProperty("--spot-y", simple ? "0px" : ((1 - settle) * 24 - exit * 20).toFixed(2) + "px");
        spotlight.style.setProperty("--spot-title-y", simple ? "0px" : ((1 - settle) * 30).toFixed(2) + "px");
        spotlight.style.setProperty("--spot-title-opacity", simple ? "1" : (0.3 + settle * 0.7).toFixed(3));
        spotlightDetails.forEach((detail, index) => {
            const reveal = simple ? 1 : clamp((progress - (0.2 + index * 0.16)) / 0.2);
            detail.style.setProperty("--detail-opacity", (0.25 + reveal * 0.75).toFixed(3));
            detail.style.setProperty("--detail-y", ((1 - reveal) * 24).toFixed(2) + "px");
            detail.style.setProperty("--detail-clip", ((1 - reveal) * 100).toFixed(2) + "%");
        });
    }
}

function requestScrollFrame() {
    if (!framePending) {
        framePending = true;
        window.requestAnimationFrame(renderScroll);
    }
}
if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) activeElements.add(entry.target);
                else activeElements.delete(entry.target);
            });
            requestScrollFrame();
        },
        { rootMargin: "120px" }
    );
    scrollElements.forEach((element) => observer.observe(element));
}
window.addEventListener("scroll", requestScrollFrame, { passive: true });
window.addEventListener("resize", requestScrollFrame);
observeMedia(motionPreference, () => {
    scrollElements.forEach((element) => activeElements.add(element));
    requestScrollFrame();
});
observeMedia(mobileLayout, requestScrollFrame);
observeMedia(compactStory, requestScrollFrame);
window.addEventListener("load", requestScrollFrame);
renderScroll();

// Collection remains fully visible without JavaScript.
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const products = [...document.querySelectorAll(".product")];
const collectionCount = document.querySelector(".collection-count");
filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        filterButtons.forEach((item) => {
            const selected = item === button;
            item.classList.toggle("selected", selected);
            item.setAttribute("aria-pressed", String(selected));
        });
        let visible = 0;
        products.forEach((product) => {
            product.hidden = button.dataset.filter !== "all" && product.dataset.category !== button.dataset.filter;
            if (!product.hidden) visible++;
        });
        if (collectionCount) collectionCount.textContent = `${visible} ${visible === 1 ? "look" : "looks"}`;
        requestScrollFrame();
    });
});

// The visitor reviews and sends the enquiry in WhatsApp. Nothing is stored here.
const enquiry = document.querySelector("#enquiry");
if (enquiry) {
    enquiry.elements.look.value = (new URLSearchParams(window.location.search).get("look") || "").slice(0, 200);
    const occasion = new URLSearchParams(window.location.search).get("occasion");
    if ([...enquiry.elements.occasion.options].some((option) => option.value === occasion)) {
        enquiry.elements.occasion.value = occasion;
    }
    enquiry.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!enquiry.reportValidity()) return;
        const data = new FormData(enquiry);
        const name = String(data.get("name")).trim();
        const look = String(data.get("look")).trim();
        const status = enquiry.querySelector(".form-status");
        if (!name || !look) {
            status.textContent = "Please enter your name and the look you have in mind.";
            enquiry.elements[!name ? "name" : "look"].focus();
            return;
        }
        const message = [
            `Hello TITOO Co.! My name is ${name}. I'd like to create my look.`,
            `Outfit: ${look}`,
            `Occasion: ${data.get("occasion")}`,
            `Event date: ${data.get("date") || "To discuss"}`,
            `Receiving my outfit: ${data.get("delivery")}`,
            String(data.get("details") || "").trim(),
            "Please let me know about measurements, pricing and availability."
        ]
            .filter(Boolean)
            .join("\n");
        status.textContent = "Opening WhatsApp. Review your enquiry there before sending.";
        window.location.assign(`https://wa.me/2347053803767?text=${encodeURIComponent(message)}`);
    });
}

// Outfit previews keep the collection within reach without leaving the gallery.
if (typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal === "function") {
    const galleryLinks = [...document.querySelectorAll(".gallery-grid > a")];
    if (galleryLinks.length) {
        const descriptions = {
            "The White Agbada":
                "Sculptural panels, an all-white silhouette and fine fringe. Discuss the finishing and your personal fit with us.",
            "The Blue Note":
                "Soft blue, fine surface texture and a coordinated silhouette. A quieter take on dressing for an occasion.",
            "The Burgundy Edit":
                "A rich burgundy tone and a relaxed silhouette. Start with this look and discuss the details you have in mind.",
            "Together, in Style":
                "Two individual outfits connected by a shared occasion. Talk to us about your references, colours and measurements."
        };
        const dialog = document.createElement("dialog");
        dialog.className = "look-dialog";
        dialog.setAttribute("aria-labelledby", "look-dialog-title");
        dialog.setAttribute("aria-describedby", "look-dialog-description");
        dialog.innerHTML = `<button class="look-dialog-close" type="button" autofocus>Close ×</button><div class="look-dialog-image"><img alt=""></div><div class="look-dialog-copy"><p class="eyebrow">THE TITOO CO. LOOKBOOK</p><h2 id="look-dialog-title"></h2><p id="look-dialog-description"></p><a class="button">Discuss this outfit ↗</a><p class="note">Measurements and pricing are discussed directly.</p></div>`;
        document.body.append(dialog);
        let opener = null;
        let previousOverflow = "";
        galleryLinks.forEach((link) => {
            link.addEventListener("click", (event) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                opener = link;
                const name = new URL(link.href).searchParams.get("look");
                const source = link.querySelector("img");
                const image = dialog.querySelector("img");
                image.src = source.src;
                image.alt = source.alt;
                dialog.querySelector("h2").textContent = name;
                dialog.querySelector("#look-dialog-description").textContent =
                    descriptions[name] || "Make this look your starting point. Discuss the details and fit with us.";
                dialog.querySelector("a").href = link.href;
                previousOverflow = document.body.style.overflow;
                document.body.style.overflow = "hidden";
                dialog.showModal();
            });
        });
        dialog.querySelector("button").addEventListener("click", () => dialog.close());
        dialog.addEventListener("click", (event) => {
            if (event.target !== dialog) return;
            const box = dialog.getBoundingClientRect();
            if (
                event.clientX < box.left ||
                event.clientX > box.right ||
                event.clientY < box.top ||
                event.clientY > box.bottom
            )
                dialog.close();
        });
        dialog.addEventListener("close", () => {
            document.body.style.overflow = previousOverflow;
            if (opener) opener.focus({ preventScroll: true });
        });
    }
}
