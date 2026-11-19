(() => {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const desktopNavigation = matchMedia("(min-width: 56rem)");
    const stories = [];
    const featureMenu = document.querySelector(".features-menu");

    if (featureMenu) {
        featureMenu.addEventListener("click", (event) => {
            if (!event.target.closest("a")) return;
            featureMenu.open = false;
        });
        document.addEventListener("pointerdown", (event) => {
            if (!featureMenu.contains(event.target)) featureMenu.open = false;
        });
        featureMenu.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || !featureMenu.open) return;
            featureMenu.open = false;
            featureMenu.querySelector("summary").focus();
        });
    }

    for (const track of document.querySelectorAll(".chapter-track")) {
        const body = track.querySelector(".chapter-body");
        const nav = track.querySelector(".chapter-nav");
        const panels = Array.from(track.querySelectorAll(".feature-detail"));
        const links = Array.from(nav.querySelectorAll("a"));
        if (panels.length < 2 || panels.length !== links.length) continue;

        // Move fragment targets onto the scroll track. Without JS, the original
        // targets remain on the articles and all the content reads in order.
        const waypoints = document.createElement("div");
        waypoints.className = "chapter-waypoints";
        waypoints.setAttribute("aria-hidden", "true");
        const markers = panels.map((panel) => {
            const marker = document.createElement("span");
            marker.id = panel.id;
            panel.removeAttribute("id");
            waypoints.append(marker);
            panel.inert = true;
            return marker;
        });

        track.append(waypoints);
        track.style.setProperty("--story-transitions", panels.length - 1);
        track.classList.add("is-scroll-story");
        const heading = track.closest(".feature-chapter").querySelector(".chapter-copy");
        const story = { body, nav, heading, panels, links, markers, active: -1 };
        stories.push(story);
        bindNavWheel(story);
    }

    function bindNavWheel(story) {
        const idleInterval = 190;
        let gesture;
        story.nav.addEventListener("wheel", (event) => {
            if (!desktopNavigation.matches || !event.cancelable || event.ctrlKey ||
                Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

            const now = performance.now();
            if (!gesture || now - gesture.last > idleInterval) {
                const direction = Math.sign(event.deltaY);
                const target = story.active + direction;
                gesture = {
                    direction,
                    target,
                    distance: 0,
                    switched: false,
                    atEdge: target < 0 || target >= story.markers.length,
                };
            }
            gesture.last = now;
            // A fresh gesture at either end is normal page scrolling. Once a
            // tab has changed, consume the remaining momentum of that gesture.
            if (gesture.atEdge) return;
            event.preventDefault();
            if (gesture.switched) return;

            const unit = event.deltaMode === 1 ? 17 : event.deltaMode === 2 ? innerHeight : 1;
            gesture.distance += event.deltaY * gesture.direction * unit;
            if (gesture.distance < 25) return;

            gesture.switched = true;
            story.markers[gesture.target].scrollIntoView({
                block: "start",
                behavior: reducedMotion.matches ? "instant" : "smooth",
            });
        }, { passive: false });
    }

    function select(story, index) {
        if (story.active === index) return;
        const outgoing = story.panels[story.active];
        if (outgoing) {
            outgoing.classList.remove("is-current");
            outgoing.inert = true;
            outgoing.querySelector("video")?.pause();
            story.links[story.active].removeAttribute("aria-current");
        }

        const panel = story.panels[index];
        const link = story.links[index];
        panel.inert = false;
        panel.classList.add("is-current");
        link.setAttribute("aria-current", "location");
        story.active = index;

        // Keep the current link in view in the narrow layout's navigation strip.
        const bounds = story.nav.getBoundingClientRect();
        const active = link.getBoundingClientRect();
        if (active.left < bounds.left) {
            story.nav.scrollLeft += active.left - bounds.left - 4;
        } else if (active.right > bounds.right) {
            story.nav.scrollLeft += active.right - bounds.right + 4;
        }
        if (active.top < bounds.top) {
            story.nav.scrollTop += active.top - bounds.top - 4;
        } else if (active.bottom > bounds.bottom) {
            story.nav.scrollTop += active.bottom - bounds.bottom + 4;
        }
    }

    function ease(fraction) {
        const t = Math.max(0, Math.min(1, fraction));
        return t * t * (3 - 2 * t);
    }

    function blend(distance, from, to) {
        return ease((Math.abs(distance) - from) / (to - from));
    }

    function animateHeading(heading) {
        if (reducedMotion.matches) return;
        // Use the untransformed header so the animation cannot shift its own trigger.
        const bounds = heading.parentElement.getBoundingClientRect();
        const entering = ease((innerHeight * 0.94 - bounds.top) / (innerHeight * 0.31));
        const leaving = ease((bounds.bottom + 10) / Math.min(innerHeight * 0.18, 140));
        const strength = 1 - Math.min(entering, leaving);
        heading.style.setProperty("--heading-opacity", 1 - strength * 0.86);
        heading.style.setProperty("--heading-progress", strength);
    }

    let pending = false;
    function update() {
        pending = false;
        if (!stories.length) return;
        const pin = parseFloat(getComputedStyle(stories[0].body).top);
        for (const story of stories) {
            animateHeading(story.heading);
            const first = story.markers[0].getBoundingClientRect().top;
            const step = story.markers[1].getBoundingClientRect().top - first;
            if (step <= 0) continue;
            const progress = Math.max(0, Math.min(story.panels.length - 1, (pin - first) / step));
            const index = Math.round(progress);
            select(story, index);

            // Both directions scrub the same transition: the outgoing image and
            // caption leave, then the incoming panel moves into their place.
            const distance = reducedMotion.matches ? 0 : progress - index;
            const direction = Math.sign(distance);
            const image = blend(distance, 0.12, 0.5);
            const caption = blend(distance, 0.05, 0.44);
            story.body.style.setProperty("--image-opacity", 1 - image);
            story.body.style.setProperty("--image-shift", -direction * image * 39 + "px");
            story.body.style.setProperty("--image-scale", 1 - image * 0.045);
            story.body.style.setProperty("--caption-opacity", 1 - caption);
            story.body.style.setProperty("--caption-shift", -direction * caption * 31 + "px");
        }
    }

    function scheduleUpdate() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(update);
    }

    let settleTimer;
    window.addEventListener("scroll", () => {
        if (!reducedMotion.matches) {
            document.documentElement.classList.add("is-scrubbing");
            clearTimeout(settleTimer);
            settleTimer = setTimeout(() => document.documentElement.classList.remove("is-scrubbing"), 145);
        }
        scheduleUpdate();
    }, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("pageshow", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);
    document.addEventListener("toggle", scheduleUpdate, true);
    reducedMotion.addEventListener("change", scheduleUpdate);

    const startingPoint = document.getElementById(location.hash.slice(1));
    if (startingPoint?.parentElement.classList.contains("chapter-waypoints") &&
        performance.getEntriesByType("navigation")[0]?.type !== "back_forward") {
        startingPoint.scrollIntoView({ block: "start", behavior: "instant" });
    }
    update();
})();
