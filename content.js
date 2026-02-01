const DEBUG_MODE = true;

const SELECTORS = {
    PROFILE_IMAGE: 'header img[draggable="false"]',
    PROFILE_IMAGE_ALT: "header section img:first-of-type",
    STORY_CLOSE: 'polyline[points*="20.643"]',
    PROFILE_OPTIONS: 'svg[aria-label="Options"]',
    POST_BOOKMARK: 'polygon[points*="13.44"]',
    STORY_CANVAS: "canvas"
};

const SAVE_FREE_URLS = {
    STORIES: "https://www.save-free.com/fr/stories-downloader/",
    PHOTOS: "https://www.save-free.com/fr/photo-downloader/",
    REELS: "https://www.save-free.com/fr/reels-downloader/"
};

const MODAL_CHECK_INTERVAL = 300;

const TRANSLATIONS = {
    fr: {
        DOWNLOAD: "Télécharger",
        CLOSE: "Fermer",
        PROFILE_PICTURE_HD: "Photo de profil HD"
    },
    en: {
        DOWNLOAD: "Download",
        CLOSE: "Close",
        PROFILE_PICTURE_HD: "Profile picture HD"
    }
};

const STYLES = {
    info: "color: #3b82f6; font-weight: bold",
    success: "color: #10b981; font-weight: bold",
    warning: "color: #f59e0b; font-weight: bold",
    error: "color: #ef4444; font-weight: bold",
    feature: "color: #8b5cf6; font-weight: bold"
};

const logger = {
    log(level, emoji, message, ...args) {
        if (!DEBUG_MODE) return;
        const style = STYLES[level] || "";
        console.log(`%c${emoji} ${message}`, style, ...args);
    },
    info(message, ...args) {
        this.log("info", "🔵", message, ...args);
    },
    success(message, ...args) {
        this.log("success", "✅", message, ...args);
    },
    warning(message, ...args) {
        this.log("warning", "⚠️", message, ...args);
    },
    error(message, ...args) {
        this.log("error", "❌", message, ...args);
    },
    feature(featureName, message, ...args) {
        this.log("feature", "🎯", `[${featureName}] ${message}`, ...args);
    },
    pageChange(from, to) {
        this.log("info", "🔄", `Page: ${from} → ${to}`);
    },
    urlChange(from, to) {
        this.log("info", "🌐", `URL: ${from} → ${to}`);
    }
};

let currentLanguage = "fr";

function t(key) {
    return TRANSLATIONS[currentLanguage][key] || key;
}

function detectLanguage() {
    const browserLang = navigator.language.split("-")[0];
    return [ "fr", "en" ].includes(browserLang) ? browserLang : "fr";
}

currentLanguage = detectLanguage();

function getProfileImage() {
    return document.querySelector(SELECTORS.PROFILE_IMAGE) || document.querySelector(SELECTORS.PROFILE_IMAGE_ALT);
}

function detectPageType() {
    const path = window.location.pathname;
    logger.info("Détection type de page:", path);
    for (const [type, config] of Object.entries(PAGE_TYPES)) {
        if (config.detect(path)) {
            logger.info(`Type détecté: ${type}`);
            return type;
        }
    }
    return "other";
}

async function getHDProfilePicture() {
    try {
        logger.info("Demande HD au background...");
        const response = await chrome.runtime.sendMessage({
            action: "getHDProfilePicture"
        });
        if (response.success) {
            logger.success("HD reçue:", response.hdUrl);
            return response.hdUrl;
        } else {
            logger.error("Erreur background:", response.error);
            return getFallbackImage();
        }
    } catch (error) {
        logger.error("Erreur communication background:", error);
        return getFallbackImage();
    }
}

function getFallbackImage() {
    const profileImg = getProfileImage();
    if (profileImg) {
        logger.warning("Fallback sur image de base");
        return profileImg.src;
    }
    return null;
}

async function downloadImage(url, filename) {
    try {
        logger.info("Téléchargement:", filename);
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
        logger.success("Téléchargement lancé");
    } catch (error) {
        logger.error("Erreur téléchargement:", error);
    }
}

