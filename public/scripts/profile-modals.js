function updateCaptionInPlace(mediaId, newTitle) {
  const captionEl = document.querySelector(`[data-caption-for="${CSS.escape(String(mediaId))}"]`);
  const editBtn = document.querySelector(`[data-edit-caption-for="${CSS.escape(String(mediaId))}"]`);

  if (captionEl) {
    if (newTitle) {
      captionEl.textContent = newTitle;
      captionEl.className = 'text-sm font-medium mb-1';
    } else {
      captionEl.textContent = 'No caption';
      captionEl.className = 'text-sm text-gray-400 italic mb-1';
    }
  }

  if (editBtn) {
    editBtn.setAttribute(
      'onclick',
      `event.stopPropagation(); openEditCaptionModal(${JSON.stringify(mediaId)}, ${JSON.stringify(newTitle)})`
    );
  }
}

function getProfileAlbumOptions(excludeAlbum = '') {
  const albums = [...new Set(
    profileMedia
      .map(item => normalizeAlbum(item.album) || 'Misc')
      .filter(Boolean)
  )].sort((a, b) => {
    if (a === 'Misc') return 1;
    if (b === 'Misc') return -1;
    return a.localeCompare(b);
  });

  return albums.filter(album => album !== excludeAlbum);
}

function openBulkMoveModal(currentAlbum) {
  closeAllMediaMenus();

  const selectedIds = Array.from(window.selectedMediaIds || []);

  if (selectedIds.length === 0) {
    showToast('No items selected', 'error');
    return;
  }

  const existing = document.getElementById('bulkMoveModal');
  if (existing) existing.remove();

  const albums = getProfileAlbumOptions(currentAlbum);

  const modal = document.createElement('div');
  modal.id = 'bulkMoveModal';
  modal.className = 'fixed inset-0 bg-black/50 z-[90] flex items-center justify-center px-4';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Move selected items</h2>

      <p class="text-sm text-gray-600 mb-4">
        Move ${selectedIds.length} selected item${selectedIds.length === 1 ? '' : 's'} from <strong>${escapeHtml(currentAlbum)}</strong> to another album.
      </p>

      <div class="space-y-4">
        <div>
          <label class="text-sm font-medium text-[#1F2933] mb-1 block">From</label>
          <input
            type="text"
            value="${escapeHtml(currentAlbum)}"
            disabled
            class="w-full px-4 py-2.5 border border-[#E8DED2] rounded-lg bg-gray-50 text-gray-500"
          >
        </div>

        <div>
          <label class="text-sm font-medium text-[#1F2933] mb-1 block">To existing album</label>
          <select
            id="bulkMoveAlbumSelect"
            class="w-full px-4 py-2.5 border border-[#E8DED2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C76B4A]"
          >
            <option value="">Misc</option>
            ${albums.map(album => `<option value="${escapeHtml(album)}">${escapeHtml(album)}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="text-sm font-medium text-[#1F2933] mb-1 block">Or create new album</label>
          <input
            id="bulkMoveNewAlbumInput"
            type="text"
            placeholder="Example: Cruise 2026"
            class="w-full px-4 py-2.5 border border-[#E8DED2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C76B4A]"
          >
          <p class="text-xs text-gray-400 mt-1">If filled, this will override the dropdown.</p>
        </div>
      </div>

      <div class="flex justify-end gap-3 mt-6">
        <button
          id="cancelBulkMove"
          class="px-4 py-2 border border-[#E8DED2] rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          id="confirmBulkMove"
          class="px-4 py-2 bg-[#C76B4A] text-white rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Move
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cancelBtn = modal.querySelector('#cancelBulkMove');
  const moveBtn = modal.querySelector('#confirmBulkMove');
  const albumSelect = modal.querySelector('#bulkMoveAlbumSelect');
  const newAlbumInput = modal.querySelector('#bulkMoveNewAlbumInput');

  const closeModal = () => {
    document.removeEventListener('keydown', handleDocumentKeydown);
    modal.remove();
  };

  const handleMove = async () => {
    if (moveBtn.disabled) return;

    const selectedAlbum = albumSelect ? albumSelect.value.trim() : '';
    const newAlbum = newAlbumInput ? newAlbumInput.value.trim() : '';
    const finalAlbum = newAlbum || selectedAlbum;

    const finalNormalized = normalizeAlbum(finalAlbum) || 'Misc';
    const currentNormalized = normalizeAlbum(currentAlbum) || 'Misc';

    if (finalNormalized === currentNormalized) {
      showToast('Already in that album', 'error');
      return;
    }

    moveBtn.disabled = true;
    moveBtn.textContent = 'Moving...';

    try {
      for (const mediaId of selectedIds) {
        const res = await fetch(`/api/media/${mediaId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ album: finalAlbum })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.item) {
          profileMedia = profileMedia.map(item =>
            String(item.id) === String(mediaId) ? data.item : item
          );

          galleryMedia = galleryMedia.map(item =>
            String(item.id) === String(mediaId) ? data.item : item
          );
        }
      }

      if (window.selectedMediaIds && typeof window.selectedMediaIds.clear === 'function') {
        window.selectedMediaIds.clear();
      }

      if (typeof refreshProfileStats === 'function') {
        refreshProfileStats();
      }

      closeModal();

      const albumModal = document.getElementById('albumManagerModal');
      if (albumModal) {
        document.body.style.overflow = '';
        albumModal.remove();
      }

      showToast('Selected items moved');

      if (document.getElementById('userUploads')) {
        loadUserUploads();
      }
    } catch (err) {
      console.error(err);
      showToast('Bulk move error', 'error');
      moveBtn.disabled = false;
      moveBtn.textContent = 'Move';
    }
  };

  function handleDocumentKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  cancelBtn.onclick = closeModal;
  moveBtn.onclick = handleMove;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', handleDocumentKeydown);

  setTimeout(() => {
    if (albumSelect) albumSelect.focus();
  }, 0);
}

