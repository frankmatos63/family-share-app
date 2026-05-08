const reactionPopStyle = document.createElement('style');
reactionPopStyle.textContent = `
@keyframes reactionEmojiPop {
  0% { transform: scale(1); }
  35% { transform: scale(1.25); }
  70% { transform: scale(0.96); }
  100% { transform: scale(1); }
}

.reaction-emoji-pop {
  animation: reactionEmojiPop 220ms cubic-bezier(0.22, 0.8, 0.3, 1);
}
`;
document.head.appendChild(reactionPopStyle);

let isReactionModalOpen = false;
let previousReactionBodyOverflow = '';

function getReactionConfig(reactionId) {
  return REACTION_CONFIG.find(r => r.id === reactionId);
}

function getInteractionForCurrentUser(item) {
  const username = galleryCurrentUser?.username;
  const interactions = Array.isArray(item?.interactions) ? item.interactions : [];

  return interactions.find(interaction => interaction.username === username) || null;
}

function getReactionUsers(item, reactionId) {
  const interactions = Array.isArray(item?.interactions) ? item.interactions : [];

  return interactions
    .filter(interaction => interaction.reactionId === reactionId)
    .map(interaction => interaction.username)
    .filter(Boolean);
}

function getActiveReactionEntries(item) {
  return REACTION_CONFIG
    .map(reaction => ({
      id: reaction.id,
      emoji: reaction.emoji,
      label: reaction.label,
      users: getReactionUsers(item, reaction.id)
    }))
    .filter(reaction => Array.isArray(reaction.users) && reaction.users.length > 0);
}

function lockReactionModalScroll() {
  previousReactionBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  isReactionModalOpen = true;
}

function unlockReactionModalScroll() {
  document.body.style.overflow = previousReactionBodyOverflow;
  isReactionModalOpen = false;
}

function closeReactionPickerModal() {
  const modal = document.getElementById('reactionPickerModal');
  if (modal) modal.remove();
  unlockReactionModalScroll();
}

