async function requireAuth() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();

    if (!data.loggedIn) {
      window.location.href = '/login.html';
      return null;
    }

    return data.user;
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = '/login.html';
    return null;
  }
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Logout failed:', err);
    window.location.href = '/login.html';
  }
}
