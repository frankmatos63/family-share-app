function lockBodyForViewer() {
  previousBodyOverflow = document.body.style.overflow;
  previousBodyTouchAction = document.body.style.touchAction;
  previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
  previousBodyPosition = document.body.style.position;
  previousBodyWidth = document.body.style.width;

  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
  document.body.style.overscrollBehavior = 'none';
  document.body.style.position = 'relative';
  document.body.style.width = '100%';
}

function unlockBodyForViewer() {
  document.body.style.overflow = previousBodyOverflow;
  document.body.style.touchAction = previousBodyTouchAction;
  document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
  document.body.style.position = previousBodyPosition;
  document.body.style.width = previousBodyWidth;
}

function closeMediaViewer() {
  if (!activeViewerModal) return;

  activeViewerModal.remove();
  activeViewerModal = null;

  if (activeViewerKeyHandler) {
    document.removeEventListener('keydown', activeViewerKeyHandler);
    activeViewerKeyHandler = null;
  }

  unlockBodyForViewer();
}

function openMediaViewer(item) {
  closeMediaViewer();
  lockBodyForViewer();

  const isImage = item.type === 'image';

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragBaseX = 0;
  let dragBaseY = 0;
  let lastTapTime = 0;
  let lastTouchDistance = null;

  const modal = document.createElement('div');
  modal.id = 'mediaLightbox';
  modal.className = 'fixed inset-0 z-[70] bg-black flex flex-col';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const mediaMarkup = isImage
    ? `
      <img
        id="viewerImage"
        src="${escapeHtml(item.url)}"
        alt=""
        draggable="false"
        class="max-w-full max-h-full object-contain select-none transition-transform duration-75 ease-out cursor-grab active:cursor-grabbing"
        style="touch-action: none; transform-origin: center center;"
      >
    `
    : `
      <video
        src="${escapeHtml(item.url)}"
        controls
        autoplay
        playsinline
        class="max-w-full max-h-full object-contain"
        style="touch-action: manipulation;"
      ></video>
    `;

  modal.innerHTML = `
    <div class="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-3 px-4 py-4 bg-gradient-to-b from-black/75 to-transparent">
      <div class="text-white text-sm font-medium truncate min-w-0">
        ${escapeHtml(String(item.title || '').trim())}
      </div>

      <div class="flex items-center gap-2 shrink-0">
        ${
          isImage
            ? `
              <div class="hidden sm:flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-2 py-1 text-white text-xs">
                <button id="zoomOutButton" type="button" class="w-7 h-7 rounded-full hover:bg-white/15 text-lg leading-none" aria-label="Zoom out">−</button>
                <span id="zoomLabel" class="w-11 text-center tabular-nums">100%</span>
                <button id="zoomInButton" type="button" class="w-7 h-7 rounded-full hover:bg-white/15 text-lg leading-none" aria-label="Zoom in">+</button>
                <button id="zoomResetButton" type="button" class="px-2 h-7 rounded-full hover:bg-white/15" aria-label="Reset zoom">Reset</button>
              </div>
            `
            : ''
        }

        <button
          id="closeMediaViewer"
          type="button"
          class="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white text-2xl leading-none flex items-center justify-center"
          aria-label="Close viewer"
        >
          ×
        </button>
      </div>
    </div>

    <div
      id="mediaViewerStage"
      class="flex-1 w-full h-full flex items-center justify-center px-3 py-16 overflow-hidden"
    >
      ${mediaMarkup}
    </div>
  `;

  activeViewerModal = modal;
  document.body.appendChild(modal);

  const closeButton = modal.querySelector('#closeMediaViewer');
  const stage = modal.querySelector('#mediaViewerStage');
  const img = modal.querySelector('#viewerImage');
  const zoomLabel = modal.querySelector('#zoomLabel');
  const zoomInButton = modal.querySelector('#zoomInButton');
  const zoomOutButton = modal.querySelector('#zoomOutButton');
  const zoomResetButton = modal.querySelector('#zoomResetButton');

  function getStageCenter() {
    const rect = stage.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function clampPan() {
    if (!img || scale <= 1) {
      translateX = 0;
      translateY = 0;
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const baseWidth = img.clientWidth || stageRect.width;
    const baseHeight = img.clientHeight || stageRect.height;

    const maxX = Math.max(0, (baseWidth * scale - stageRect.width) / 2);
    const maxY = Math.max(0, (baseHeight * scale - stageRect.height) / 2);

    translateX = clamp(translateX, -maxX, maxX);
    translateY = clamp(translateY, -maxY, maxY);
  }

  function updateZoomLabel() {
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  function applyTransform() {
    if (!img) return;

    clampPan();
    img.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    img.style.cursor = scale > 1 ? 'grab' : 'default';
    updateZoomLabel();
  }

  function setScaleAtPoint(nextScale, clientX = null, clientY = null) {
    const previousScale = scale;
    const newScale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);

    if (newScale === previousScale) {
      applyTransform();
      return;
    }

    if (clientX !== null && clientY !== null && previousScale > 0) {
      const center = getStageCenter();
      const pointX = clientX - center.x;
      const pointY = clientY - center.y;
      const ratio = newScale / previousScale;

      translateX = pointX - (pointX - translateX) * ratio;
      translateY = pointY - (pointY - translateY) * ratio;
    }

    scale = newScale;

    if (scale === 1) {
      translateX = 0;
      translateY = 0;
    }

    applyTransform();
  }

  function resetZoom() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
  }

  function zoomBy(delta, clientX = null, clientY = null) {
    setScaleAtPoint(scale + delta, clientX, clientY);
  }

  closeButton.onclick = (e) => {
    e.stopPropagation();
    closeMediaViewer();
  };

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target === stage) {
      closeMediaViewer();
    }
  });

  if (isImage && img) {
    zoomInButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      const center = getStageCenter();
      zoomBy(ZOOM_STEP, center.x, center.y);
    });

    zoomOutButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      const center = getStageCenter();
      zoomBy(-ZOOM_STEP, center.x, center.y);
    });

    zoomResetButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      resetZoom();
    });

    modal.addEventListener('wheel', (e) => {
      e.preventDefault();

      if (!e.ctrlKey) return;

      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      zoomBy(delta, e.clientX, e.clientY);
    }, { passive: false });

    img.addEventListener('mousedown', (e) => {
      if (scale <= 1) return;

      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragBaseX = translateX;
      dragBaseY = translateY;
      img.style.cursor = 'grabbing';
    });

    modal.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      translateX = dragBaseX + (e.clientX - dragStartX);
      translateY = dragBaseY + (e.clientY - dragStartY);
      applyTransform();
    });

    modal.addEventListener('mouseup', () => {
      isDragging = false;
      if (img) img.style.cursor = scale > 1 ? 'grab' : 'default';
    });

    modal.addEventListener('mouseleave', () => {
      isDragging = false;
      if (img) img.style.cursor = scale > 1 ? 'grab' : 'default';
    });

    img.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (scale === 1) {
        setScaleAtPoint(2, e.clientX, e.clientY);
      } else {
        resetZoom();
      }
    });

    img.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const now = Date.now();

        if (now - lastTapTime < 280) {
          e.preventDefault();
          const touch = e.touches[0];

          if (scale === 1) {
            setScaleAtPoint(2, touch.clientX, touch.clientY);
          } else {
            resetZoom();
          }

          lastTapTime = 0;
          return;
        }

        lastTapTime = now;

        if (scale > 1) {
          isDragging = true;
          dragStartX = e.touches[0].clientX;
          dragStartY = e.touches[0].clientY;
          dragBaseX = translateX;
          dragBaseY = translateY;
        }
      }

      if (e.touches.length === 2) {
        e.preventDefault();
        isDragging = false;
        lastTouchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });

    img.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();

        const newDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );

        if (lastTouchDistance) {
          const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const ratio = newDistance / lastTouchDistance;

          setScaleAtPoint(scale * ratio, centerX, centerY);
        }

        lastTouchDistance = newDistance;
        return;
      }

      if (e.touches.length === 1 && scale > 1 && isDragging) {
        e.preventDefault();

        translateX = dragBaseX + (e.touches[0].clientX - dragStartX);
        translateY = dragBaseY + (e.touches[0].clientY - dragStartY);
        applyTransform();
      }
    }, { passive: false });

    img.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        isDragging = false;
        lastTouchDistance = null;
      }
    });

    window.addEventListener('resize', applyTransform, { once: true });
    applyTransform();
  } else {
    modal.addEventListener('wheel', (e) => {
      e.preventDefault();
    }, { passive: false });
  }

  activeViewerKeyHandler = (e) => {
    if (e.key === 'Escape') {
      closeMediaViewer();
    }
  };

  document.addEventListener('keydown', activeViewerKeyHandler);
}

function openMediaViewerById(mediaId) {
  const item = galleryMedia.find(m => String(m.id) === String(mediaId));
  if (item) openMediaViewer(item);
}

window.openMediaViewer = openMediaViewer;
window.closeMediaViewer = closeMediaViewer;
window.openMediaViewerById = openMediaViewerById;
