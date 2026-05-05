const reactionPopStyle = document.createElement('style');
reactionPopStyle.textContent = `
@keyframes reactionEmojiPop {
  0% { transform: scale(1); }
  35% { transform: scale(1.35); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

.reaction-emoji-pop {
  animation: reactionEmojiPop 240ms cubic-bezier(0.22, 0.8, 0.3, 1);
}
`;
document.head.appendChild(reactionPopStyle);

let isReactionModalOpen = false;
let previousReactionBodyOverflow = '';

function getReactionConfig(reactionId) {
  return REACTION_CONFIG.find(r => r.id === reactionId);
}

function getReactionUsers(item, reactionId) {
  const reactions = item.reactions || {};
  return Array.isArray(reactions[reactionId]) ? reactions[reactionId] : [];
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

  const username = galleryCurrentUser?.username;

  const modal = document.createElement('div');
  modal.id = 'reactionPickerModal';
  modal.dataset.mediaId = String(mediaId);
  modal.className = 'fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4';

  lockReactionModalScroll();

  const pickerButtons = REACTION_CONFIG.map(reaction => {
    const users = getReactionUsers(item, reaction.id);
    const isActive = username && users.includes(username);

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
        >
          ×
        </button>
      </div>

      <div class="flex flex-wrap justify-center gap-2">
        ${pickerButtons}
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#closeReactionPicker').onclick = closeReactionPickerModal;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeReactionPickerModal();
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

  reactToMedia(mediaId, reactionId);
}

async function reactToMedia(mediaId, reactionId) {
  try {
    const res = await fetch(`/api/media/${mediaId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reactionId })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.item) {
      replaceGalleryCard(data.item);
      refreshOpenReactionPicker(mediaId);
    } else {
      showToast(data.error || 'Reaction failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Reaction error', 'error');
  }
}

document.addEventListener('touchmove', (e) => {
  if (!isReactionModalOpen) return;

  const modal = document.getElementById('reactionPickerModal');
  if (modal && !modal.contains(e.target)) {
    e.preventDefault();
  }
}, { passive: false });

window.reactToMedia = reactToMedia;
window.showReactionPicker = showReactionPicker;
window.handleReactionClick = handleReactionClick;
