/* Decorative intracellular network: an illustration, not measured interactions. */
(function () {
  'use strict';
  document.querySelectorAll('.molecular-network-canvas').forEach(function (canvas) {
    if (canvas.dataset.ready) return;
    canvas.dataset.ready = '1';
    var section = canvas.closest('section');
    if (!section) return;
    section.prepend(canvas);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var width = 1, height = 1, visible = false, frame = 0, elapsed = 0, last = 0;
    var colors = ['242,130,148', '215,78,107', '255,190,198'];
    // Reproducible clusters evoke molecular complexes within a cellular field.
    var nodes = Array.from({ length: 96 }, function (_, i) {
      var group = i % 8, angle = i * 2.399963;
      var radius = 0.018 + ((i * 37) % 100) / 800;
      return { x: (group + 0.5) / 8 + Math.cos(angle) * radius,
        y: 0.5 + Math.sin(group * 2.4) * 0.25 + Math.sin(angle) * radius * 2,
        phase: angle, size: 1.5 + (i % 4) * 0.65, type: i % 3 };
    });
    var edges = [];
    nodes.forEach(function (a, i) {
      nodes.slice(i + 1).forEach(function (b, offset) {
        if (Math.hypot((a.x - b.x) * 2.5, a.y - b.y) < 0.23)
          edges.push([i, i + offset + 1]);
      });
    });
    function draw(t) {
      ctx.clearRect(0, 0, width, height);
      var wash = ctx.createLinearGradient(0, 0, width, height);
      wash.addColorStop(0, '#20141b'); wash.addColorStop(0.5, '#321a24'); wash.addColorStop(1, '#1b1319');
      ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height);
      // Soft elliptical boundaries suggest overlapping cellular compartments.
      for (var c = 0; c < 5; c++) {
        ctx.beginPath();
        ctx.ellipse(width * (c / 4), height * (0.45 + 0.12 * Math.sin(c)),
          width * 0.18, height * 0.73, 0.15 * Math.sin(t * 0.06 + c), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(204, 130, 146,0.09)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      var points = nodes.map(function (n) {
        return { x: n.x * width + Math.sin(t * 0.17 + n.phase) * 7,
          y: n.y * height + Math.cos(t * 0.13 + n.phase) * 9 };
      });
      edges.forEach(function (edge, i) {
        var a = points[edge[0]], b = points[edge[1]];
        var strength = 0.14 + 0.07 * Math.sin(t * 0.4 + i);
        ctx.strokeStyle = 'rgba(220, 140, 155,' + strength + ')'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (i % 5 !== 0) return;
        var progress = (t * 0.09 + i * 0.137) % 1;
        ctx.fillStyle = 'rgba(255, 200, 210,0.65)';
        ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * progress, a.y + (b.y - a.y) * progress, 1.6, 0, Math.PI * 2); ctx.fill();
      });
      nodes.forEach(function (n, i) {
        var p = points[i], color = colors[n.type];
        var glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, n.size * 5);
        glow.addColorStop(0, 'rgba(' + color + ',0.23)'); glow.addColorStop(1, 'rgba(' + color + ',0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, n.size * 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(' + color + ',0.8)';
        ctx.beginPath(); ctx.arc(p.x, p.y, n.size, 0, Math.PI * 2); ctx.fill();
      });
    }
    function tick(now) {
      elapsed += last ? Math.min(now - last, 50) / 1000 : 0;
      last = now; draw(elapsed * 0.5); frame = requestAnimationFrame(tick);
    }
    function update() {
      cancelAnimationFrame(frame); last = 0;
      if (visible && !document.hidden && !motion.matches) frame = requestAnimationFrame(tick);
      else draw(elapsed * 0.5);
    }
    function resize() {
      width = section.clientWidth; height = section.clientHeight;
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio; canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw(elapsed);
    }
    new ResizeObserver(resize).observe(section);
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; update(); }).observe(section);
    motion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    resize();
  });
})();
