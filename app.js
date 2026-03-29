/* ═══════════════════════════════════════════════
   PHILMONT 2025 — app.js
   Depends on: data.js (loaded first in index.html)
   Depends on: mapboxgl, Chart (loaded via CDN)
   ═══════════════════════════════════════════════ */

// ── STATE ─────────────────────────────────────────
let map;
let activeDay  = null;
let animating  = false;
let animFrame  = null;
let terrainOn  = true;
let satelliteOn = false;
let elevChart  = null;

// ── INIT ──────────────────────────────────────────
mapboxgl.accessToken = MAPBOX_TOKEN;

function initMap() {
  map = new mapboxgl.Map({
    container: 'map',
    style:     'mapbox://styles/mapbox/outdoors-v12',
    center:    TRIP.mapCenter,
    zoom:      TRIP.mapZoom,
    pitch:     TRIP.mapPitch,
    bearing:   TRIP.mapBearing,
    antialias: true,
  });

  map.addControl(new mapboxgl.NavigationControl(), 'top-right');

  map.on('load', onMapLoad);
}

function onMapLoad() {
  // Terrain DEM
  map.addSource('mapbox-dem', {
    type:    'raster-dem',
    url:     'mapbox://mapbox.mapbox-terrain-dem-v1',
    tileSize: 512,
    maxzoom:  14,
  });
  map.setTerrain({ source: 'mapbox-dem', exaggeration: TRIP.terrainExaggeration });

  // Atmosphere
  map.setFog({ range: [1, 12], color: '#e8e0d8', 'horizon-blend': 0.08 });

  // Sky
  map.addLayer({
    id:   'sky',
    type: 'sky',
    paint: {
      'sky-type': 'atmosphere',
      'sky-atmosphere-sun': [0.0, 90.0],
      'sky-atmosphere-sun-intensity': 15,
    },
  });

  addRouteLayers();
  addCampMarkers();
  addPhotoMarkers();
  buildSidebar();
  buildElevationChart();
  selectDay(1);
  hideLoading();
}

function hideLoading() {
  setTimeout(() => {
    const el = document.getElementById('loading');
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 900);
  }, 800);
}

// ── ROUTE LAYERS ──────────────────────────────────
function addRouteLayers() {
  // Full background route (dimmed)
  map.addSource('full-route', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: FULL_ROUTE } },
  });
  map.addLayer({
    id:     'route-bg',
    type:   'line',
    source: 'full-route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint:  { 'line-color': '#7a7065', 'line-width': 2.5, 'line-opacity': 0.35 },
  });

  // Active day segment (highlighted)
  map.addSource('active-segment', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
  });
  map.addLayer({
    id:     'active-route',
    type:   'line',
    source: 'active-segment',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint:  { 'line-color': '#c4622d', 'line-width': 4, 'line-opacity': 1, 'line-blur': 0.5 },
  });

  // Animation draw line (gold, draws progressively)
  map.addSource('anim-line', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
  });
  map.addLayer({
    id:     'anim-route',
    type:   'line',
    source: 'anim-line',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint:  { 'line-color': '#e8c46a', 'line-width': 4, 'line-opacity': 1 },
  });
}

