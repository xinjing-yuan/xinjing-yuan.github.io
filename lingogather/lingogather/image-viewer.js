(() => {
    const viewer = document.querySelector(".image-viewer");
    if (!viewer || typeof viewer.showModal !== "function") return;

    const stage = viewer.querySelector(".image-viewer-stage");
    const scaleButton = viewer.querySelector(".viewer-scale");
    const photo = new Image();
    stage.append(photo);
    let opener;
    let returnPosition;

    function setZoom(zoom) {
        stage.classList.toggle("is-zoomed", zoom);
        scaleButton.textContent = zoom ? scaleButton.dataset.fit : scaleButton.dataset.zoom;
        scaleButton.setAttribute("aria-pressed", String(zoom));
        stage.scrollLeft = zoom ? (stage.scrollWidth - stage.clientWidth) / 2 : 0;
        stage.scrollTop = zoom ? (stage.scrollHeight - stage.clientHeight) / 2 : 0;
    }

    scaleButton.addEventListener("click", () => setZoom(!stage.classList.contains("is-zoomed")));
    viewer.addEventListener("click", (event) => {
        if (event.target === viewer) viewer.close();
    });
    viewer.addEventListener("close", () => {
        photo.removeAttribute("src");
        window.scrollTo({ ...returnPosition, behavior: "instant" });
        requestAnimationFrame(() => {
            if (!viewer.open && opener && !opener.closest("[inert]")) {
                opener.focus({ preventScroll: true });
            }
        });
    });

    function moveLens(event, link, image, lens) {
        if (event.pointerType !== "mouse" || !image.naturalWidth || !image.naturalHeight) return;

        const box = image.getBoundingClientRect();
        const fit = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
        const width = image.naturalWidth * fit;
        const height = image.naturalHeight * fit;
        const x = event.clientX - box.left - (box.width - width) / 2;
        const y = event.clientY - box.top - (box.height - height) / 2;
        if (x < 0 || x > width || y < 0 || y > height) {
            link.classList.remove("has-lens");
            return;
        }

        const linkBox = link.getBoundingClientRect();
        const size = lens.offsetWidth;
        const zoom = 2.2;
        lens.style.left = event.clientX - linkBox.left + "px";
        lens.style.top = event.clientY - linkBox.top + "px";
        lens.style.backgroundImage = "url(" + JSON.stringify(image.currentSrc || image.src) + ")";
        lens.style.backgroundSize = `${width * zoom}px ${height * zoom}px`;
        lens.style.backgroundPosition = `${size / 2 - x * zoom}px ${size / 2 - y * zoom}px`;
        link.classList.add("has-lens");
    }

    for (const link of document.querySelectorAll(".image-demo")) {
        const image = link.querySelector("img");
        const lens = link.querySelector(".image-lens");
        link.setAttribute("aria-haspopup", "dialog");
        link.addEventListener("pointermove", (event) => moveLens(event, link, image, lens));
        link.addEventListener("pointerleave", () => link.classList.remove("has-lens"));
        link.addEventListener("click", (event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

            event.preventDefault();
            opener = link;
            returnPosition = { left: scrollX, top: scrollY };
            photo.src = link.href;
            photo.alt = image.alt;
            link.classList.remove("has-lens");
            viewer.showModal();
            setZoom(false);
        });
    }
})();
