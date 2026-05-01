/* ═══════════════════════════════════════════════
   PHILMONT 2025 — app.js
   Depends on: data.js (loaded first in index.html)
   Depends on: mapboxgl, Chart (loaded via CDN)
   ═══════════════════════════════════════════════ */

// ── STATE ─────────────────────────────────────────
let map;
let activeDay      = null;
let animating      = false;
let animPaused     = false;
let animFrame      = null;
let animPausedAt   = 0;   // elapsed ms at the moment of pause
let animStartTime  = null; // rAF timestamp when animation started (adjusted for resume)
let animTick       = null; // reference to current tick function for resume
let terrainOn      = true;
let satelliteOn    = true;
let elevChart      = null;
let progressMarker = null;
let _cameraPinImg  = null;

// ── CAMERA PIN ICON ───────────────────────────────
// Cleaned SVG from Illustrator — artifact paths/rect removed, styles inlined
const CAMERA_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
  <path fill="#fff" d="M364.32,599.52l159.77-153.21c41.13-39.44,13.21-108.89-43.77-108.89H159.69c-57.09,0-84.95,69.66-43.62,109.04l160.86,153.21c24.49,23.32,62.98,23.25,87.39-.15Z"/>
  <circle fill="#c9972a" stroke="#fff" stroke-miterlimit="10" stroke-width="50" cx="319.78" cy="284.75" r="238.75"/>
  <path fill="#fff" d="M269.71,181.15l-4.98,14.94h-35.77c-16.9,0-30.65,13.74-30.65,30.65v122.59c0,16.9,13.74,30.65,30.65,30.65h183.89c16.9,0,30.65-13.74,30.65-30.65v-122.59c0-16.9-13.74-30.65-30.65-30.65h-35.77l-4.98-14.94c-3.11-9.39-11.88-15.71-21.79-15.71h-58.81c-9.91,0-18.68,6.32-21.79,15.71ZM320.9,242.06c25.38,0,45.97,20.59,45.97,45.97s-20.59,45.97-45.97,45.97-45.97-20.59-45.97-45.97,20.59-45.97,45.97-45.97Z"/>
