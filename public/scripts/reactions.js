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

function showReactionPicker(mediaId) {
  const item = galleryMedia.find(m => String(m.id) === String(mediaId));
  if (!item) return;

  const username = galleryCurrentUser?.username;
  const activeReactions = getActiveReactionEntries(item);

  const existing = document.getElementById('reactionPickerModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'reactionPickerModal';
  modal.dataset.mediaId = String(mediaId);
  modal.className = 'fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4';

  const activeSummary = activeReactions.length
    ? activeReactions.map(reaction => `
        <div class="flex items-center justify-between py-2 border-b border-[#F0E7DC] last:border-b-0">
          <div class="flex items-center gap-2">
            <span class="text-xl">${reaction.emoji}</span>
            <span class="text-sm text-[#1F2933]">${reaction.users.length}</span>
          </div>
          <div class="text-xs text-gray-500 truncate max-w-[190px]">
            ${escapeHtml(reaction.users.join(', '))}
          </div>
        </div>
      `).join('')
    : '<p class="text-sm text-gray-500 py-2">No reactions yet.</p>';

  const pickerButtons = REACTION_CONFIG.map(reaction => {
    const users = getReactionUsers(item, reaction.id);
    const isActive = username && users.includes(username);

    return `
      <button
        type="button"
        onclick='event.stopPropagation(); reactToMedia(${JSON.stringify(item.id)}, ${JSON.stringify(reaction.id)})'
        class="w-12 h-12 rounded-full border text-xl flex items-center justify-center transition active:scale-95 ${
          isActive
            ? 'bg-[#F3D6C9] text-[#8A3F2B] border-[#E8B8A3] shadow-sm'
            : 'bg-white text-[#1F2933] border-[#E8DED2] hover:bg-[#FAF7F2]'
        }"
        title="${escapeHtml(reaction.label)}"
      >
        ${reaction.emoji}
      </button>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold text-[#1F2933]">Reactions</h2>
        <button
          type="button"
          id="closeReactionPicker"
          class="w-8 h-8 rounded-full bg-[#FAF7F2] text-[#1F2933] flex items-center justify-center"
          aria-label="Close reactions"
        >
          ×
        </button>
      </div>

      <div class="mb-4 max-h-32 overflow-y-auto">
        ${activeSummary}
      </div>

      <div class="grid grid-cols-5 gap-3 justify-items-center">
        ${pickerButtons}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#closeReactionPicker').onclick = () => modal.remove();

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
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
  return `
    <div class="px-4 pb-4 pt-3 border-t border-[#F0E7DC]">
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          onclick='event.stopPropagation(); showReactionPicker(${JSON.stringify(item.id)})'
          class="text-xs font-medium text-gray-500 hover:text-[#1F2933] transition"
        >
          Reactions
        </button>

        <button
          type="button"
          onclick='event.stopPropagation(); showReactionPicker(${JSON.stringify(item.id)})'
          class="w-8 h-8 rounded-full border border-[#E8DED2] bg-[#FAF7F2] text-[#1F2933] text-lg leading-none flex items-center justify-center hover:bg-white transition"
          title="Add reaction"
        >
          +
        </button>
      </div>
    </div>
  `;
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

window.reactToMedia = reactToMedia;
window.showReactionPicker = showReactionPicker;