function openMoveMediaModal(mediaId, currentAlbum) {
  closeAllMediaMenus();

  const existing = document.getElementById('moveMediaModal');
  if (existing) existing.remove();

  const albums = getProfileAlbumOptions(currentAlbum);

  const modal = document.createElement('div');
  modal.id = 'moveMediaModal';
  modal.className = 'fixed inset-0 bg-black/50 z-[90] flex items-center justify-center px-4';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Move to album</h2>

      <p class="text-sm text-gray-600 mb-4">
        Move this media item from <strong>${escapeHtml(currentAlbum)}</strong> to another album.
      </p>

      <div class="space-y-4">
        <div>
          <label class="text-sm font-medium text-[#1F2933] mb-1 block">From</label>
          <input
            type="text"
            value="${escapeHtml(currentAlbum)}"
            disabled
            class="w-full px-4 py-2.5 border border-[#E8DED2] rounded-lg bg-gray-50 text-gray-500"
          >
        </div>

        <div>
          <label class="text-sm font-medium text-[#1F2933] mb-1 block">To existing album</label>
          <select
            id="moveAlbumSelect"
            class="w-full px-4 py-2.5 border border-[#E8DED2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C76B4A]"
          >
            <option value="">Misc</option>
            ${albums.map(album => `<option value="${escapeHtml(album)}">${escapeHtml(album)}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="text-sm font-medium text-[#1F2933] mb-1 block">Or create new album</label>
          <input
            id="moveNewAlbumInput"
            type="text"
            placeholder="Example: Cruise 2026"
            class="w-full px-4 py-2.5 border border-[#E8DED2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C76B4A]"
          >
          <p class="text-xs text-gray-400 mt-1">If filled, this will override the dropdown.</p>
        </div>
      </div>

      <div class="flex justify-end gap-3 mt-6">
        <button
          id="cancelMoveMedia"
          class="px-4 py-2 border border-[#E8DED2] rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          id="confirmMoveMedia"
          class="px-4 py-2 bg-[#C76B4A] text-white rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Move
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cancelBtn = modal.querySelector('#cancelMoveMedia');
  const moveBtn = modal.querySelector('#confirmMoveMedia');
  const albumSelect = modal.querySelector('#moveAlbumSelect');
  const newAlbumInput = modal.querySelector('#moveNewAlbumInput');

  const closeModal = () => {
    document.removeEventListener('keydown', handleDocumentKeydown);
    modal.remove();
  };

  const handleMove = async () => {
    if (moveBtn.disabled) return;

    const selectedAlbum = albumSelect ? albumSelect.value.trim() : '';
    const newAlbum = newAlbumInput ? newAlbumInput.value.trim() : '';
    const finalAlbum = newAlbum || selectedAlbum;

    const finalNormalized = normalizeAlbum(finalAlbum) || 'Misc';
    const currentNormalized = normalizeAlbum(currentAlbum) || 'Misc';

    if (finalNormalized === currentNormalized) {
      showToast('Already in that album', 'error');
      return;
    }

    moveBtn.disabled = true;
    moveBtn.textContent = 'Moving...';

    try {
      const res = await fetch(`/api/media/${mediaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ album: finalAlbum })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.item) {
        showToast(data.error || 'Move failed', 'error');
        moveBtn.disabled = false;
        moveBtn.textContent = 'Move';
        return;
      }

      profileMedia = profileMedia.map(item =>
        String(item.id) === String(mediaId) ? data.item : item
      );

      galleryMedia = galleryMedia.map(item =>
        String(item.id) === String(mediaId) ? data.item : item
      );

      const card = document.querySelector(`[data-media-card="${CSS.escape(String(mediaId))}"]`);
      if (card) card.remove();

      updateAlbumCountInPlace(currentAlbum);

      if (typeof refreshProfileStats === 'function') {
        refreshProfileStats();
      }

      closeModal();
      showToast('Media item moved');

      if (document.getElementById('userUploads')) {
        loadUserUploads();
      }
    } catch (err) {
      console.error(err);
      showToast('Move error', 'error');
      moveBtn.disabled = false;
      moveBtn.textContent = 'Move';
    }
  };

  function handleDocumentKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  cancelBtn.onclick = closeModal;
  moveBtn.onclick = handleMove;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', handleDocumentKeydown);

  setTimeout(() => {
    if (albumSelect) albumSelect.focus();
  }, 0);
}

