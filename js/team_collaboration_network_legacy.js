(function () {
  function parseMaybeJson(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    let value = el.textContent || '[]';
    try { value = JSON.parse(value); } catch (e) { return []; }
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch (e) { return []; }
    }
    return Array.isArray(value) ? value : [];
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  function normalizeRole(rawRole) {
    const role = String(rawRole || '').replace(/\d+$/g, '').trim();
    if (!role) return null;
    if (role === 'Principal Investigator') return 'PI';
    if (role === 'Co-supervised Students') return 'Co-supervised Students';
    if (/Intern/i.test(role)) return 'Intern';
    if (/Research|Postdoc|Administration/i.test(role)) return 'Researchers';
    if (/Student|Scholar/i.test(role)) return 'Students';
    return null;
  }

  function buildVariants(member) {
    const variants = new Set();
    const slugWords = String(member.slug || '').replace(/[-_]+/g, ' ');
    const first = member.first_name || '';
    const last = member.last_name || '';
    const title = member.title || '';
    [slugWords, title, `${first} ${last}`, `${last} ${first}`].forEach((value) => {
      const normalized = normalizeText(value);
      if (normalized) variants.add(normalized);
    });
    if (member.superuser || member.slug === 'admin') {
      ['admin', 'xiaotao shen', 'shen xiaotao', 'xiaotao', 'shen'].forEach(v => variants.add(v));
    }
    return Array.from(variants);
  }

  function getThemeColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
      label: isDark ? '#e5eefc' : '#1f2937',
      line: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.35)',
      ring: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)'
    };
  }

  function buildLayout(nodes, edges, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const n = nodes.length;
    const positions = nodes.map((node, i) => {
      const angle = (Math.PI * 2 * i) / Math.max(n, 1);
      const radius = Math.min(width, height) * 0.3;
      return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius, vx: 0, vy: 0 };
    });
    const indexById = new Map(nodes.map((n, i) => [n.id, i]));
    for (let iter = 0; iter < 320; iter++) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i], b = positions[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let dist2 = dx * dx + dy * dy + 0.01;
          let force = 9000 / dist2;
          let dist = Math.sqrt(dist2);
          dx /= dist; dy /= dist;
          a.vx -= dx * force; a.vy -= dy * force;
          b.vx += dx * force; b.vy += dy * force;
        }
      }
      function updateNodePosition(index) {
        const ref = nodeRefs[index];
        if (!ref) return;
        const p = positions[index];
        ref.halo.setAttribute('cx', p.x); ref.halo.setAttribute('cy', p.y);
        ref.circle.setAttribute('cx', p.x); ref.circle.setAttribute('cy', p.y);
        ref.label.setAttribute('x', p.x); ref.label.setAttribute('y', p.y + ref.radius + 18);
      }

      function updateEdgePosition(ref) {
        const a = positions[ref.ia], b = positions[ref.ib];
        ref.line.setAttribute('x1', a.x); ref.line.setAttribute('y1', a.y);
        ref.line.setAttribute('x2', b.x); ref.line.setAttribute('y2', b.y);
      }

      edges.forEach((edge) => {
        const i = indexById.get(edge.from), j = indexById.get(edge.to);
        if (i == null || j == null) return;
        const a = positions[i], b = positions[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ideal = 90 + edge.count * 12;
        const pull = (dist - ideal) * 0.004;
        dx /= dist; dy /= dist;
        a.vx += dx * pull; a.vy += dy * pull;
        b.vx -= dx * pull; b.vy -= dy * pull;
      });
      positions.forEach((p) => {
        p.vx += (centerX - p.x) * 0.0008;
        p.vy += (centerY - p.y) * 0.0008;
        p.vx *= 0.84; p.vy *= 0.84;
        p.x += p.vx; p.y += p.vy;
        p.x = Math.max(70, Math.min(width - 70, p.x));
        p.y = Math.max(70, Math.min(height - 70, p.y));
      });
    }
    return positions;
  }

  function initOne(root) {
    if (!root || root.dataset.ready === '1') return;
    root.dataset.ready = '1';
    try {
    const mount = root.querySelector('#team-collab-network-canvas');
    if (!mount) return;
    const members = parseMaybeJson('team-collab-members-data');
    const publications = parseMaybeJson('team-collab-publications-data');
    const palette = {
      'PI': '#d7263d',
      'Researchers': '#3367d6',
      'Students': '#7c3aed',
      'Co-supervised Students': '#f59e0b',
      'Intern': '#22b981'
    };
    const memberMap = new Map();
    const variantMap = new Map();
    members.forEach((member) => {
      const role = normalizeRole(member.role || (member.user_groups && member.user_groups[0]) || '');
      const groups = Array.isArray(member.user_groups) ? member.user_groups : [];
      const title = String(member.title || '').trim().toLowerCase();
      if (!role) return;
      if (groups.includes('Alumni')) return;
      if (title === 'we need you' || title === 'we want you' || title === 'we want you!') return;
      const normalizedMember = Object.assign({}, member, { category: role });
      memberMap.set(member.slug, normalizedMember);
      buildVariants(normalizedMember).forEach((variant) => {
        if (variant) variantMap.set(variant, normalizedMember.slug);
      });
    });
    const publicationCounts = new Map();
    const edgeCounts = new Map();
    function matchAuthor(name) { return variantMap.get(normalizeText(name)) || null; }
    publications.forEach((pub) => {
      const matched = [];
      (pub.authors || []).forEach((name) => {
        const slug = matchAuthor(name);
        if (slug && !matched.includes(slug)) matched.push(slug);
      });
      matched.forEach((slug) => publicationCounts.set(slug, (publicationCounts.get(slug) || 0) + 1));
      for (let i = 0; i < matched.length; i++) {
        for (let j = i + 1; j < matched.length; j++) {
          const pair = [matched[i], matched[j]].sort().join('__');
          edgeCounts.set(pair, (edgeCounts.get(pair) || 0) + 1);
        }
      }
    });
    const nodes = [];
    memberMap.forEach((member, slug) => {
      const count = publicationCounts.get(slug) || 0;
      nodes.push({ id: slug, label: member.title, value: count, category: member.category, color: palette[member.category], url: member.permalink });
    });
    const edges = [];
    edgeCounts.forEach((count, pair) => {
      const [from, to] = pair.split('__');
      const a = memberMap.get(from), b = memberMap.get(to);
      if (!a || !b) return;
      edges.push({ id: pair, from, to, count, pairUrl: `/publication/?pair=${pair}#container-publications`, title: `${a.title} & ${b.title}: ${count} shared publications` });
    });

    function render() {
      const width = mount.clientWidth || 900;
      const height = Math.max(760, Math.round(width * 0.7));
      const colors = getThemeColors();
      const positions = buildLayout(nodes, edges, width, height);
      const svgNS = 'http://www.w3.org/2000/svg';
      mount.innerHTML = '';
      const tooltip = document.createElement('div');
      tooltip.className = 'team-collab-network__tooltip';
      mount.appendChild(tooltip);
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', String(height));
      mount.appendChild(svg);
      const edgeLayer = document.createElementNS(svgNS, 'g');
      const nodeLayer = document.createElementNS(svgNS, 'g');
      svg.appendChild(edgeLayer);
      svg.appendChild(nodeLayer);
      const indexById = new Map(nodes.map((n, i) => [n.id, i]));
      const edgeRefs = [];
      const nodeRefs = [];
      function showTip(evt, html) {
        tooltip.innerHTML = html;
        tooltip.style.opacity = '1';
        const rect = mount.getBoundingClientRect();
        tooltip.style.left = `${evt.clientX - rect.left + 14}px`;
        tooltip.style.top = `${evt.clientY - rect.top + 14}px`;
      }
      function hideTip() { tooltip.style.opacity = '0'; }
      function updateNodePosition(index) {
        const ref = nodeRefs[index];
        if (!ref) return;
        const p = positions[index];
        ref.halo.setAttribute('cx', p.x); ref.halo.setAttribute('cy', p.y);
        ref.circle.setAttribute('cx', p.x); ref.circle.setAttribute('cy', p.y);
        ref.label.setAttribute('x', p.x); ref.label.setAttribute('y', p.y + ref.radius + 18);
      }

      function updateEdgePosition(ref) {
        const a = positions[ref.ia], b = positions[ref.ib];
        ref.line.setAttribute('x1', a.x); ref.line.setAttribute('y1', a.y);
        ref.line.setAttribute('x2', b.x); ref.line.setAttribute('y2', b.y);
      }

      edges.forEach((edge) => {
        const ia = indexById.get(edge.from), ib = indexById.get(edge.to);
        if (ia == null || ib == null) return;
        const a = positions[ia], b = positions[ib];
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        line.setAttribute('stroke', colors.line);
        line.setAttribute('stroke-width', 1 + edge.count * 1.35);
        line.setAttribute('stroke-linecap', 'round');
        line.style.cursor = 'pointer';
        line.addEventListener('mousemove', (evt) => showTip(evt, edge.title));
        line.addEventListener('mouseleave', hideTip);
        line.addEventListener('click', () => { window.location.href = edge.pairUrl; });
        edgeLayer.appendChild(line);
        edgeRefs.push({ line, ia, ib });
      });
      nodes.forEach((node, i) => {
        const p = positions[i];
        const radius = 10 + Math.sqrt(Math.max(1, node.value)) * 3.1;
        const g = document.createElementNS(svgNS, 'g');
        g.style.cursor = 'pointer';
        const halo = document.createElementNS(svgNS, 'circle');
        halo.setAttribute('cx', p.x); halo.setAttribute('cy', p.y);
        halo.setAttribute('r', radius + 5);
        halo.setAttribute('fill', colors.ring);
        g.appendChild(halo);
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', node.color);
        circle.setAttribute('stroke', '#ffffff');
        circle.setAttribute('stroke-width', '2');
        g.appendChild(circle);
        const label = document.createElementNS(svgNS, 'text');
        label.setAttribute('x', p.x);
        label.setAttribute('y', p.y + radius + 18);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', colors.label);
        label.setAttribute('font-size', '12');
        label.setAttribute('font-family', 'Manrope, sans-serif');
        label.textContent = node.label;
        g.appendChild(label);
        let dragging = false;
        let moved = false;
        let pointerId = null;
        const startDrag = (evt) => {
          dragging = true; moved = false; pointerId = evt.pointerId;
          g.setPointerCapture(pointerId);
        };
        const moveDrag = (evt) => {
          if (!dragging) { showTip(evt, `${node.label}<br>${node.value} publications`); return; }
          moved = true;
          const rect = svg.getBoundingClientRect();
          const nx = ((evt.clientX - rect.left) / rect.width) * width;
          const ny = ((evt.clientY - rect.top) / rect.height) * height;
          p.x = Math.max(70, Math.min(width - 70, nx));
          p.y = Math.max(70, Math.min(height - 70, ny));
          updateNodePosition(i);
          edgeRefs.forEach((ref) => { if (ref.ia === i || ref.ib === i) updateEdgePosition(ref); });
          showTip(evt, `${node.label}<br>${node.value} publications`);
        };
        const endDrag = (evt) => {
          if (!dragging) { hideTip(); return; }
          dragging = false;
          if (pointerId !== null) { try { g.releasePointerCapture(pointerId); } catch (e) {} }
          pointerId = null;
          if (!moved) window.location.href = node.url;
          hideTip();
        };
        g.addEventListener('pointerdown', startDrag);
        g.addEventListener('pointermove', moveDrag);
        g.addEventListener('pointerup', endDrag);
        g.addEventListener('pointerleave', function () { if (!dragging) hideTip(); });
        g.addEventListener('click', (evt) => { if (moved) evt.preventDefault(); });
        nodeLayer.appendChild(g);
        nodeRefs[i] = { halo, circle, label, radius };
      });
    }
    render();
    window.addEventListener('resize', function () {
      clearTimeout(window.__teamCollabResizeTimer);
      window.__teamCollabResizeTimer = setTimeout(render, 120);
    });
    } catch (error) {
      console.error('team collaboration network error', error);
      const mount = root.querySelector('#team-collab-network-canvas');
      if (mount) {
        mount.innerHTML = '<div class="team-collab-network__error">Network failed to render: ' + String(error && error.message || error) + '</div>';
      }
    }
  }

  function initAll() {
    document.querySelectorAll('#team-collab-network-root').forEach(initOne);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll, { once: true });
  } else {
    initAll();
  }
})();