</svg>`;

function loadCameraPin(callback) {
  if (_cameraPinImg && map.hasImage('camera-pin')) { callback(); return; }
  const img = new Image(40, 40);
  img.onload = () => {
    if (!map.hasImage('camera-pin')) map.addImage('camera-pin', img);
    _cameraPinImg = img;
    callback();
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(CAMERA_PIN_SVG);
}

// ── INIT ──────────────────────────────────────────
mapboxgl.accessToken = MAPBOX_TOKEN;

function initMap() {
  map = new mapboxgl.Map({
    container: 'map',
    style:     'mapbox://styles/mapbox/satellite-streets-v12',
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
  loadCameraPin(addPhotoMarkers);
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
    map.addLayer({ 
      id: 'anim-route', 
      type: 'line', 
      source: 'anim-line',
      layout: { 
        'line-join': 'round', 
        'line-cap': 'round' 
      }, paint: { 
        'line-color': '#0daf2e', 
        'line-width': 6 
      } });
  }

  // Photo clustering layers — image must be re-added after style swap
  if (!map.getSource('photos')) {
    loadCameraPin(addPhotoMarkers);
  }

  if (activeDay) selectDay(activeDay);

  // Sync button states with initial defaults
  document.getElementById('btn-satellite').classList.toggle('active', satelliteOn);
  document.getElementById('btn-terrain').classList.toggle('active', terrainOn);
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
  const features = PHOTOS
    .map((p, i) => {
      if (p.lat == null || p.lng == null) return null;
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { idx: i } };
    })
    .filter(Boolean);

  map.addSource('photos', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
    cluster: true,
    clusterMaxZoom: 16,
    clusterRadius: 30,
  });

  // Cluster circle
  map.addLayer({
    id: 'photo-clusters',
    type: 'circle',
    source: 'photos',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#c9972a',
      'circle-radius': 10,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  });

  // Cluster count label
  map.addLayer({
    id: 'photo-cluster-count',
    type: 'symbol',
    source: 'photos',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['to-string', ['get', 'point_count']],
      'text-font': ['DIN Offc Pro bold', 'Arial Unicode MS Bold'],
      'text-size': 12,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#fff' },
  });

  // Single photo marker — camera pin icon
  map.addLayer({
    id: 'photo-singles',
    type: 'symbol',
    source: 'photos',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': 'camera-pin',
      'icon-size': 0.65,       // 640px SVG * 0.065 ≈ 42px rendered
      'icon-anchor': 'bottom',  // pin tip aligns with the coordinate
      'icon-allow-overlap': true,
    },
  });

  // Hover popup for singles
  const hoverPopup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 16,
    className: 'photo-hover-popup',
  });

  map.on('mouseenter', 'photo-singles', e => {
    map.getCanvas().style.cursor = 'pointer';
    const idx   = e.features[0].properties.idx;
    const photo = PHOTOS[idx];
    const caption = photo.caption || '';
    hoverPopup
      .setLngLat(e.features[0].geometry.coordinates)
      .setHTML(`<img src="${photo.url}" style="width:160px;height:110px;object-fit:cover;display:block;">
        ${caption ? `<div style="padding:4px 6px;font-size:11px;color:#f5f0e8;max-width:160px;">${caption}</div>` : ''}`)
      .addTo(map);
  });
  map.on('mouseleave', 'photo-singles', () => {
    map.getCanvas().style.cursor = '';
    hoverPopup.remove();
  });
  map.on('mouseenter', 'photo-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'photo-clusters', () => { map.getCanvas().style.cursor = ''; });

  // Click single — open lightbox
  map.on('click', 'photo-singles', e => {
    const idx = e.features[0].properties.idx;
    openModalGroup([idx], 0);
  });

  // Click cluster — gather all leaf photo indices, open lightbox
  map.on('click', 'photo-clusters', e => {
    const clusterId = e.features[0].properties.cluster_id;
    map.getSource('photos').getClusterLeaves(clusterId, Infinity, 0, (err, leaves) => {
      if (err || !leaves) return;
      const indices = leaves.map(f => f.properties.idx);
      openModalGroup(indices, 0);
    });
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
      </div>
    `;
    item.appendChild(playBtn);
    item.addEventListener('click', () => selectDay(d.day));
    list.appendChild(item);
  });
}

// ── DAY SELECTION ─────────────────────────────────
function selectDay(dayNum, skipCamera = false) {
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
  if (!skipCamera) flyToSegment(dayNum);
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
  const d         = DAYS[dayNum - 1];
  const seg       = DAY_SEGMENTS[dayNum - 1];
  const segCoords = FULL_ROUTE.slice(seg.start, seg.end + 1);

  const bearing = d.startBearing !== null
    ? d.startBearing
    : computeBearing(segCoords[0], segCoords[Math.min(3, segCoords.length - 1)]);

  const pitch = d.startPitch ?? 50;

  if (dayNum === 1) {
    map.flyTo({ center: [d.coords.lng, d.coords.lat], zoom: 15, pitch, bearing, duration: 1200 });
  } else {
    map.flyTo({ center: segCoords[0], zoom: 13, pitch, bearing, duration: 1200 });
  }
}