function openDeleteMediaModal(mediaId, albumName) {
  closeAllMediaMenus();

  const existing = document.getElementById('deleteMediaModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'deleteMediaModal';
  modal.className = 'fixed inset-0 bg-black/50 z-[90] flex items-center justify-center px-4';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Delete media item?</h2>

      <p class="text-sm text-gray-600 leading-relaxed">
        This will permanently remove this photo or video from the gallery.
      </p>

      <div class="flex justify-end gap-3 mt-6">
        <button
          id="cancelDeleteMedia"
          class="px-4 py-2 border border-[#E8DED2] rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          id="confirmDeleteMedia"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Delete media item
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cancelBtn = modal.querySelector('#cancelDeleteMedia');
  const deleteBtn = modal.querySelector('#confirmDeleteMedia');

  const closeModal = () => {
    document.removeEventListener('keydown', handleDocumentKeydown);
    modal.remove();
  };

  const handleDelete = async () => {
    if (deleteBtn.disabled) return;

    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    try {
      const res = await fetch(`/api/media/${mediaId}`, {
        method: 'DELETE'
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error || 'Delete failed', 'error');
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete media item';
        return;
      }

      profileMedia = profileMedia.filter(item => String(item.id) !== String(mediaId));
      galleryMedia = galleryMedia.filter(item => String(item.id) !== String(mediaId));

      const card = document.querySelector(`[data-media-card="${CSS.escape(String(mediaId))}"]`);
      if (card) card.remove();

      updateAlbumCountInPlace(albumName);

      if (typeof refreshProfileStats === 'function') {
        refreshProfileStats();
      }

      closeModal();
      showToast('Media item deleted');
    } catch (err) {
      console.error(err);
      showToast('Delete error', 'error');
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete media item';
    }
  };

  function handleDocumentKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  cancelBtn.onclick = closeModal;
  deleteBtn.onclick = handleDelete;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', handleDocumentKeydown);
}

function openEditCaptionModal(mediaId, currentTitle) {
  closeAllMediaMenus();

  const existing = document.getElementById('editCaptionModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'editCaptionModal';
  modal.className = 'fixed inset-0 bg-black/50 z-[80] flex items-center justify-center px-4';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <h2 class="text-lg font-semibold mb-4">Edit Caption</h2>

      <input
        id="editCaptionInput"
        type="text"
        maxlength="120"
        value="${escapeHtml(currentTitle)}"
        placeholder="Caption"
        class="w-full px-4 py-2.5 border border-[#E8DED2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C76B4A]"
      >

      <p class="text-xs text-gray-400 mt-1">120 characters max</p>

      <div class="flex justify-end gap-3 mt-5">
        <button
          id="cancelEditCaption"
          class="px-4 py-2 border border-[#E8DED2] rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          id="saveEditCaption"
          class="px-4 py-2 bg-[#C76B4A] text-white rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const input = modal.querySelector('#editCaptionInput');
  const saveBtn = modal.querySelector('#saveEditCaption');
  const cancelBtn = modal.querySelector('#cancelEditCaption');

  const closeModal = () => {
    document.removeEventListener('keydown', handleDocumentKeydown);
    modal.remove();
  };

  const handleSave = async () => {
    const newTitle = input ? input.value.trim() : '';

    if (saveBtn.disabled) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const res = await fetch(`/api/media/${mediaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.item) {
        showToast(data.error || 'Update failed', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        return;
      }

      profileMedia = profileMedia.map(item =>
        String(item.id) === String(mediaId) ? data.item : item
      );

      galleryMedia = galleryMedia.map(item =>
        String(item.id) === String(mediaId) ? data.item : item
      );

      //updateCaptionInPlace(mediaId, newTitle);

      const captionEl = document.querySelector(`[data-caption-for="${CSS.escape(String(mediaId))}"]`);

      if (captionEl) {
        if (newTitle) {
          captionEl.textContent = newTitle;
          captionEl.className = 'text-sm font-medium mb-1';
        } else {
          captionEl.textContent = 'No caption';
          captionEl.className = 'text-sm text-gray-400 italic mb-1';
        }
      }

      closeModal();
      showToast('Caption updated');
    } catch (err) {
      console.error(err);
      showToast('Update error', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  };

  function handleDocumentKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  cancelBtn.onclick = closeModal;
  saveBtn.onclick = handleSave;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', handleDocumentKeydown);

  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

window.updateCaptionInPlace = updateCaptionInPlace;
window.openMoveMediaModal = openMoveMediaModal;
window.openBulkMoveModal = openBulkMoveModal;
window.openDeleteMediaModal = openDeleteMediaModal;
window.openEditCaptionModal = openEditCaptionModal;
