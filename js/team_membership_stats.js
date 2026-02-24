(function () {
  function initTeamStatsWidget(root) {
    if (!root || root.dataset.ready === '1') return;
    root.dataset.ready = '1';

    var colors = {
      'PI': '#d7263d',
      'Researchers': '#2563eb',
      'Students': '#7c3aed',
      'Co-supervised Students': '#f59e0b',
      'Intern': '#10b981'
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

    var donutData = parseMaybeDoubleEncodedJSON((root.querySelector('.team-stats-donut-data') || {}).textContent || '[]', [])
      .filter(function (d) { return Number(d.count || 0) > 0; })
      .map(function (d) {
        return { label: d.label, count: Number(d.count || 0), color: colors[d.label] || '#64748b' };
      });
    var barData = parseMaybeDoubleEncodedJSON((root.querySelector('.team-stats-bar-data') || {}).textContent || '[]', []);
    var svg = root.querySelector('.team-donut-svg');
    var tooltip = root.querySelector('.team-stats-tooltip');
    var totalValue = root.querySelector('.team-donut-total__num');
    var totalTarget = Number((totalValue && totalValue.dataset.totalTarget) || 0);
    var hoveredArc = -1;
    var animated = false;
    var inView = false;
    var currentDonutProgress = 0;
    var donutAnimFrame = null;
    var barTimers = [];
    var startDelayTimer = null;
    var DONUT_DURATION = 1600;
    var COUNT_DURATION = 1400;
    var BAR_STAGGER = 60;
    var DONUT_FADE_DURATION = 420;

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
      track.setAttribute('stroke', document.body.classList.contains('dark') ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.22)');
      track.setAttribute('stroke-width', String(outer - inner));
      svg.appendChild(track);
      donutData.forEach(function (d, idx) {
        var sweep = (d.count / total) * 360 * progress;
        if (sweep <= 0.01) return;
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', donutArcPath(cx, cy, outer + (idx === hoveredArc ? 10 : 0), inner, angle, angle + sweep));
        path.setAttribute('fill', d.color);
        path.addEventListener('mouseenter', function (e) { hoveredArc = idx; renderDonut(progress); positionTooltip(e, d.label + ': ' + d.count); });
        path.addEventListener('mousemove', function (e) { positionTooltip(e, d.label + ': ' + d.count); });
        path.addEventListener('mouseleave', function () { hoveredArc = -1; renderDonut(progress); hideTooltip(); });
        svg.appendChild(path);
        angle += sweep;
      });
      var hole = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      hole.setAttribute('cx', '160');
      hole.setAttribute('cy', '160');
      hole.setAttribute('r', '72');
      hole.setAttribute('fill', document.body.classList.contains('dark') ? 'rgba(23,28,41,0.98)' : '#ffffff');
      svg.appendChild(hole);
    }
    function resetDonutHover() {
      hoveredArc = -1;
      hideTooltip();
      renderDonut(currentDonutProgress);
    }
    function animateCount(el, target, duration) {
      if (!el) return;
      var start = performance.now();
      function step(ts) {
        var p = Math.min(1, (ts - start) / duration);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    function animateBars() {
      var rows = Array.prototype.slice.call(root.querySelectorAll('.team-bar-row'));
      if (!rows.length && Array.isArray(barData)) return;
      var max = rows.reduce(function (m, row) { return Math.max(m, Number(row.dataset.count || 0)); }, 1);
      rows.forEach(function (row, i) {
        var count = Number(row.dataset.count || 0);
        var bar = row.querySelector('.team-bar-row__bar');
        var value = row.querySelector('.team-bar-row__value');
        var pct = max ? (count / max) * 100 : 0;
        var timer = setTimeout(function () {
          row.classList.add('is-revealed');
          if (bar) bar.style.width = pct + '%';
          if (value) value.style.opacity = '1';
        }, i * BAR_STAGGER);
        barTimers.push(timer);
        row.addEventListener('mouseenter', function (e) { row.classList.add('is-hover'); positionTooltip(e, count + ' publications'); });
        row.addEventListener('mousemove', function (e) { positionTooltip(e, count + ' publications'); });
        row.addEventListener('mouseleave', function () { row.classList.remove('is-hover'); hideTooltip(); });
      });
    }
    function resetBars() {
      barTimers.forEach(clearTimeout);
      barTimers = [];
      root.querySelectorAll('.team-bar-row').forEach(function (row) {
        row.classList.remove('is-revealed', 'is-hover');
        var bar = row.querySelector('.team-bar-row__bar');
        var value = row.querySelector('.team-bar-row__value');
        if (bar) bar.style.width = '0%';
        if (value) value.style.opacity = '0';
      });
    }
    function resetAll() {
      animated = false;
      if (startDelayTimer) {
        clearTimeout(startDelayTimer);
        startDelayTimer = null;
      }
      if (donutAnimFrame) {
        cancelAnimationFrame(donutAnimFrame);
        donutAnimFrame = null;
      }
      resetDonutHover();
      renderDonut(0);
      if (svg) svg.style.opacity = '0';
      if (totalValue) totalValue.textContent = '0';
      resetBars();
    }
    function start() {
      if (animated) return;
      animated = true;
      if (svg) {
        svg.style.transition = 'opacity ' + DONUT_FADE_DURATION + 'ms ease';
        svg.style.opacity = '1';
      }
      startDelayTimer = setTimeout(function () {
        if (!inView || !animated) return;
        var startTs = performance.now();
        var duration = DONUT_DURATION;
        function tick(ts) {
          var p = Math.min(1, (ts - startTs) / duration);
          renderDonut(1 - Math.pow(1 - p, 3));
          if (p < 1) donutAnimFrame = requestAnimationFrame(tick);
          else donutAnimFrame = null;
        }
        donutAnimFrame = requestAnimationFrame(tick);
        animateCount(totalValue, totalTarget, COUNT_DURATION);
        animateBars();
      }, DONUT_FADE_DURATION + 80);
    }

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
            if (!inView) {
              inView = true;
              resetAll();
              startDelayTimer = setTimeout(function () {
                if (inView) start();
              }, 120);
            }
          } else if (inView) {
            inView = false;
            resetAll();
          }
        });
      }, { threshold: 0.1 });
      io.observe(root);
    } else {
      setTimeout(start, 100);
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