// ── DAY DETAIL PANEL ──────────────────────────────
function renderDayDetail(d) {
  const panel = document.getElementById('day-detail');

  /*
  const campBadgeMap = { staffed: '★ Staffed', trail: '◆ Trail', dry: '○ Dry Camp', layover: '⟳ Layover' };
  const campBadge    = campBadgeMap[d.type] || '';

  const featureTags = d.features
    .map(f => `<span class="feature-tag">${f}</span>`)
    .join('');
  */
  const dayPhotos = PHOTOS
    .map((p, i) => ({ ...p, _idx: i }))
    .filter(p => p.day === d.day);

  const photoGrid = dayPhotos.length
    ? dayPhotos.map(p => `
        <div class="photo-thumb" onclick="openModal(PHOTOS[${p._idx}])">
          ${p.url
            ? `<img src="${p.url}" alt="${p.caption || ''}">`
            : '<div class="photo-thumb-empty">📷</div>'}
        </div>`).join('')
    : `<div style="font-size:10px;color:var(--stone);font-style:italic;grid-column:1/-1;padding:4px 0;font-weight:300;">
         Add your photos for Day ${d.day}
       </div>`;

  panel.innerHTML = `
    <div id="detail-camp-name">${d.name}</div>

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

// ── ANIMATION HELPERS ─────────────────────────────
function haversineM([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function segmentDistanceM(coords) {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += haversineM(coords[i-1], coords[i]);
  return d;
}

// ── ANIMATION ─────────────────────────────────────
function playDay(dayNum) {
  if (animating) stopAnimation();

  selectDay(dayNum, true); // skip camera — playDay controls it below

  const seg       = DAY_SEGMENTS[dayNum - 1];
  const segCoords = FULL_ROUTE.slice(seg.start, seg.end + 1);

  if (segCoords.length < 2) {
    alert('No route to animate for Day 1 — this is base camp arrival day.');
    return;
  }

  animating    = true;
  animPaused   = false;
  animPausedAt = 0;
  document.getElementById('anim-bar').classList.add('visible');
  document.getElementById('anim-label').textContent = `Day ${dayNum}: ${DAYS[dayNum - 1].name}`;
  document.getElementById('anim-stop-btn').textContent = '⏸ Pause';

  document.querySelectorAll('.day-play-btn').forEach(b => b.classList.remove('playing'));
  const pb = document.getElementById(`play-btn-${dayNum}`);
  if (pb) pb.classList.add('playing');

  // Progress dot on map
  if (progressMarker) progressMarker.remove();
  const dotEl = document.createElement('div');
  Object.assign(dotEl.style, {
    width: '14px', height: '14px', borderRadius: '50%',
    background: '#e8c46a', border: '2px solid #fff',
    boxShadow: '0 0 6px rgba(232,196,106,0.8)',
    pointerEvents: 'none',
  });
  progressMarker = new mapboxgl.Marker({ element: dotEl, anchor: 'center' })
    .setLngLat(segCoords[0])
    .addTo(map);

  // Progress dot on elevation chart — sparse array mutated each tick
  if (elevChart) {
    const elevDotData = new Array(ELEV_PROFILE.length).fill(null);
    elevDotData[seg.start] = ELEV_PROFILE[seg.start];
    elevChart.data.datasets[1] = {
      data:            elevDotData,
      borderColor:     '#e8c46a',
      backgroundColor: '#e8c46a',
      pointRadius:     5,
      pointHoverRadius: 5,
      showLine:        false,
    };
    elevChart.update('none');
  }

  // Clear active segment — anim-line takes over during playback
  map.getSource('active-segment').setData({
    type: 'Feature', geometry: { type: 'LineString', coordinates: [] },
  });

  const totalPoints  = segCoords.length;
  // ── Speed tuning ─────────────────────────────────────────────
  // ANIM_SPEED_MPS: ground speed in m/s — higher = faster animation
  // Duration is based on real segment distance so flat and steep days
  // animate at a consistent pace regardless of point density.
  const ANIM_SPEED_MPS = 110; // m/s of simulated ground speed — ~40s for a 5-mile day
  const DURATION_MS    = (segmentDistanceM(segCoords) / ANIM_SPEED_MPS) * 1000;
  const segElev  = ELEV_PROFILE.slice(seg.start, seg.end + 1);
  animStartTime  = null;
  animPausedAt   = 0;

  // ── Pitch tuning ──────────────────────────────────────────
  // PITCH_CLIMB: camera angle when ascending (high = tight on the slope ahead)
  // PITCH_DESCENT: camera angle when descending (low = pulls back to reveal the drop)
  // ELEV_LOOKAHEAD: how many points ahead to sample for gradient detection
  // PITCH_SMOOTH: lerp factor per frame (lower = slower transition, higher = snappier)
  const PITCH_CLIMB    = 55;   // degrees — steep, close to the terrain
  const PITCH_DESCENT  = 30;   // degrees — wide, reveals what's ahead
  const ELEV_LOOKAHEAD = 50;   // points ahead to compare elevation
  const PITCH_SMOOTH   = 0.06; // 0–1: how fast pitch transitions between values (lerp owns smoothing — Mapbox duration is 0)
  // ──────────────────────────────────────────────────────────

  let currentPitch   = 50;

  // ── Cumulative distance LUT ───────────────────────────────
  // Maps time fraction uniformly to ground distance, not point index.
  // Without this, sparse points (flat terrain) animate faster than dense points.
  const cumDist = new Float64Array(totalPoints);
  for (let i = 1; i < totalPoints; i++) {
    cumDist[i] = cumDist[i - 1] + haversineM(segCoords[i - 1], segCoords[i]);
  }
  const totalDist = cumDist[totalPoints - 1];

  // Given a time fraction (0–1), return the floating-point point index
  // that corresponds to that fraction of total ground distance.
  function distToFloatIndex(t) {
    const targetDist = t * totalDist;
    // Binary search for the segment containing targetDist
    let lo = 0, hi = totalPoints - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cumDist[mid] <= targetDist) lo = mid; else hi = mid;
    }
    const segLen = cumDist[hi] - cumDist[lo];
    const frac   = segLen > 0 ? (targetDist - cumDist[lo]) / segLen : 0;
    return lo + frac;
  }
  // ──────────────────────────────────────────────────────────

  // ── Bearing tuning ────────────────────────────────────────
  // BEARING_LOOKAHEAD: points ahead used to compute target heading
  //   (higher = smoother direction, less responsive to tight turns)
  // BEARING_SMOOTH: lerp factor per frame (lower = slower/floatier rotation)
  const BEARING_LOOKAHEAD = 200;  // points ahead — raise to reduce jitter
  const BEARING_SMOOTH    = 0.005; // 0–1: rotation speed per frame
  // ──────────────────────────────────────────────────────────

  // Use per-day startBearing from data.js if set, otherwise compute from trail direction
  const initialBearing = DAYS[dayNum - 1].startBearing !== null
    ? DAYS[dayNum - 1].startBearing
    : computeBearing(segCoords[0], segCoords[Math.min(3, totalPoints - 1)]);
  let currentBearing = initialBearing;

  function lerp(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  function lerpNum(a, b, t) {
    return a + (b - a) * t;
  }

  // Lerp bearing via the shortest arc (avoids 350°→10° spinning 340° the wrong way)
  function lerpBearing(a, b, t) {
    let delta = ((b - a + 540) % 360) - 180; // normalize to -180…+180
    return a + delta * t;
  }

  function targetPitch(i) {
    const ahead = Math.min(i + ELEV_LOOKAHEAD, totalPoints - 1);
    const elevDiff = segElev[ahead] - segElev[i];
    // Blend smoothly: flat ground sits midway between the two extremes
    const climbT = Math.max(0, Math.min(1, (elevDiff + 30) / 60)); // +30ft = flat, +60ft = full climb
    return lerpNum(PITCH_DESCENT, PITCH_CLIMB, climbT);
  }

  map.flyTo({
    center:   segCoords[0],
    zoom:     14.5,
    pitch:    PITCH_CLIMB,
    bearing:  initialBearing,
    duration: 1200,
    essential: true,
  });

  animTick = function tick(timestamp) {
    if (!animating) return;

    if (!animStartTime) animStartTime = timestamp - animPausedAt;
    const elapsed = timestamp - animStartTime;
    animPausedAt  = elapsed;  // keep current so resume knows where to pick up
    const t       = Math.min(elapsed / DURATION_MS, 1);
    const floatIndex = distToFloatIndex(t);
    const i          = Math.floor(floatIndex);
    const frac       = floatIndex - i;

    const currentPos = i >= totalPoints - 1
      ? segCoords[totalPoints - 1]
      : lerp(segCoords[i], segCoords[i + 1], frac);

    map.getSource('anim-line').setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [...segCoords.slice(0, i + 1), currentPos] },
    });

    // Move progress dots
    if (progressMarker) progressMarker.setLngLat(currentPos);
    if (elevChart && elevChart.data.datasets[1]) {
      const dotData    = elevChart.data.datasets[1].data;
      const prevIndex  = dotData.indexOf(dotData.find(v => v !== null));
      const elevIndex  = Math.min(seg.start + i, ELEV_PROFILE.length - 1);
      if (prevIndex !== -1) dotData[prevIndex] = null;
      dotData[elevIndex] = ELEV_PROFILE[elevIndex];
      elevChart.update('none');
    }

    if (i < totalPoints - 1) {
      currentPitch   = lerpNum(currentPitch, targetPitch(i), PITCH_SMOOTH);
      const targetBearing = computeBearing(currentPos, segCoords[Math.min(i + BEARING_LOOKAHEAD, totalPoints - 1)]);
      currentBearing = lerpBearing(currentBearing, targetBearing, BEARING_SMOOTH);
      map.easeTo({
        center:   currentPos,
        bearing:  currentBearing,
        pitch:    currentPitch,
        duration: 0,   // smoothing handled by lerp above — duration > 0 fights rAF updates
        essential: true,
      });
    }

    if (t < 1) {
      animFrame = requestAnimationFrame(animTick);
    } else {
      stopAnimation();
    }
  };

  setTimeout(() => { if (animating) animFrame = requestAnimationFrame(animTick); }, 1400);
}

function pauseAnimation() {
  if (!animTick) return;
  if (animPaused) {
    // Resume — animPausedAt holds elapsed ms; null startTime so tick recomputes it
    animPaused    = false;
    animStartTime = null;
    animating     = true;
    animFrame     = requestAnimationFrame(animTick);
    document.getElementById('anim-stop-btn').textContent = '⏸ Pause';
  } else {
    // Pause — animPausedAt is kept current by tick each frame
    animPaused = true;
    if (animFrame) cancelAnimationFrame(animFrame);
    document.getElementById('anim-stop-btn').textContent = '▶ Resume';
  }
}

function stopAnimation() {
  animating    = false;
  animPaused   = false;
  animPausedAt = 0;
  animStartTime = null;
  animTick     = null;
  if (animFrame) cancelAnimationFrame(animFrame);

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

  // Remove progress dots
  if (progressMarker) { progressMarker.remove(); progressMarker = null; }
  if (elevChart && elevChart.data.datasets[1]) {
    elevChart.data.datasets.splice(1, 1);
    elevChart.update('none');
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
    pitch:    70,
    bearing:  -80,
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
            color: '#b0c4ca',
            font:  { size: 9, family: 'DM Sans, system-ui, sans-serif' },
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
let _modalGroup = [];
let _modalPos   = 0;

function openModal(photo) {
  openModalGroup([PHOTOS.indexOf(photo)], 0);
}

function openModalGroup(indices, pos) {
  _modalGroup = indices;
  _modalPos   = pos;
  renderModalPhoto();
  document.getElementById('photo-modal').classList.add('open');
}

function renderModalPhoto() {
  const photo = PHOTOS[_modalGroup[_modalPos]];
  document.getElementById('modal-img').src             = photo.url || '';
  document.getElementById('modal-title').textContent   = photo.caption || '';
  document.getElementById('modal-caption').textContent = photo.author || '';
  document.getElementById('modal-meta').textContent    = photo.day ? `Day ${photo.day} · ${DAYS[photo.day - 1]?.name || ''}` : '';

  const total = _modalGroup.length;
  document.getElementById('modal-counter').textContent = total > 1 ? `${_modalPos + 1} / ${total}` : '';
  document.getElementById('modal-prev').style.display  = total > 1 ? 'flex' : 'none';
  document.getElementById('modal-next').style.display  = total > 1 ? 'flex' : 'none';
}

function modalNav(dir) {
  _modalPos = (_modalPos + dir + _modalGroup.length) % _modalGroup.length;
  renderModalPhoto();
}

function closeModal() {
  document.getElementById('photo-modal').classList.remove('open');
}

document.getElementById('photo-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('photo-modal')) closeModal();
});

document.addEventListener('keydown', e => {
  const modalOpen = document.getElementById('photo-modal').classList.contains('open');
  if (e.key === 'Escape') { closeModal(); return; }
  if (modalOpen) {
    if (e.key === 'ArrowLeft')  { modalNav(-1); return; }
    if (e.key === 'ArrowRight') { modalNav(1);  return; }
  }
});

// ── START ─────────────────────────────────────────
initMap();
