export const placeholder = (title, body) => ({
  render(root) {
    root.innerHTML = `<section class="card"><h2>${title}</h2><p class="note">${body}</p></section>`;
  },
});