function showFullscreenImage(imageUrl) {
    const username = window.location.pathname.split("/").filter(Boolean)[0];
    const modal = document.createElement("div");
    modal.className = "ig-utils-fullscreen-modal";
    modal.innerHTML = `\n    <div class="modal-content">\n      <div class="modal-header">\n        <button class="modal-close" aria-label="${t("CLOSE")}">\n          <svg fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">\n            <polyline fill="none" points="20.643 3.357 12 12 3.353 20.647" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"></polyline>\n            <line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" x1="20.649" x2="3.354" y1="20.649" y2="3.354"></line>\n          </svg>\n        </button>\n        <button class="modal-download" aria-label="${t("DOWNLOAD")}" data-url="${imageUrl}" data-username="${username}">\n          <svg fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">\n            <line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="12" x2="12" y1="3" y2="16"></line>\n            <polyline fill="none" points="16 12 12 16 8 12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></polyline>\n            <line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="4" x2="20" y1="21" y2="21"></line>\n          </svg>\n        </button>\n      </div>\n      <img src="${imageUrl}" alt="${t("PROFILE_PICTURE_HD")}">\n    </div>\n  `;
    const closeModal = () => {
        modal.classList.add("closing");
        setTimeout(() => modal.remove(), 200);
        document.removeEventListener("keydown", closeOnEscape);
    };
    modal.addEventListener("click", e => {
        if (e.target === modal) closeModal();
    });
    modal.querySelector(".modal-close").addEventListener("click", e => {
        e.stopPropagation();
        closeModal();
    });
    modal.querySelector(".modal-download").addEventListener("click", async e => {
        e.stopPropagation();
        const btn = e.currentTarget;
        await downloadImage(btn.dataset.url, `${btn.dataset.username}_hd_profile.jpg`);
    });
    const closeOnEscape = e => {
        if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.appendChild(modal);
    logger.success("Modal fullscreen affiché");
}

const FEATURES = {
    stories: {
        selector: SELECTORS.STORY_CLOSE,
        buttonClass: "story-btn",
        parentLevels: 3,
        position: "afterend",
        svgSize: 24,
        strokeWidth: 3,
        action: () => {
            navigator.clipboard.writeText(window.location.href).catch(err => logger.error("Clipboard error:", err));
            window.open(SAVE_FREE_URLS.STORIES, "_blank", "noopener,noreferrer");
        }
    },
    profile: {
        selector: SELECTORS.PROFILE_OPTIONS,
        buttonClass: "profil-btn",
        parentLevels: 2,
        position: "absolute-right",
        svgSize: 28,
        strokeWidth: 2,
        action: () => {
            const username = window.location.pathname.split("/").filter(Boolean)[0];
            const storiesUrl = `https://www.instagram.com/stories/${username}/`;
            navigator.clipboard.writeText(storiesUrl).catch(err => logger.error("Clipboard error:", err));
            window.open(SAVE_FREE_URLS.STORIES, "_self");
        }
    },
    post: {
        selector: SELECTORS.POST_BOOKMARK,
        buttonClass: "post-btn",
        parentLevels: 6,
        position: "prepend-in-bookmark-container",
        svgSize: 24,
        strokeWidth: 2,
        action: () => {
            navigator.clipboard.writeText(window.location.href).catch(err => logger.error("Clipboard error:", err));
            window.open(SAVE_FREE_URLS.PHOTOS, "_self");
        }
    },
    reel: {
        selector: SELECTORS.POST_BOOKMARK,
        buttonClass: "post-btn",
        parentLevels: 6,
        position: "prepend-in-bookmark-container",
        svgSize: 24,
        strokeWidth: 2,
        action: () => {
            navigator.clipboard.writeText(window.location.href).catch(err => logger.error("Clipboard error:", err));
            window.open(SAVE_FREE_URLS.REELS, "_self");
        }
    },
    reels: {
        selector: SELECTORS.POST_BOOKMARK,
        buttonClass: "reels-btn",
        parentLevels: 6,
        position: "afterend",
        svgSize: 24,
        strokeWidth: 2,
        action: () => {
            navigator.clipboard.writeText(window.location.href).catch(err => logger.error("Clipboard error:", err));
            window.open(SAVE_FREE_URLS.REELS, "_self");
        }
    },
    profilePictureHover: {
        selector: SELECTORS.PROFILE_IMAGE,
        buttonClass: "profile-pic-overlay",
        parentLevels: 0,
        position: "overlay-hover",
        svgSize: 32,
        action: async () => {
            const hdUrl = await getHDProfilePicture();
            if (hdUrl) {
                showFullscreenImage(hdUrl);
            } else {
                logger.error("Impossible de récupérer la photo HD");
            }
        }
    }
};

const PAGE_TYPES = {
    stories: {
        detect: path => path.includes("/stories/"),
        features: [ "stories" ]
    },
    post: {
        detect: path => path.includes("/p/"),
        features: [ "post" ]
    },
    reel: {
        detect: path => path.includes("/reel/"),
        features: [ "reel" ]
    },
    reels: {
        detect: path => {
            const cleanPath = path.replace(/\/$/, "");
            const segments = cleanPath.split("/").filter(Boolean);
            return segments[0] === "reels";
        },
        features: [ "reels" ]
    },
    profile: {
        detect: path => {
            const excluded = [ "/accounts/", "/explore/", "/direct/", "/create/", "/p/", "/tv/", "/settings/", "/your_activity/" ];
            const profilePattern = /^\/([^\/]+)\/?/;
            const match = path.match(profilePattern);
            return !excluded.some(p => path.includes(p)) && match && match[1] && path !== "/";
        },
        features: [ "profile", "profilePictureHover" ]
    },
    other: {
        detect: () => true,
        features: []
    }
};

class ButtonInjector {
    constructor(featureName) {
        this.featureName = featureName;
        this.config = FEATURES[featureName];
        this.observer = null;
        if (!this.config) {
            logger.error(`Feature "${featureName}" introuvable`);
        }
    }
    inject() {
        logger.feature(this.featureName, "Tentative d'injection");
        const target = document.querySelector(this.config.selector);
        if (target) {
            logger.feature(this.featureName, "Élément trouvé immédiatement");
            const parent = this.getParent(target);
            if (parent) {
                this.createButton(parent);
            } else {
                logger.warning(`[${this.featureName}] Parent introuvable`);
            }
        } else {
            logger.feature(this.featureName, "Observer lancé");
            this.observe();
        }
    }
    getParent(element) {
        let parent = element;
        for (let i = 0; i < this.config.parentLevels; i++) {
            parent = parent?.parentElement;
            if (!parent) {
                logger.warning(`[${this.featureName}] Parent niveau ${i + 1} introuvable`);
                return null;
            }
        }
        return parent;
    }
    createButton(parent) {
        if (document.querySelector(`.${this.config.buttonClass}`)) {
            logger.feature(this.featureName, "Bouton déjà présent");
            return;
        }
        const button = document.createElement("div");
        button.className = this.config.buttonClass;
        button.innerHTML = this.getSVG();
        button.addEventListener("click", e => {
            e.stopPropagation();
            e.preventDefault();
            logger.feature(this.featureName, "Bouton cliqué");
            this.config.action();
        });
        this.positionButton(button, parent);
        logger.success(`[${this.featureName}] Bouton injecté`);
    }
    positionButton(button, parent) {
        switch (this.config.position) {
          case "absolute-right":
            const container = parent.parentElement;
            if (container) {
                container.style.position = "relative";
                container.appendChild(button);
            }
            break;

          case "prepend-in-bookmark-container":
            parent.style.display = "flex";
            parent.style.alignItems = "center";
            parent.style.justifyContent = "flex-end";
            const btnWrapper = document.createElement("div");
            btnWrapper.style.cssText = "display: flex; align-items: center; order: 1;";
            btnWrapper.appendChild(button);
            const bookmarkDiv = parent.querySelector("div");
            if (bookmarkDiv) bookmarkDiv.style.order = "2";
            parent.prepend(btnWrapper);
            break;

          case "overlay-hover":
            this.createOverlay(button, parent);
            break;

          case "afterend":
          default:
            parent.insertAdjacentElement("afterend", button);
            break;
        }
    }
    createOverlay(button, parent) {
        const hasStory = this.detectStory();
        const overlay = document.createElement("div");
        overlay.className = this.config.buttonClass;
        if (hasStory) {
            overlay.classList.add("has-story");
            logger.feature(this.featureName, "Story détectée, zone centrale");
        }
        overlay.innerHTML = `\n      <svg fill="white" height="32" viewBox="0 0 24 24" width="32">\n        <circle cx="11" cy="11" r="6" fill="none" stroke="white" stroke-width="2"/>\n        <line x1="15.5" y1="15.5" x2="20" y2="20" stroke="white" stroke-width="2" stroke-linecap="round"/>\n      </svg>\n    `;
        overlay.addEventListener("click", e => {
            e.stopPropagation();
            e.preventDefault();
            this.config.action();
        });
        const overlayContainer = parent.tagName === "IMG" ? parent.parentElement : parent;
        overlayContainer.style.position = "relative";
        overlayContainer.appendChild(overlay);
        this.setupOverlayHover(overlay, overlayContainer, hasStory);
        logger.success(`[${this.featureName}] Overlay injecté`);
    }
    setupOverlayHover(overlay, container, hasStory) {
        if (hasStory) {
            container.addEventListener("mousemove", e => {
                const rect = container.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const distX = e.clientX - centerX;
                const distY = e.clientY - centerY;
                const distance = Math.sqrt(distX * distX + distY * distY);
                const radius = rect.width / 2 * .5;
                if (distance <= radius) {
                    overlay.style.opacity = "1";
                    overlay.style.pointerEvents = "auto";
                } else {
                    overlay.style.opacity = "0";
                    overlay.style.pointerEvents = "none";
                }
            });
            container.addEventListener("mouseleave", () => {
                overlay.style.opacity = "0";
                overlay.style.pointerEvents = "none";
            });
        } else {
            container.addEventListener("mouseenter", () => {
                overlay.style.opacity = "1";
                overlay.style.pointerEvents = "auto";
            });
            container.addEventListener("mouseleave", () => {
                overlay.style.opacity = "0";
                overlay.style.pointerEvents = "none";
            });
        }
    }
    observe() {
        this.observer = new MutationObserver(() => {
            const target = document.querySelector(this.config.selector);
            if (target) {
                const parent = this.getParent(target);
                if (parent) {
                    logger.success(`[${this.featureName}] Trouvé via observer`);
                    this.createButton(parent);
                    this.observer.disconnect();
                    this.observer = null;
                }
            }
        });
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    getSVG() {
        const {svgSize: svgSize, strokeWidth: strokeWidth} = this.config;
        return `\n      <svg aria-label="Download" fill="currentColor" height="${svgSize}" role="img" viewBox="0 0 24 24" width="${svgSize}">\n        <line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="${strokeWidth}" x1="12" x2="12" y1="3" y2="16"></line>\n        <polyline fill="none" points="16 12 12 16 8 12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="${strokeWidth}"></polyline>\n        <line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="${strokeWidth}" x1="4" x2="20" y1="21" y2="21"></line>\n      </svg>\n    `;
    }
    cleanup() {
        const button = document.querySelector(`.${this.config.buttonClass}`);
        if (button) {
            button.remove();
            logger.info(`[${this.featureName}] Bouton retiré`);
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
            logger.info(`[${this.featureName}] Observer arrêté`);
        }
    }
    detectStory() {
        const profileImg = getProfileImage();
        if (!profileImg) return false;
        const storyCanvas = profileImg.closest("div")?.querySelector(SELECTORS.STORY_CANVAS);
        if (storyCanvas) {
            logger.info("Story détectée (canvas)");
            return true;
        }
        const parentLink = profileImg.parentElement?.closest("a");
        const hasActiveStory = parentLink?.href?.includes("/stories/") && !parentLink?.href?.includes("/highlights/");
        if (hasActiveStory) {
            logger.info("Story détectée (lien)");
            return true;
        }
        return false;
    }
}

let currentPageType = null;

const activeInjectors = new Map;

let modalCheckInterval = null;

function handlePageChange(newPageType) {
    if (newPageType === currentPageType) {
        logger.info("Actualisation injecteurs");
    } else {
        logger.pageChange(currentPageType, newPageType);
    }
    activeInjectors.forEach(injector => injector.cleanup());
    activeInjectors.clear();
    currentPageType = newPageType;
    const features = PAGE_TYPES[newPageType]?.features || [];
    logger.info("Features à injecter:", features);
    features.forEach(featureName => {
        const injector = new ButtonInjector(featureName);
        activeInjectors.set(featureName, injector);
        injector.inject();
    });
}

function watchUrlChanges() {
    let lastUrl = location.href;
    const checkUrl = () => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            logger.urlChange(lastUrl, currentUrl);
            lastUrl = currentUrl;
            const newPageType = detectPageType();
            handlePageChange(newPageType);
            const modalPageTypes = [ "post", "reel" ];
            if (modalPageTypes.includes(newPageType)) {
                startModalCheck(currentUrl);
            } else {
                stopModalCheck();
            }
        }
    };
    handlePageChange(detectPageType());
    window.addEventListener("popstate", checkUrl);
    setTimeout(() => {
        logger.info("Installation des overrides pushState/replaceState");
        const originalPushState = history.pushState;
        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            checkUrl();
        };
        const originalReplaceState = history.replaceState;
        history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            checkUrl();
        };
    }, 1e3);
    setInterval(() => {
        checkUrl();
    }, 500);
}

function startModalCheck(postUrl) {
    if (modalCheckInterval) return;
    logger.info("Surveillance modal activée");
    modalCheckInterval = setInterval(() => {
        if (location.href !== postUrl) {
            logger.success("Modal fermé détecté");
            handlePageChange(detectPageType());
            stopModalCheck();
        }
    }, MODAL_CHECK_INTERVAL);
}

function stopModalCheck() {
    if (modalCheckInterval) {
        clearInterval(modalCheckInterval);
        modalCheckInterval = null;
        logger.info("Surveillance modal arrêtée");
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getProfileImageSrc") {
        const profileImg = getProfileImage();
        if (profileImg) {
            logger.info("Image src récupérée:", profileImg.src);
            sendResponse({
                imageSrc: profileImg.src
            });
        } else {
            sendResponse({
                imageSrc: null
            });
        }
        return true;
    }
});

logger.success("Extension chargée");

function init() {
    if (document.body) {
        watchUrlChanges();
    } else {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", watchUrlChanges);
        } else {
            setTimeout(init, 100);
        }
    }
}

init();