function restoreRouteLayers() {
  // Called after a style swap (satellite toggle) rebuilds all sources/layers
  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url:  'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom:  14,
    });
  }
  if (terrainOn) map.setTerrain({ source: 'mapbox-dem', exaggeration: TRIP.terrainExaggeration });

  if (!map.getSource('full-route')) {
    map.addSource('full-route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: FULL_ROUTE } } });
    map.addLayer({ id: 'route-bg', type: 'line', source: 'full-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#7a7065', 'line-width': 2.5, 'line-opacity': 0.35 } });
  }
  if (!map.getSource('active-segment')) {
    map.addSource('active-segment', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({ id: 'active-route', type: 'line', source: 'active-segment', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#c4622d', 'line-width': 4, 'line-opacity': 1 } });
  }
  if (!map.getSource('anim-line')) {
    map.addSource('anim-line', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({ id: 'anim-route', type: 'line', source: 'anim-line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#e8c46a', 'line-width': 4 } });
  }

  if (activeDay) selectDay(activeDay);
}

// ── CAMP MARKERS ──────────────────────────────────
function addCampMarkers() {
  const colorMap = { staffed: '#c9972a', trail: '#4a7c4a', dry: '#7a7065', layover: '#4a7fa5' };

  DAYS.forEach(d => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      width:        '10px',
      height:       '10px',
      borderRadius: '50%',
      background:   colorMap[d.type] || '#7a7065',
      border:       '2px solid #f5f0e8',
      cursor:       'pointer',
      transition:   'transform 0.2s',
    });

    el.addEventListener('mouseenter', () => el.style.transform = 'scale(1.6)');
    el.addEventListener('mouseleave', () => el.style.transform = 'scale(1)');
    el.addEventListener('click',      () => selectDay(d.day));

    const popup = new mapboxgl.Popup({ className: 'camp-popup', offset: 12, closeButton: false })
      .setHTML(`
        <div class="popup-day">Day ${d.day}</div>
        <div class="popup-name">${d.name}</div>
        ${d.miles ? `<div class="popup-miles">${d.miles} mi · +${d.gain.toLocaleString()}'</div>` : ''}
      `);

    new mapboxgl.Marker({ element: el })
      .setLngLat(d.coords)
      .setPopup(popup)
      .addTo(map);
  });
}

// ── PHOTO MARKERS ─────────────────────────────────
function addPhotoMarkers() {
  PHOTOS.forEach((photo, i) => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      width:        '28px',
      height:       '28px',
      borderRadius: '50%',
      background:   '#1a1410',
      border:       '2px solid #c9972a',
      cursor:       'pointer',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'center',
      fontSize:     '12px',
      transition:   'transform 0.2s',
      boxShadow:    '0 2px 6px rgba(0,0,0,0.5)',
    });
    el.innerHTML  = '📷';
    el.title      = photo.title;

    el.addEventListener('mouseenter', () => el.style.transform = 'scale(1.3)');
    el.addEventListener('mouseleave', () => el.style.transform = 'scale(1)');
    el.addEventListener('click',      () => openModal(PHOTOS[i]));

    new mapboxgl.Marker({ element: el })
      .setLngLat(photo.coords)
      .addTo(map);
  });
}

// ── SIDEBAR ───────────────────────────────────────
function buildSidebar() {
  const list = document.getElementById('day-list');
  list.innerHTML = '';

  DAYS.forEach(d => {
    const item       = document.createElement('div');
    item.className   = 'day-item';
    item.id          = `day-item-${d.day}`;

    const playBtn    = document.createElement('button');
    playBtn.className = 'day-play-btn';
    playBtn.id       = `play-btn-${d.day}`;
    playBtn.title    = `Animate Day ${d.day}`;
    playBtn.textContent = '▶';
    playBtn.addEventListener('click', e => { e.stopPropagation(); playDay(d.day); });

    item.innerHTML = `
      <div class="day-num">${d.day}</div>
      <div class="day-info">
        <div class="day-camp">${d.name}</div>
        <div class="day-meta">${d.miles ? d.miles + ' mi · +' + d.gain.toLocaleString() + '\'' : 'Base Camp'}</div>
      </div>
    `;
    item.appendChild(playBtn);
    item.addEventListener('click', () => selectDay(d.day));
    list.appendChild(item);
  });
}

// ── DAY SELECTION ─────────────────────────────────
function selectDay(dayNum) {
  // Sidebar highlight
  document.querySelectorAll('.day-item').forEach(el => el.classList.remove('active'));
  const item = document.getElementById(`day-item-${dayNum}`);
  if (item) {
    item.classList.add('active');
    item.scrollIntoView({ block: 'nearest' });
  }

  activeDay = dayNum;
  const d   = DAYS[dayNum - 1];

  renderDayDetail(d);
  updateActiveSegment(dayNum);
  flyToSegment(dayNum);
}

function updateActiveSegment(dayNum) {
  const seg      = DAY_SEGMENTS[dayNum - 1];
  const segCoords = FULL_ROUTE.slice(seg.start, seg.end + 1);

  map.getSource('active-segment').setData({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: segCoords.length > 1 ? segCoords : [] },
  });
  map.getSource('anim-line').setData({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [] },
  });
}

function flyToSegment(dayNum) {
  const d        = DAYS[dayNum - 1];
  const seg      = DAY_SEGMENTS[dayNum - 1];
  const segCoords = FULL_ROUTE.slice(seg.start, seg.end + 1);

  if (segCoords.length > 1) {
    const bounds = segCoords.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(segCoords[0], segCoords[0])
    );
    map.fitBounds(bounds, { padding: 80, pitch: 55, bearing: -20, duration: 1200 });
  } else {
    map.flyTo({ center: d.coords, zoom: 12, pitch: 50, bearing: -15, duration: 1200 });
  }
}

// ── DAY DETAIL PANEL ──────────────────────────────
function renderDayDetail(d) {
  const panel = document.getElementById('day-detail');

  const campBadgeMap = { staffed: '★ Staffed', trail: '◆ Trail', dry: '○ Dry Camp', layover: '⟳ Layover' };
  const campBadge    = campBadgeMap[d.type] || '';

  const featureTags = d.features
    .map(f => `<span class="feature-tag">${f}</span>`)
    .join('');

  const dayPhotos = PHOTOS
    .map((p, i) => ({ ...p, _idx: i }))
    .filter(p => p.day === d.day);

  const photoGrid = dayPhotos.length
    ? dayPhotos.map(p => `
        <div class="photo-thumb" onclick="openModal(PHOTOS[${p._idx}])">
          ${p.thumb
            ? `<img src="${p.thumb}" alt="${p.title}">`
            : '<div class="photo-thumb-empty">📷</div>'}
        </div>`).join('')
    : `<div style="font-size:10px;color:var(--stone);font-style:italic;grid-column:1/-1;padding:4px 0;font-weight:300;">
         Add your photos for Day ${d.day}
       </div>`;

  panel.innerHTML = `
    <div id="detail-day-label">Day ${d.day} of 12 · ${campBadge}</div>
    <div id="detail-camp-name">${d.name}</div>
    <div id="detail-route">${d.from ? d.from + ' → ' + d.to : 'Trek begins here'}</div>

    <div class="detail-stats-row">
      <div class="d-stat">
        <div class="dv">${d.miles || '—'}</div>
        <div class="dl">Miles</div>
      </div>
      <div class="d-stat">
        <div class="dv">${d.gain ? '+' + d.gain.toLocaleString() + '\'' : '—'}</div>
        <div class="dl">Gain</div>
      </div>
      <div class="d-stat">
        <div class="dv">${d.loss ? '-' + d.loss.toLocaleString() + '\'' : '—'}</div>
        <div class="dl">Loss</div>
      </div>
      <div class="d-stat">
        <div class="dv">${d.elevation.toLocaleString() + '\''}</div>
        <div class="dl">Elev</div>
      </div>
    </div>

    <div id="detail-features">${featureTags}</div>
    <hr class="detail-divider">
    <div id="detail-narrative">${d.narrative}</div>
    <hr class="detail-divider">
    <div id="detail-photos-label">Photos from this day</div>
    <div id="detail-photo-grid">${photoGrid}</div>
    <button class="ctrl-btn detail-animate-btn" onclick="playDay(${d.day})">
      ▶ &nbsp;Animate Day ${d.day}
    </button>
  `;
}

// ── ANIMATION ─────────────────────────────────────
function playDay(dayNum) {
  if (animating) stopAnimation();

  selectDay(dayNum);

  const seg       = DAY_SEGMENTS[dayNum - 1];
  const segCoords = FULL_ROUTE.slice(seg.start, seg.end + 1);

  if (segCoords.length < 2) {
    alert('No route to animate for Day 1 — this is base camp arrival day.');
    return;
  }

  animating = true;
  document.getElementById('anim-bar').classList.add('visible');
  document.getElementById('anim-label').textContent = `Day ${dayNum}: ${DAYS[dayNum - 1].name}`;

  document.querySelectorAll('.day-play-btn').forEach(b => b.classList.remove('playing'));
  const pb = document.getElementById(`play-btn-${dayNum}`);
  if (pb) pb.classList.add('playing');

  // Clear active segment — anim-line takes over during playback
  map.getSource('active-segment').setData({
    type: 'Feature', geometry: { type: 'LineString', coordinates: [] },
  });

  const totalSteps = segCoords.length;
  const msPerStep  = 600;
  let step         = 0;

  map.flyTo({
    center:   segCoords[0],
    zoom:     12.5,
    pitch:    65,
    bearing:  computeBearing(segCoords[0], segCoords[Math.min(3, totalSteps - 1)]),
    duration: 1200,
    essential: true,
  });

  function tick() {
    if (!animating) return;
    if (step >= totalSteps) { stopAnimation(); return; }

    map.getSource('anim-line').setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: segCoords.slice(0, step + 1) },
    });

    if (step > 0 && step < totalSteps - 1) {
      map.easeTo({
        center:   segCoords[step],
        bearing:  computeBearing(segCoords[step], segCoords[Math.min(step + 2, totalSteps - 1)]),
        pitch:    62,
        zoom:     12.5,
        duration: msPerStep * 0.9,
        essential: true,
      });
    }

    step++;
    animFrame = setTimeout(tick, msPerStep);
  }

  setTimeout(tick, 1400);
}

function stopAnimation() {
  animating = false;
  if (animFrame) clearTimeout(animFrame);

  document.getElementById('anim-bar').classList.remove('visible');
  document.querySelectorAll('.day-play-btn').forEach(b => b.classList.remove('playing'));

  if (activeDay) {
    const seg       = DAY_SEGMENTS[activeDay - 1];
    const segCoords = FULL_ROUTE.slice(seg.start, seg.end + 1);

    map.getSource('active-segment').setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: segCoords.length > 1 ? segCoords : [] },
    });
    map.getSource('anim-line').setData({
      type: 'Feature', geometry: { type: 'LineString', coordinates: [] },
    });
  }
}

function computeBearing(from, to) {
  const toRad = d => d * Math.PI / 180;
  const [lon1, lat1] = from.map(toRad);
  const [lon2, lat2] = to.map(toRad);
  const dLon = lon2 - lon1;
  const x    = Math.sin(dLon) * Math.cos(lat2);
  const y    = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}

// ── MAP CONTROLS ──────────────────────────────────
function flyToOverview() {
  stopAnimation();
  map.flyTo({
    center:   TRIP.mapCenter,
    zoom:     TRIP.mapZoom,
    pitch:    50,
    bearing:  -20,
    duration: 1800,
    essential: true,
  });
}

function toggleTerrain() {
  terrainOn = !terrainOn;
  map.setTerrain(terrainOn ? { source: 'mapbox-dem', exaggeration: TRIP.terrainExaggeration } : null);
  document.getElementById('btn-terrain').classList.toggle('active', terrainOn);
}

function toggleSatellite() {
  satelliteOn = !satelliteOn;
  document.getElementById('btn-satellite').classList.toggle('active', satelliteOn);
  map.setStyle(satelliteOn
    ? 'mapbox://styles/mapbox/satellite-streets-v12'
    : 'mapbox://styles/mapbox/outdoors-v12'
  );
  map.once('styledata', () => setTimeout(restoreRouteLayers, 100));
}

// ── ELEVATION CHART ───────────────────────────────
function buildElevationChart() {
  const ctx = document.getElementById('elev-chart').getContext('2d');

  elevChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels:   ELEV_PROFILE.map((_, i) => i),
      datasets: [{
        data:        ELEV_PROFILE,
        borderColor: '#c4622d',
        borderWidth: 1.5,
        fill:        true,
        backgroundColor: context => {
          const g = context.chart.ctx.createLinearGradient(0, 0, 0, 72);
          g.addColorStop(0, 'rgba(196,98,45,0.35)');
          g.addColorStop(1, 'rgba(196,98,45,0.03)');
          return g;
        },
        tension:     0.3,
        pointRadius: 0,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `${ctx.raw.toLocaleString()}'` },
          backgroundColor: '#1a1410',
          borderColor:     '#7a7065',
          borderWidth:     1,
          titleColor:      '#c9972a',
          bodyColor:       '#f5f0e8',
          titleFont: { family: 'Source Serif 4, Georgia, serif', size: 10 },
          bodyFont:  { family: 'Source Serif 4, Georgia, serif', size: 11 },
        },
      },
      scales: {
        x: { display: false },
        y: {
          display: true,
          grid:    { color: 'rgba(255,255,255,0.05)', drawBorder: false },
          ticks: {
            color: '#7a7065',
            font:  { size: 8, family: 'Source Serif 4, Georgia, serif' },
            callback:     v => v >= 1000 ? (v / 1000).toFixed(1) + 'k\'' : v + '\'',
            maxTicksLimit: 4,
          },
          border: { display: false },
        },
      },
      onClick: (e, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        for (let i = DAY_SEGMENTS.length - 1; i >= 0; i--) {
          if (idx >= DAY_SEGMENTS[i].start) { selectDay(i + 1); break; }
        }
      },
    },
  });
}

// ── PHOTO MODAL ───────────────────────────────────
function openModal(photo) {
  const PLACEHOLDER = 'data:image/svg+xml,'
    + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">'
    + '<rect fill="#1a1410" width="600" height="400"/>'
    + '<text x="300" y="200" fill="#7a7065" text-anchor="middle" font-size="48">📷</text>'
    + '<text x="300" y="250" fill="#7a7065" text-anchor="middle" font-size="16" font-family="serif">Photo coming soon</text>'
    + '</svg>');

  document.getElementById('modal-img').src      = photo.url || PLACEHOLDER;
  document.getElementById('modal-title').textContent   = photo.title;
  document.getElementById('modal-caption').textContent = photo.caption || '';
  document.getElementById('modal-meta').textContent    = `Day ${photo.day} · ${DAYS[photo.day - 1]?.name || ''}`;
  document.getElementById('photo-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('photo-modal').classList.remove('open');
}

document.getElementById('photo-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('photo-modal')) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── START ─────────────────────────────────────────
initMap();
