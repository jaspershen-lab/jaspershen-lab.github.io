(function () {
  const CATEGORY_COLORS = {
    PI: '#d7263d',
    Researchers: '#3367d6',
    Students: '#7c3aed',
    'Co-supervised Students': '#f59e0b',
    Intern: '#22b981'
  };

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

  function normalizeRole(member) {
    const groups = Array.isArray(member.user_groups) ? member.user_groups : [];
    const rawRole = String(member.role || groups[0] || '').replace(/\d+$/g, '').trim();
    const title = String(member.title || '').toLowerCase();
    if (title === 'we need you' || title === 'we want you' || title === 'we want you!') return null;
    if (groups.includes('Alumni')) return null;
    if (/Academia|Visitor|Scholar/i.test(groups.join(' ')) || /visitor/i.test(rawRole)) return null;
    if (member.superuser || rawRole === 'Principal Investigator') return 'PI';
    if (rawRole === 'Co-supervised Students') return 'Co-supervised Students';
    if (/Intern/i.test(rawRole)) return 'Intern';
    if (/Research|Postdoc|Administration/i.test(rawRole)) return 'Researchers';
    if (/Student|Scholar/i.test(rawRole)) return 'Students';
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
    const isDark = document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark') ||
      document.body.classList.contains('dark-mode');
    return {
      label: isDark ? '#f8fafc' : '#1f2937',
      muted: isDark ? 'rgba(226,232,240,0.68)' : 'rgba(71,85,105,0.72)',
      line: isDark ? 'rgba(148,163,184,0.33)' : 'rgba(100,116,139,0.34)',
      lineActive: isDark ? 'rgba(153,246,228,0.88)' : 'rgba(15,118,110,0.72)',
      ring: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)'
    };
  }

  function initOne(root) {
    if (!root || root.dataset.ready === '1') return;
    root.dataset.ready = '1';

    const mount = root.querySelector('#team-collab-network-canvas');
    const panel = root.querySelector('#team-collab-network-panel');
    const statsEl = root.querySelector('#team-collab-network-stats');
    const searchInput = root.querySelector('#team-collab-search');
    const categorySelect = root.querySelector('#team-collab-category');
    const yearSelect = root.querySelector('#team-collab-year');
    const weightSelect = root.querySelector('#team-collab-weight');
    const resetButton = root.querySelector('#team-collab-reset');
    if (!mount) return;

    const rawMembers = parseMaybeJson('team-collab-members-data');
    const publications = parseMaybeJson('team-collab-publications-data');
    const memberMap = new Map();
    const variantMap = new Map();

    rawMembers.forEach((member) => {
      const category = normalizeRole(member);
      if (!category) return;
      const normalizedMember = Object.assign({}, member, {
        category,
        search: normalizeText([member.title, member.role, (member.interests || []).join(' ')].join(' '))
      });
      memberMap.set(member.slug, normalizedMember);
      buildVariants(normalizedMember).forEach((variant) => {
        if (variant) variantMap.set(variant, normalizedMember.slug);
      });
    });

    function matchAuthor(name) {
      return variantMap.get(normalizeText(name)) || null;
    }

    const publicationsByMember = new Map();
    const publicationCounts = new Map();
    const edgePublicationMap = new Map();
    const years = new Set();

    publications.forEach((pub) => {
      const year = String(pub.year || '').trim();
      if (year) years.add(year);
      const matched = [];
      (pub.authors || []).forEach((name) => {
        const slug = matchAuthor(name);
        if (slug && !matched.includes(slug)) matched.push(slug);
      });
      matched.forEach((slug) => {
        publicationCounts.set(slug, (publicationCounts.get(slug) || 0) + 1);
        if (!publicationsByMember.has(slug)) publicationsByMember.set(slug, []);
        publicationsByMember.get(slug).push(pub);
      });
      for (let i = 0; i < matched.length; i++) {
        for (let j = i + 1; j < matched.length; j++) {
          const pair = [matched[i], matched[j]].sort().join('__');
          if (!edgePublicationMap.has(pair)) edgePublicationMap.set(pair, []);
          edgePublicationMap.get(pair).push(pub);
        }
      }
    });

    if (yearSelect) {
      Array.from(years).sort().reverse().forEach((year) => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
      });
    }

    const baseNodes = Array.from(memberMap.entries()).map(([slug, member]) => ({
      id: slug,
      label: member.title,
      member,
      value: publicationCounts.get(slug) || 0,
      category: member.category,
      color: CATEGORY_COLORS[member.category] || '#64748b',
      url: member.permalink,
      pubs: publicationsByMember.get(slug) || []
    })).sort((a, b) => {
      const order = ['PI', 'Researchers', 'Students', 'Co-supervised Students', 'Intern'];
      return order.indexOf(a.category) - order.indexOf(b.category) || a.label.localeCompare(b.label);
    });

    const baseEdges = Array.from(edgePublicationMap.entries()).map(([pair, pubs]) => {
      const [from, to] = pair.split('__');
      const a = memberMap.get(from);
      const b = memberMap.get(to);
      if (!a || !b) return null;
      return {
        id: pair,
        from,
        to,
        count: pubs.length,
        pubs,
        title: `${a.title} & ${b.title}`,
        pairUrl: `/publication/?pair=${pair}#container-publications`
      };
    }).filter(Boolean);

    let selectedNode = null;
    let selectedEdge = null;
    let highlightedNode = null;
    let latestState = null;

    function currentFilters() {
      return {
        search: normalizeText(searchInput && searchInput.value),
        category: categorySelect ? categorySelect.value : '',
        year: yearSelect ? yearSelect.value : '',
        minWeight: Number(weightSelect && weightSelect.value || 1)
      };
    }

    function filterData() {
      const filters = currentFilters();
      let nodes = baseNodes.filter((node) => {
        if (filters.category && node.category !== filters.category) return false;
        if (filters.search && !node.member.search.includes(filters.search) && !normalizeText(node.label).includes(filters.search)) return false;
        if (filters.year && !node.pubs.some((pub) => String(pub.year) === filters.year)) return false;
        return true;
      });
      const allowed = new Set(nodes.map(node => node.id));
      let edges = baseEdges.filter((edge) => {
        if (!allowed.has(edge.from) || !allowed.has(edge.to)) return false;
        const yearPubs = filters.year ? edge.pubs.filter((pub) => String(pub.year) === filters.year) : edge.pubs;
        return yearPubs.length >= filters.minWeight;
      }).map((edge) => {
        const yearPubs = filters.year ? edge.pubs.filter((pub) => String(pub.year) === filters.year) : edge.pubs;
        return Object.assign({}, edge, { count: yearPubs.length, visiblePubs: yearPubs });
      });
      if (filters.minWeight > 1 || filters.year) {
        const connected = new Set();
        edges.forEach((edge) => { connected.add(edge.from); connected.add(edge.to); });
        nodes = nodes.filter((node) => connected.has(node.id) || node.category === 'PI');
      }
      return { nodes, edges, filters };
    }

    function updateStats(state) {
      if (!statsEl) return;
      const top = state.nodes.slice().sort((a, b) => b.value - a.value)[0];
      const shared = state.edges.reduce((sum, edge) => sum + edge.count, 0);
      statsEl.innerHTML = [
        ['Members', state.nodes.length],
        ['Links', state.edges.length],
        ['Shared papers', shared],
        ['Most connected', top ? top.label : 'NA']
      ].map(([label, value]) => `<span><strong>${value}</strong>${label}</span>`).join('');
    }

    function setPanelContent(html) {
      if (!panel) return;

      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel.classList.remove('is-panel-visible');
      panel.classList.add('is-panel-updating');
      panel.innerHTML = html;

      if (reduceMotion) {
        panel.classList.remove('is-panel-updating');
        panel.classList.add('is-panel-visible');
        return;
      }

      window.requestAnimationFrame(() => {
        panel.classList.remove('is-panel-updating');
        panel.classList.add('is-panel-visible');
      });
    }

    function layoutNodes(nodes, edges, width, height) {
      const cx = width / 2;
      const cy = height / 2;
      const ring = {
        PI: 0,
        Researchers: 0.22,
        Students: 0.36,
        'Co-supervised Students': 0.47,
        Intern: 0.56
      };
      const byCategory = new Map();
      nodes.forEach((node) => {
        if (!byCategory.has(node.category)) byCategory.set(node.category, []);
        byCategory.get(node.category).push(node);
      });
      const positions = new Map();
      const categories = ['PI', 'Researchers', 'Students', 'Co-supervised Students', 'Intern'];
      categories.forEach((category, categoryIndex) => {
        const group = byCategory.get(category) || [];
        const radius = Math.min(width, height) * (ring[category] || 0.45);
        group.forEach((node, i) => {
          const offset = categoryIndex * 0.48;
          const angle = group.length === 1 ? -Math.PI / 2 + offset : (Math.PI * 2 * i) / group.length + offset;
          positions.set(node.id, {
            x: category === 'PI' ? cx : cx + Math.cos(angle) * radius,
            y: category === 'PI' ? cy : cy + Math.sin(angle) * radius,
            vx: 0,
            vy: 0
          });
        });
      });
      for (let iter = 0; iter < 180; iter++) {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = positions.get(nodes[i].id);
            const b = positions.get(nodes[j].id);
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            const dist2 = dx * dx + dy * dy + 0.01;
            const dist = Math.sqrt(dist2);
            const force = 6200 / dist2;
            dx /= dist; dy /= dist;
            a.vx -= dx * force; a.vy -= dy * force;
            b.vx += dx * force; b.vy += dy * force;
          }
        }
        edges.forEach((edge) => {
          const a = positions.get(edge.from);
          const b = positions.get(edge.to);
          if (!a || !b) return;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ideal = 120 + edge.count * 10;
          const pull = (dist - ideal) * 0.0045;
          dx /= dist; dy /= dist;
          a.vx += dx * pull; a.vy += dy * pull;
          b.vx -= dx * pull; b.vy -= dy * pull;
        });
        nodes.forEach((node) => {
          const p = positions.get(node.id);
          const targetRadius = Math.min(width, height) * (ring[node.category] || 0.45);
          if (node.category === 'PI') {
            p.vx += (cx - p.x) * 0.015;
            p.vy += (cy - p.y) * 0.015;
          } else {
            const dx = p.x - cx;
            const dy = p.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const tx = cx + (dx / dist) * targetRadius;
            const ty = cy + (dy / dist) * targetRadius;
            p.vx += (tx - p.x) * 0.002;
            p.vy += (ty - p.y) * 0.002;
          }
          p.vx *= 0.82; p.vy *= 0.82;
          p.x += p.vx; p.y += p.vy;
          p.x = Math.max(76, Math.min(width - 76, p.x));
          p.y = Math.max(76, Math.min(height - 76, p.y));
        });
      }
      return positions;
    }

    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    }

    function topCollaborators(node, state) {
      return state.edges
        .filter(edge => edge.from === node.id || edge.to === node.id)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((edge) => {
          const otherId = edge.from === node.id ? edge.to : edge.from;
          const other = state.nodes.find(n => n.id === otherId);
          return other ? `<span class="team-collab-person-chip"><span>${escapeHtml(other.label)}</span><strong>${edge.count}</strong></span>` : '';
        }).join('');
    }

    function showNodePanel(node, state) {
      if (!panel) return;
      const links = state.edges.filter(edge => edge.from === node.id || edge.to === node.id);
      const interests = (node.member.interests || [])
        .slice(0, 6)
        .map(interest => `<span>${escapeHtml(interest)}</span>`)
        .join('');
      const pubs = node.pubs.slice(0, 5).map(pub => `
        <li>
          <a href="${pub.permalink}">${escapeHtml(pub.title)}</a>
          <span>${escapeHtml(pub.year)}</span>
        </li>`).join('');
      const collabs = topCollaborators(node, state) || '<p class="team-collab-profile__empty">No shared-paper links in current view.</p>';
      const initial = escapeHtml((node.label || '?').trim().charAt(0));
      setPanelContent(`
        <article class="team-collab-profile" style="--profile-accent: ${node.color || '#14b8a6'};">
          <div class="team-collab-profile__hero">
            <div class="team-collab-profile__glow" aria-hidden="true"></div>
            <div class="team-collab-profile__avatar-wrap">
              ${node.member.avatar ? `<img src="${node.member.avatar}" alt="${escapeHtml(node.label)}">` : `<div class="team-collab-profile__avatar">${initial}</div>`}
            </div>
            <span class="team-collab-profile__badge">${escapeHtml(node.category)}</span>
            <h3>${escapeHtml(node.label)}</h3>
            <p>${escapeHtml(node.member.role || 'Shen Lab member')}</p>
          </div>
          <div class="team-collab-profile__metrics">
            <div><strong>${node.value}</strong><span>Publications</span></div>
            <div><strong>${links.length}</strong><span>Collaborators</span></div>
          </div>
          ${interests ? `<section class="team-collab-profile__block"><h4>Research interests</h4><div class="team-collab-profile__chips">${interests}</div></section>` : ''}
          <section class="team-collab-profile__block">
            <h4>Top collaborators</h4>
            <div class="team-collab-profile__collabs">${collabs}</div>
          </section>
          <section class="team-collab-profile__block">
            <h4>Recent papers</h4>
            <ul class="team-collab-profile__papers">${pubs || '<li><span>No publications in current data.</span></li>'}</ul>
          </section>
          <a class="team-collab-profile__button" href="${node.url}">Open full profile</a>
        </article>`);
    }

    function showEdgePanel(edge, state) {
      if (!panel) return;
      const a = state.nodes.find(node => node.id === edge.from);
      const b = state.nodes.find(node => node.id === edge.to);
      const pubs = (edge.visiblePubs || edge.pubs).slice(0, 6).map(pub => `<li><a href="${pub.permalink}">${escapeHtml(pub.title)}</a><span>${escapeHtml(pub.year)}</span></li>`).join('');
      setPanelContent(`
        <div class="team-collab-detail">
          <p class="team-collab-detail__kicker">Shared publications</p>
          <h3>${escapeHtml(a ? a.label : edge.from)} + ${escapeHtml(b ? b.label : edge.to)}</h3>
          <div class="team-collab-detail__section"><strong>${edge.count} shared paper${edge.count === 1 ? '' : 's'}</strong><ul>${pubs}</ul></div>
          <a class="team-collab-detail__button" href="${edge.pairUrl}">View all publications</a>
        </div>`);
    }

    function resetPanel() {
      if (!panel) return;
      setPanelContent('<div class="team-collab-network__panel-empty"><i class="fas fa-circle-nodes" aria-hidden="true"></i><p>Select a member or collaboration link to explore details.</p></div>');
    }

    function render() {
      const state = filterData();
      latestState = state;
      updateStats(state);
      mount.innerHTML = '';
      if (!state.nodes.length) {
        mount.innerHTML = '<div class="team-collab-network__error">No members match the current filters.</div>';
        resetPanel();
        return;
      }
      const width = mount.clientWidth || 1000;
      const height = Math.max(760, Math.round(width * 0.68));
      const colors = getThemeColors();
      const positions = layoutNodes(state.nodes, state.edges, width, height);
      const svgNS = 'http://www.w3.org/2000/svg';
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

      const nodeRefs = new Map();
      const edgeRefs = [];

      function relatedSet(id) {
        const related = new Set([id]);
        state.edges.forEach((edge) => {
          if (edge.from === id) related.add(edge.to);
          if (edge.to === id) related.add(edge.from);
        });
        return related;
      }

      function applyFocus(id, edgeId) {
        const related = id ? relatedSet(id) : null;
        nodeRefs.forEach((ref, nodeId) => {
          const active = related ? related.has(nodeId) : (!edgeId || ref.edgeRelated);
          ref.g.classList.toggle('is-muted', !!(related && !active));
          ref.g.classList.toggle('is-selected', selectedNode === nodeId || highlightedNode === nodeId);
        });
        edgeRefs.forEach((ref) => {
          const connected = id ? (ref.edge.from === id || ref.edge.to === id) : ref.edge.id === edgeId;
          ref.line.classList.toggle('is-muted', !!(id && !connected));
          ref.line.classList.toggle('is-active', connected || selectedEdge === ref.edge.id);
        });
      }

      function showTip(evt, html) {
        tooltip.innerHTML = html;
        tooltip.style.opacity = '1';
        const rect = mount.getBoundingClientRect();
        tooltip.style.left = `${evt.clientX - rect.left + 14}px`;
        tooltip.style.top = `${evt.clientY - rect.top + 14}px`;
      }

      function hideTip() {
        tooltip.style.opacity = '0';
      }

      state.edges.forEach((edge) => {
        const a = positions.get(edge.from);
        const b = positions.get(edge.to);
        if (!a || !b) return;
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        line.setAttribute('stroke', colors.line);
        line.setAttribute('stroke-width', Math.min(8, 1.4 + edge.count * 1.2));
        line.setAttribute('stroke-linecap', 'round');
        line.classList.add('team-collab-edge');
        line.addEventListener('mousemove', (evt) => showTip(evt, `${escapeHtml(edge.title)}<br>${edge.count} shared papers`));
        line.addEventListener('mouseleave', hideTip);
        line.addEventListener('mouseenter', () => applyFocus(null, edge.id));
        line.addEventListener('click', () => {
          selectedEdge = edge.id;
          selectedNode = null;
          showEdgePanel(edge, state);
          applyFocus(null, edge.id);
        });
        edgeLayer.appendChild(line);
        edgeRefs.push({ line, edge });
      });

      state.nodes.forEach((node) => {
        const p = positions.get(node.id);
        if (!p) return;
        const radius = Math.min(28, 10 + Math.sqrt(Math.max(1, node.value)) * 3.2);
        const g = document.createElementNS(svgNS, 'g');
        g.classList.add('team-collab-node');
        g.style.cursor = 'pointer';
        const halo = document.createElementNS(svgNS, 'circle');
        halo.setAttribute('cx', p.x); halo.setAttribute('cy', p.y);
        halo.setAttribute('r', radius + 7);
        halo.setAttribute('fill', colors.ring);
        halo.classList.add('team-collab-node__halo');
        g.appendChild(halo);
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', node.color);
        circle.setAttribute('stroke', '#ffffff');
        circle.setAttribute('stroke-width', '2');
        circle.classList.add('team-collab-node__circle');
        g.appendChild(circle);
        const label = document.createElementNS(svgNS, 'text');
        label.setAttribute('x', p.x);
        label.setAttribute('y', p.y + radius + 18);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', colors.label);
        label.setAttribute('font-size', '12');
        label.setAttribute('font-weight', '800');
        label.setAttribute('font-family', 'Manrope, sans-serif');
        label.setAttribute('paint-order', 'stroke');
        label.setAttribute('stroke', document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || document.body.classList.contains('dark-mode') ? 'rgba(2, 6, 23, 0.86)' : 'rgba(255, 255, 255, 0.78)');
        label.setAttribute('stroke-width', '3');
        label.classList.add('team-collab-node__label');
        label.textContent = node.label;
        g.appendChild(label);
        g.addEventListener('mousemove', (evt) => showTip(evt, `<strong>${escapeHtml(node.label)}</strong><br>${escapeHtml(node.category)}<br>${node.value} publications`));
        g.addEventListener('mouseleave', () => { hideTip(); if (!selectedNode) applyFocus(null, selectedEdge); });
        g.addEventListener('mouseenter', () => { highlightedNode = node.id; applyFocus(node.id, null); });
        g.addEventListener('click', () => {
          selectedNode = node.id;
          selectedEdge = null;
          showNodePanel(node, state);
          applyFocus(node.id, null);
        });
        nodeLayer.appendChild(g);
        nodeRefs.set(node.id, { g, node });
      });

      if (selectedNode && nodeRefs.has(selectedNode)) applyFocus(selectedNode, null);
      else if (selectedEdge) applyFocus(null, selectedEdge);
      else resetPanel();
    }

    function resetFilters() {
      if (searchInput) searchInput.value = '';
      if (categorySelect) categorySelect.value = '';
      if (yearSelect) yearSelect.value = '';
      if (weightSelect) weightSelect.value = '1';
      selectedNode = null;
      selectedEdge = null;
      render();
    }

    [searchInput, categorySelect, yearSelect, weightSelect].forEach((control) => {
      if (!control) return;
      control.addEventListener('input', () => { selectedNode = null; selectedEdge = null; render(); });
      control.addEventListener('change', () => { selectedNode = null; selectedEdge = null; render(); });
    });
    if (resetButton) resetButton.addEventListener('click', resetFilters);

    render();
    window.addEventListener('resize', function () {
      clearTimeout(root.__teamCollabResizeTimer);
      root.__teamCollabResizeTimer = setTimeout(render, 140);
    });
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
