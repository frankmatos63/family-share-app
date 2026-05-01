async function loadHomePage() {
  try {
    const res = await fetch('/api/media');
    const data = await res.json();

    const totalCount = document.getElementById('totalCount');
    const albumCount = document.getElementById('albumCount');
    const recentCount = document.getElementById('recentCount');
    const recentPhotos = document.getElementById('recentPhotos');
    const dailyMessage = document.getElementById('dailyMessage');

    const albums = [...new Set(data.map(item => normalizeAlbum(item.album)).filter(Boolean))];
    const recentItems = data.slice().reverse().slice(0, 3);

    if (totalCount) totalCount.textContent = data.length;
    if (albumCount) albumCount.textContent = albums.length;
    if (recentCount) recentCount.textContent = recentItems.length;
    if (dailyMessage) dailyMessage.textContent = getDailyMessage();

    if (!recentPhotos) return;

    if (recentItems.length === 0) {
      recentPhotos.innerHTML = '<p class="text-gray-500 col-span-full">No media yet.</p>';
      return;
    }

    recentPhotos.innerHTML = recentItems.map(item => {
      const caption = String(item.title || '').trim();

      return `
        <a href="gallery.html" class="block bg-white rounded-lg overflow-hidden border border-[#E8DED2] shadow-sm hover:shadow-md transition">
          <div class="h-32 sm:h-40 overflow-hidden bg-gray-100">
            ${item.type === 'image'
              ? `<img src="${escapeHtml(item.url)}" class="w-full h-full object-cover">`
              : `<video src="${escapeHtml(item.url)}" poster="${escapeHtml(item.thumbnailUrl || '')}" muted playsinline preload="metadata" class="w-full h-full object-cover"></video>`
            }
          </div>
          <div class="p-3">
            ${
              caption
                ? `<p class="text-sm font-medium truncate">${escapeHtml(caption)}</p>`
                : ''
            }
            <p class="text-xs text-gray-500 ${caption ? 'mt-1' : ''}">${formatDate(item.uploadedAt)}</p>
          </div>
        </a>
      `;
    }).join('');

  } catch (e) {
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('totalCount')) loadHomePage();
});
