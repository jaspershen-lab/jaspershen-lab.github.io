(function () {
  const canvas = document.getElementById('lab-hero-network-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const root = canvas.closest('.lab-hero__network');
  const pointer = { down: false, lastX: 0, lastY: 0 };
  const view = { yaw: -0.38, pitch: 0.08, zoom: 1.04 };
  const palette = {
    microbe: '#2dd4bf',
    metabolite: '#e23b2e',
    edge: 'rgba(180, 194, 220, 0.18)',
    edgeStrong: 'rgba(226, 232, 240, 0.34)'
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let hovered = null;
  let nodes = [];
  let links = [];

  function pseudo(seed) {
    const x = Math.sin(seed * 999.91) * 10000;
    return x - Math.floor(x);
  }

  function makeNetwork() {
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const nodeCount = mobile ? 44 : 122;
    const linkCount = mobile ? 58 : 210;
    const clusterCount = mobile ? 4 : 7;

    nodes = [];
    for (let i = 0; i < nodeCount; i += 1) {
      const type = pseudo(i + 2) > 0.72 ? 'microbe' : 'metabolite';
      const cluster = i % clusterCount;
      const clusterAngle = (cluster / clusterCount) * Math.PI * 2;
      const clusterRadius = 0.22 + pseudo(cluster + 18) * 0.38;
      const branch = (pseudo(i + 4) - 0.5) * 0.46;
      const spread = type === 'microbe' ? 0.34 : 0.48;
      const x = Math.cos(clusterAngle) * clusterRadius + (pseudo(i + 20) - 0.5) * spread + branch * 0.16;
      const y = Math.sin(clusterAngle * 0.82) * clusterRadius + (pseudo(i + 30) - 0.5) * spread * 1.18;
      const z = (pseudo(i + 40) - 0.5) * 0.72;
      const degreeHint = pseudo(i + 50);
      const radius = type === 'microbe'
        ? 6 + degreeHint * 18
        : 3.2 + Math.pow(degreeHint, 1.35) * 12;

      nodes.push({
        id: 'n' + i,
        type,
        x,
        y,
        z,
        r: radius,
        sx: 0,
        sy: 0,
        projectedRadius: radius
      });
    }

    const hubs = nodes
      .slice()
      .sort((a, b) => b.r - a.r)
      .slice(0, mobile ? 6 : 14);

    const used = new Set();
    links = [];
    function addLink(a, b, weight) {
      if (!a || !b || a === b) return;
      const key = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
      if (used.has(key)) return;
      used.add(key);
      links.push({ a, b, weight });
    }

    nodes.forEach((node, index) => {
      const hub = hubs[Math.floor(pseudo(index + 70) * hubs.length)];
      if (pseudo(index + 80) > 0.12) addLink(node, hub, 0.45 + pseudo(index + 81) * 0.8);
      if (index > 0 && pseudo(index + 90) > 0.34) addLink(node, nodes[Math.floor(pseudo(index + 91) * index)], 0.25 + pseudo(index + 92) * 0.65);
    });

    while (links.length < linkCount) {
      const a = nodes[Math.floor(pseudo(links.length + 120) * nodes.length)];
      const b = nodes[Math.floor(pseudo(links.length + 220) * nodes.length)];
      addLink(a, b, 0.2 + pseudo(links.length + 320) * 0.8);
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeNetwork();
    draw();
  }

  function project(node) {
    const cy = Math.cos(view.yaw);
    const sy = Math.sin(view.yaw);
    const cp = Math.cos(view.pitch);
    const sp = Math.sin(view.pitch);
    const px = node.x * cy - node.z * sy;
    const pz = node.x * sy + node.z * cy;
    const py = node.y * cp - pz * sp;
    const depth = node.y * sp + pz * cp;
    const mobile = width < 760;
    const scale = Math.min(width, height) * (mobile ? 0.64 : 0.88) * view.zoom;
    const centerX = mobile ? width * 0.58 : width * 0.70;
    const centerY = mobile ? height * 0.50 : height * 0.47;
    const depthScale = 1 + depth * 0.28;
    return {
      x: centerX + px * scale,
      y: centerY + py * scale,
      z: depth,
      r: Math.max(2, node.r * depthScale * view.zoom)
    };
  }

  function drawBackgroundMesh() {
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.045)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
      const x = width * (0.34 + i * 0.085);
      ctx.beginPath();
      ctx.moveTo(x, height * 0.06);
      ctx.lineTo(x + width * 0.18, height * 0.96);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLink(link) {
    const a = project(link.a);
    const b = project(link.b);
    const active = hovered && (hovered === link.a || hovered === link.b);
    const alpha = active ? 0.64 : Math.min(0.34, 0.10 + link.weight * 0.18);
    const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    gradient.addColorStop(0, 'rgba(45, 212, 191, ' + alpha + ')');
    gradient.addColorStop(0.5, 'rgba(180, 194, 220, ' + alpha * 0.72 + ')');
    gradient.addColorStop(1, 'rgba(226, 59, 46, ' + alpha + ')');
    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = active ? 2.2 : Math.max(0.7, link.weight * 1.6);
    ctx.shadowColor = active ? 'rgba(45, 212, 191, 0.22)' : 'rgba(226, 232, 240, 0)';
    ctx.shadowBlur = active ? 13 : 0;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawNode(node) {
    const p = project(node);
    node.sx = p.x;
    node.sy = p.y;
    node.projectedRadius = p.r;

    const active = hovered === node;
    const color = node.type === 'microbe' ? palette.microbe : palette.metabolite;
    const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.7);
    halo.addColorStop(0, node.type === 'microbe' ? 'rgba(45, 212, 191, 0.22)' : 'rgba(226, 59, 46, 0.18)');
    halo.addColorStop(1, 'rgba(6, 11, 29, 0)');

    ctx.save();
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.strokeStyle = active ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = active ? 2.4 : 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = active ? 28 : 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2.2, p.r * 0.58), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawTooltip() {
    if (!hovered || width < 760) return;
    const degree = links.filter((link) => link.a === hovered || link.b === hovered).length;
    const label = hovered.type === 'microbe' ? 'Microbe' : 'Metabolite';
    const x = Math.min(width - 160, hovered.sx + 15);
    const y = Math.max(18, hovered.sy - 17);
    ctx.save();
    ctx.fillStyle = 'rgba(8, 13, 32, 0.78)';
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.16)';
    ctx.lineWidth = 1;
    roundedRect(x, y, 140, 48, 13);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hovered.type === 'microbe' ? palette.microbe : palette.metabolite;
    ctx.font = '900 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(label, x + 13, y + 20);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.74)';
    ctx.font = '700 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Degree ' + degree, x + 13, y + 37);
    ctx.restore();
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawBackgroundMesh();
    links.forEach(drawLink);
    nodes
      .slice()
      .sort((a, b) => project(a).z - project(b).z)
      .forEach(drawNode);
    drawTooltip();
  }

  function pickNode(x, y) {
    let best = null;
    let bestDistance = Infinity;
    nodes.forEach((node) => {
      const p = project(node);
      const distance = Math.hypot(x - p.x, y - p.y);
      if (distance < Math.max(12, p.r * 0.75) && distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    });
    return best;
  }

  function localPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener('pointermove', (event) => {
    const point = localPoint(event);
    if (pointer.down) {
      view.yaw += (point.x - pointer.lastX) * 0.0065;
      view.pitch += (point.y - pointer.lastY) * 0.0045;
      view.pitch = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, view.pitch));
      draw();
    } else {
      const next = pickNode(point.x, point.y);
      if (next !== hovered) {
        hovered = next;
        draw();
      }
    }
    pointer.lastX = point.x;
    pointer.lastY = point.y;
  });

  canvas.addEventListener('pointerdown', (event) => {
    const point = localPoint(event);
    pointer.down = true;
    pointer.lastX = point.x;
    pointer.lastY = point.y;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointerup', (event) => {
    pointer.down = false;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch (error) {}
  });

  canvas.addEventListener('pointerleave', () => {
    if (!pointer.down && hovered) {
      hovered = null;
      draw();
    }
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    view.zoom = Math.max(0.72, Math.min(1.62, view.zoom + (event.deltaY > 0 ? -0.08 : 0.08)));
    draw();
  }, { passive: false });

  window.addEventListener('resize', resize);
  resize();

  if (root) root.dataset.heroNetworkReady = '1';
})();
