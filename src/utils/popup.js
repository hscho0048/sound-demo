export function ensurePopupRoot(id) {
  let root = document.getElementById(id);
  if (!root) {
    root = document.createElement('div');
    root.id = id;
    document.body.appendChild(root);
  }
  return root;
}

export function setPopupVisible(popup, visible) {
  if (!popup) return;
  popup.classList.toggle('hidden', !visible);
  popup.setAttribute('aria-hidden', String(!visible));
}

export function bindBackdropDismiss(popup, close) {
  popup?.addEventListener('click', (event) => {
    if (event.target === popup) {
      close();
    }
  });
}