function showReactionPicker(mediaId) {
  const item = galleryMedia.find(m => String(m.id) === String(mediaId));
  if (!item) return;

  const existing = document.getElementById('reactionPickerModal');
  if (existing) closeReactionPickerModal();

  const existingInteraction = getInteractionForCurrentUser(item);

  const modal = document.createElement('div');
  modal.id = 'reactionPickerModal';
  modal.dataset.mediaId = String(mediaId);
  modal.className = 'fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4';

  lockReactionModalScroll();

  const pickerButtons = REACTION_CONFIG.map(reaction => {
    const isActive = existingInteraction?.reactionId === reaction.id;

    return `
      <button
        type="button"
        onclick='event.stopPropagation(); handleReactionClick(this, ${JSON.stringify(item.id)}, ${JSON.stringify(reaction.id)})'
        class="w-9 h-9 rounded-full flex items-center justify-center text-xl transition ${
          isActive
            ? 'bg-[#F3D6C9]'
            : 'bg-[#FAF7F2] hover:bg-white hover:scale-105'
        }"
        title="${escapeHtml(reaction.label)}"
        aria-label="${escapeHtml(reaction.label)}"
      >
        ${reaction.emoji}
      </button>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="bg-white w-full sm:max-w-xs rounded-t-3xl sm:rounded-3xl shadow-xl px-4 py-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-[#1F2933]">React</h2>
        <button
          type="button"
          id="closeReactionPicker"
          class="w-7 h-7 rounded-full bg-[#FAF7F2] text-[#1F2933] flex items-center justify-center hover:bg-[#F0E7DC] transition"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      <div class="flex flex-wrap justify-center gap-2">
        ${pickerButtons}
      </div>

      <div class="mt-3">
        <input
          id="interactionNoteInput"
          type="text"
          maxlength="60"
          value="${escapeHtml(existingInteraction?.note || '')}"
          placeholder="Add a short note..."
          class="w-full px-3 py-2 text-sm border border-[#E8DED2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C76B4A]"
        >
      </div>

      <button
        type="button"
        id="saveInteractionNote"
        class="mt-3 w-full px-3 py-2 text-sm font-semibold rounded-xl bg-[#C76B4A] text-white hover:opacity-90 active:scale-[0.98] transition"
      >
        Save
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#closeReactionPicker').onclick = closeReactionPickerModal;

  modal.querySelector('#saveInteractionNote').onclick = async () => {
    const noteInput = document.getElementById('interactionNoteInput');
    await saveMediaInteraction(
      mediaId,
      existingInteraction?.reactionId || '',
      noteInput ? noteInput.value.trim() : ''
    );
    closeReactionPickerModal();
  };

  modal.addEventListener('mousedown', (e) => {
    if (e.target === modal) {
      modal.dataset.overlayMouseDown = 'true';
    }
  });

  modal.addEventListener('mouseup', (e) => {
    if (
      e.target === modal &&
      modal.dataset.overlayMouseDown === 'true'
    ) {
      closeReactionPickerModal();
    }

    modal.dataset.overlayMouseDown = 'false';
  });
}

function refreshOpenReactionPicker(mediaId) {
  const modal = document.getElementById('reactionPickerModal');
  if (!modal) return;

  const openMediaId = modal.dataset.mediaId;
  if (String(openMediaId) === String(mediaId)) {
    showReactionPicker(mediaId);
  }
}

function renderReactionRows(item) {
  const activeReactions = getActiveReactionEntries(item).slice(0, 3);

  const reactionSummary = activeReactions.length
    ? `
      <div class="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-full bg-white/90 border border-[#E8DED2] px-2 py-1 shadow-sm">
        ${activeReactions.map(reaction => `
          <span class="text-sm leading-none" title="${escapeHtml(reaction.label)}">
            ${reaction.emoji}
          </span>
        `).join('')}
      </div>
    `
    : '';

  return `
    ${reactionSummary}

    <button
      type="button"
      onclick='event.stopPropagation(); showReactionPicker(${JSON.stringify(item.id)})'
      class="absolute bottom-3 right-2.5 z-10 w-7 h-7 rounded-full bg-white/90 border border-[#E8DED2] text-[#1F2933] text-sm font-semibold flex items-center justify-center shadow-sm hover:bg-white active:scale-95 transition"
      title="Add reaction"
      aria-label="Add reaction"
    >
      +
    </button>
  `;
}

function handleReactionClick(button, mediaId, reactionId) {
  button.style.animation = 'none';
  button.offsetHeight;
  button.style.animation = null;
  button.classList.add('reaction-emoji-pop');

  const item = galleryMedia.find(m => String(m.id) === String(mediaId));
  const existingInteraction = getInteractionForCurrentUser(item);

  const noteInput = document.getElementById('interactionNoteInput');
  const note = noteInput ? noteInput.value.trim() : '';

  const nextReactionId =
    existingInteraction?.reactionId === reactionId ? '' : reactionId;

  saveMediaInteraction(mediaId, nextReactionId, note);
}

async function saveMediaInteraction(mediaId, reactionId = '', note = '') {
  try {
    const res = await fetch(`/api/media/${mediaId}/interact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reactionId, note })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.item) {
      replaceGalleryCard(data.item);
      refreshOpenReactionPicker(mediaId);
      return true;
    }

    showToast(data.error || 'Interaction failed', 'error');
    return false;
  } catch (err) {
    console.error(err);
    showToast('Interaction error', 'error');
    return false;
  }
}

document.addEventListener('touchmove', (e) => {
  if (!isReactionModalOpen) return;

  const modal = document.getElementById('reactionPickerModal');
  if (modal && !modal.contains(e.target)) {
    e.preventDefault();
  }
}, { passive: false });

window.saveMediaInteraction = saveMediaInteraction;
window.showReactionPicker = showReactionPicker;
window.handleReactionClick = handleReactionClick;
