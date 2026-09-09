// app.js
(function () {
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function apiFetch(path, options) {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    if (response.status === 401) {
      window.location.href = '/index.html';
      throw new Error('No autenticado');
    }
    if (!response.ok) {
      throw new Error(`Error ${response.status} en ${path}`);
    }
    return response.json();
  }

  window.AyHungryCRM = { escapeHtml, apiFetch };
})();
