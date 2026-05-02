async function loadHomePage() {
  try {
    const res = await fetch('/api/media');
    const data = await res.json();

    const totalCount = document.getElementById('totalCount');
    const albumCount = document.getElementById('albumCount');
    const recentCount = document.getElementById('recentCount');
    const recentPhotos = document.getElementById('recentPhotos');
    const dailyMessage = document.getElementById('dailyMessage');

    const validAlbums = data
      .map(item => normalizeAlbum(item.album))
      .filter(album => album && album !== 'Misc' && album !== 'Quick Upload');

    const albums = [...new Set(validAlbums)];
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
        <a
          href="gallery.html?media=${encodeURIComponent(item.id)}"
          class="group block bg-white rounded-2xl overflow-hidden border border-[#E8DED2] shadow-sm hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition duration-200 ease-out"
          aria-label="Open this media in Gallery"
        >
          <div class="h-32 sm:h-40 overflow-hidden bg-gray-100">
            ${item.type === 'image'
              ? `<img src="${escapeHtml(item.url)}" class="w-full h-full object-cover transition duration-300 ease-out group-hover:scale-105">`
              : `<video src="${escapeHtml(item.url)}" poster="${escapeHtml(item.thumbnailUrl || '')}" muted playsinline preload="metadata" class="w-full h-full object-cover transition duration-300 ease-out group-hover:scale-105"></video>`
            }
          </div>

          <div class="p-3">
            <p class="text-sm font-medium truncate h-5">
              ${caption ? escapeHtml(caption) : '&nbsp;'}
            </p>
            <p class="text-xs text-gray-500 mt-1">${formatDate(item.uploadedAt)}</p>
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
