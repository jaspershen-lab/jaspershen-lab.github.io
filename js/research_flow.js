(function () {
  document.querySelectorAll('.research-flow').forEach(function (root) {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    function update() {
      root.classList.toggle('is-running', root.dataset.visible === '1' && !document.hidden);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        root.dataset.visible = entries[0].isIntersecting ? '1' : '0';
        update();
      }, {threshold: 0.15}).observe(root);
    } else { root.dataset.visible = '1'; update(); }
    document.addEventListener('visibilitychange', update);
  });
})();
