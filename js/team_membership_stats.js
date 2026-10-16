(function () {
  function initTeamStatsWidget(root) {
    if (!root || root.dataset.ready === '1') return;
    root.dataset.ready = '1';

    var colors = {
      'PI': '#d7263d',
      'Researchers': '#c64d64',
      'Students': '#a73c5a',
      'Co-supervised Students': '#d9828b',
      'Intern': '#a87880'
    };

    root.querySelectorAll('.team-donut-legend__item').forEach(function (el) {
      el.style.setProperty('--team-cat-color', colors[el.dataset.cat] || '#64748b');
    });
    root.querySelectorAll('.team-bar-row').forEach(function (row) {
      row.style.setProperty('--team-cat-color', colors[row.dataset.category] || '#64748b');
    });

    function parseMaybeDoubleEncodedJSON(text, fallback) {
      try {
        var x = JSON.parse(text || '');
        if (typeof x === 'string') x = JSON.parse(x);
        return x;
      } catch (e) {
        console.error('team stats JSON parse failed:', e, text);
        return fallback;
      }
    }

    var donutOrder = ['PI', 'Researchers', 'Students', 'Co-supervised Students', 'Intern'];
    var donutData = parseMaybeDoubleEncodedJSON((root.querySelector('.team-stats-donut-data') || {}).textContent || '[]', [])
      .filter(function (d) { return Number(d.count || 0) > 0; })
      .map(function (d) {
        return { label: d.label, count: Number(d.count || 0), color: colors[d.label] || '#64748b' };
      })
      .sort(function (a, b) {
        var ia = donutOrder.indexOf(a.label);
        var ib = donutOrder.indexOf(b.label);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
      });
    var svg = root.querySelector('.team-donut-svg');
    var tooltip = root.querySelector('.team-stats-tooltip');
    var totalValue = root.querySelector('.team-donut-total__num');
    var totalTarget = Number((totalValue && totalValue.dataset.totalTarget) || 0);
    var hoveredArc = -1;
    var animated = false;
    var currentDonutProgress = 0;
    var animationFrame = null;
    var motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    var ANIMATION_DURATION = 900;

    function polar(cx, cy, r, deg) {
      var rad = (deg - 90) * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }
    function donutArcPath(cx, cy, rOuter, rInner, startDeg, endDeg) {
      var startOuter = polar(cx, cy, rOuter, startDeg);
      var endOuter = polar(cx, cy, rOuter, endDeg);
      var startInner = polar(cx, cy, rInner, endDeg);
      var endInner = polar(cx, cy, rInner, startDeg);
      var large = (endDeg - startDeg) > 180 ? 1 : 0;
      return ['M', startOuter.x, startOuter.y, 'A', rOuter, rOuter, 0, large, 1, endOuter.x, endOuter.y, 'L', startInner.x, startInner.y, 'A', rInner, rInner, 0, large, 0, endInner.x, endInner.y, 'Z'].join(' ');
    }
    function positionTooltip(evt, text) {
      if (!tooltip) return;
      tooltip.textContent = text;
      tooltip.hidden = false;
      tooltip.style.left = ((evt.clientX || 0) + 14) + 'px';
      tooltip.style.top = ((evt.clientY || 0) + 14) + 'px';
    }
    function hideTooltip() {
      if (tooltip) tooltip.hidden = true;
    }
    function renderDonut(progress) {
      if (!svg) return;
      currentDonutProgress = progress;
      var cx = 160, cy = 160, outer = 122, inner = 76;
      var total = donutData.reduce(function (s, d) { return s + d.count; }, 0) || 1;
      var angle = 0;
      svg.innerHTML = '';
      var track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      track.setAttribute('cx', '160');
      track.setAttribute('cy', '160');
      track.setAttribute('r', String((outer + inner) / 2));
      track.setAttribute('fill', 'none');
      track.setAttribute('stroke', document.body.classList.contains('dark') ? 'rgba(148, 163, 184,0.18)' : 'rgba(148, 163, 184,0.22)');
      track.setAttribute('stroke-width', String(outer - inner));
      svg.appendChild(track);
      donutData.forEach(function (d, idx) {
        var sliceFrac = (d.count / total);
        var startFrac = angle / 360;
        var endFrac = startFrac + sliceFrac;
        var localProgress = 0;
        if (progress <= startFrac) {
          localProgress = 0;
        } else if (progress >= endFrac) {
          localProgress = 1;
        } else {
          localProgress = (progress - startFrac) / Math.max(sliceFrac, 1e-6);
        }
        var sweep = sliceFrac * 360 * localProgress;
        if (sweep > 0.01) {
          var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', donutArcPath(cx, cy, outer + (idx === hoveredArc ? 10 : 0), inner, angle, angle + sweep));
          path.setAttribute('fill', d.color);
          path.addEventListener('mouseenter', function (e) { hoveredArc = idx; renderDonut(currentDonutProgress); positionTooltip(e, d.label + ': ' + d.count); });
          path.addEventListener('mousemove', function (e) { positionTooltip(e, d.label + ': ' + d.count); });
          path.addEventListener('mouseleave', function () { hoveredArc = -1; renderDonut(currentDonutProgress); hideTooltip(); });
          svg.appendChild(path);
        }
        angle += sliceFrac * 360;
      });
      var hole = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      hole.setAttribute('cx', '160');
      hole.setAttribute('cy', '160');
      hole.setAttribute('r', '72');
      hole.setAttribute('fill', document.body.classList.contains('dark') ? 'rgba(23, 28, 41,0.98)' : '#ffffff');
      svg.appendChild(hole);
    }
    function resetDonutHover() {
      hoveredArc = -1;
      hideTooltip();
      renderDonut(currentDonutProgress);
    }
    // Both charts and the total use one clock and one easing curve.
    var rows = Array.prototype.slice.call(root.querySelectorAll('.team-bar-row'));
    var maxCount = rows.reduce(function (max, row) {
      return Math.max(max, Number(row.dataset.count || 0));
    }, 1);
    var bars = rows.map(function (row) {
      var count = Number(row.dataset.count || 0);
      var bar = row.querySelector('.team-bar-row__bar');
      var value = row.querySelector('.team-bar-row__value');
      row.style.transition = 'none';
      row.classList.add('is-revealed');
      if (bar) {
        bar.style.width = (count / maxCount * 100) + '%';
        bar.style.transformOrigin = 'left center';
        bar.style.transition = 'none';
        bar.style.transform = 'scaleX(0)';
      }
      if (value) { value.style.transition = 'none'; value.style.opacity = '1'; }
      row.addEventListener('mouseenter', function (e) {
        row.classList.add('is-hover'); positionTooltip(e, count + ' publications');
      });
      row.addEventListener('mousemove', function (e) { positionTooltip(e, count + ' publications'); });
      row.addEventListener('mouseleave', function () { row.classList.remove('is-hover'); hideTooltip(); });
      return bar;
    });
    function renderProgress(progress) {
      renderDonut(progress);
      bars.forEach(function (bar) { if (bar) bar.style.transform = 'scaleX(' + progress + ')'; });
      if (totalValue) totalValue.textContent = String(Math.round(totalTarget * progress));
    }
    function finish() {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
      renderProgress(1);
    }
    function start() {
      if (animated) return;
      animated = true;
      if (svg) { svg.style.transition = 'none'; svg.style.opacity = '1'; }
      if (motionPreference.matches) { finish(); return; }
      var startTime = null;
      function tick(now) {
        if (startTime === null) startTime = now;
        var progress = Math.min(1, (now - startTime) / ANIMATION_DURATION);
        renderProgress(1 - Math.pow(1 - progress, 3));
        if (progress < 1) animationFrame = requestAnimationFrame(tick);
        else animationFrame = null;
      }
      animationFrame = requestAnimationFrame(tick);
    }
    motionPreference.addEventListener('change', function () {
      if (motionPreference.matches && animated) finish();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && animated) finish();
    });

    renderDonut(0);
    if (svg) {
      svg.addEventListener('mousemove', function (e) {
        var t = e.target;
        if (!t || (t.tagName || '').toLowerCase() !== 'path') {
          if (hoveredArc !== -1) resetDonutHover();
        }
      });
      svg.addEventListener('mouseleave', resetDonutHover);
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            start();
            io.unobserve(root);
          }
        });
      }, { threshold: 0.1 });
      io.observe(root);
    } else {
      start();
    }
  }

  function boot() {
    document.querySelectorAll('.team-stats-widget').forEach(function (root) {
      try { initTeamStatsWidget(root); } catch (e) { console.error(e); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', boot);
})();
