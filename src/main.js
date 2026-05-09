import * as THREE from 'three';

const canvas = document.querySelector('#game-canvas');
const ui = {
  modeLabel: document.querySelector('#mode-label'),
  levelTitle: document.querySelector('#level-title'),
  difficulty: document.querySelector('#difficulty-label'),
  prev: document.querySelector('#prev-level'),
  next: document.querySelector('#next-level'),
  axis: document.querySelector('#axis-toggle'),
  theme: document.querySelector('#theme-toggle'),
  daily: document.querySelector('#daily-toggle'),
  settings: document.querySelector('#settings-toggle'),
  calendarPanel: document.querySelector('#calendar-panel'),
  closeCalendar: document.querySelector('#close-calendar'),
  calendarGrid: document.querySelector('#calendar-grid'),
  calendarMonth: document.querySelector('#calendar-month'),
  settingsPanel: document.querySelector('#settings-panel'),
  closeSettings: document.querySelector('#close-settings'),
  sensitivity: document.querySelector('#sensitivity'),
  haptics: document.querySelector('#haptics'),
  sounds: document.querySelector('#sounds'),
  darkSetting: document.querySelector('#dark-setting'),
  privacyLink: document.querySelector('#privacy-link'),
  privacyNote: document.querySelector('#privacy-note'),
  win: document.querySelector('#win-overlay'),
  winCopy: document.querySelector('#win-copy'),
  continueButton: document.querySelector('#continue-button'),
};

const HARD_LEVELS = new Set([6, 10, 16, 20]);
const directions = [
  { key: '+x', v: new THREE.Vector3(1, 0, 0), label: '→' },
  { key: '-x', v: new THREE.Vector3(-1, 0, 0), label: '←' },
  { key: '+y', v: new THREE.Vector3(0, 1, 0), label: '↑' },
  { key: '-y', v: new THREE.Vector3(0, -1, 0), label: '↓' },
  { key: '+z', v: new THREE.Vector3(0, 0, 1), label: '↗' },
  { key: '-z', v: new THREE.Vector3(0, 0, -1), label: '↙' },
];

const state = {
  level: Number(localStorage.getItem('arrows3d-level') || 1),
  dailySeed: null,
  entities: [],
  occupied: new Map(),
  bounds: null,
  selected: null,
  dragging: false,
  rotating: false,
  pointerStart: new THREE.Vector2(),
  pointerNow: new THREE.Vector2(),
  rotationStart: new THREE.Euler(),
  sensitivity: Number(localStorage.getItem('arrows3d-sensitivity') || 1),
  haptics: localStorage.getItem('arrows3d-haptics') !== 'false',
  sounds: localStorage.getItem('arrows3d-sounds') !== 'false',
  dark: localStorage.getItem('arrows3d-dark') === 'true',
  showGrid: false,
  currentHard: false,
  animations: [],
  particles: [],
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 120);
camera.position.set(7, 7, 9);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const puzzle = new THREE.Group();
scene.add(puzzle);

const grid = new THREE.Group();
scene.add(grid);

const ambient = new THREE.HemisphereLight(0xffffff, 0x94a8ff, 2.1);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
keyLight.position.set(6, 10, 7);
keyLight.castShadow = true;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x74e7ff, 1.2);
rimLight.position.set(-7, 3, -6);
scene.add(rimLight);

const cubeGeometry = new THREE.BoxGeometry(0.92, 0.92, 0.92, 5, 5, 5);
const edgeGeometry = new THREE.EdgesGeometry(cubeGeometry);
const arrowTextures = new Map();
const audioContext = { ctx: null };

function seeded(seed) {
  let n = seed % 2147483647;
  if (n <= 0) n += 2147483646;
  return () => (n = (n * 16807) % 2147483647) / 2147483647;
}

function keyOf(cell) {
  return `${cell.x},${cell.y},${cell.z}`;
}

function textureFor(direction) {
  if (arrowTextures.has(direction.key)) return arrowTextures.get(direction.key);
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  g.fillStyle = 'rgba(255,255,255,.88)';
  g.beginPath();
  g.roundRect(28, 28, 200, 200, 42);
  g.fill();
  g.fillStyle = '#10213a';
  g.font = 'bold 144px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(direction.label, 128, 132);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  arrowTextures.set(direction.key, texture);
  return texture;
}

function colorFor(index) {
  const palette = [0x33b7ff, 0x7c6cff, 0xffb84d, 0x31d8a0, 0xff6c94, 0x9be15d];
  return palette[index % palette.length];
}

function makeMaterials(entity, color) {
  const base = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.04,
    emissive: 0x000000,
  });
  const arrow = base.clone();
  arrow.map = textureFor(entity.direction);
  arrow.roughness = 0.34;
  const mats = [base, base, base, base, base, base];
  const faceIndex = entity.direction.key === '+x' ? 0 : entity.direction.key === '-x' ? 1 : entity.direction.key === '+y' ? 2 : entity.direction.key === '-y' ? 3 : entity.direction.key === '+z' ? 4 : 5;
  mats[faceIndex] = arrow;
  return { mats, base, arrow };
}

function generateLevel(level, dailySeed = null) {
  const hard = HARD_LEVELS.has(level) || level > 20;
  const size = Math.min(2 + Math.floor((level - 1) / 4), hard ? 5 : 4);
  const rand = seeded((dailySeed || level * 9127) + 1337);
  const cells = [];
  const radius = (size - 1) / 2;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const edge = x === 0 || y === 0 || z === 0 || x === size - 1 || y === size - 1 || z === size - 1;
        const density = hard ? 0.92 : 0.66 + Math.min(level, 12) * 0.018;
        if (edge || rand() < density) cells.push({ x: x - radius, y: y - radius, z: z - radius });
      }
    }
  }

  const remaining = new Map(cells.map((cell) => [keyOf(cell), cell]));
  const entities = [];
  let id = 0;
  for (const cell of cells) {
    if (!remaining.has(keyOf(cell))) continue;
    const shape = [cell];
    remaining.delete(keyOf(cell));
    if (level > 4 && rand() > (hard ? 0.42 : 0.64)) {
      const axis = ['x', 'y', 'z'][Math.floor(rand() * 3)];
      const sign = rand() > 0.5 ? 1 : -1;
      const neighbor = { ...cell, [axis]: cell[axis] + sign };
      const neighborKey = keyOf(neighbor);
      if (remaining.has(neighborKey)) {
        shape.push(remaining.get(neighborKey));
        remaining.delete(neighborKey);
      }
    }
    const center = shape.reduce((acc, part) => acc.add(new THREE.Vector3(part.x, part.y, part.z)), new THREE.Vector3()).multiplyScalar(1 / shape.length);
    const axis = Math.abs(center.x) >= Math.abs(center.y) && Math.abs(center.x) >= Math.abs(center.z) ? 'x' : Math.abs(center.y) >= Math.abs(center.z) ? 'y' : 'z';
    const sign = center[axis] >= 0 ? 1 : -1;
    const dirKey = `${sign > 0 ? '+' : '-'}${axis}`;
    entities.push({ id: id++, cells: shape, direction: directions.find((d) => d.key === dirKey) });
  }
  return { entities, size, hard };
}

function loadLevel(level = state.level, dailySeed = null) {
  state.level = level;
  state.dailySeed = dailySeed;
  state.animations.length = 0;
  state.particles.length = 0;
  state.entities.length = 0;
  state.occupied.clear();
  puzzle.clear();
  grid.clear();
  ui.win.classList.add('hidden');

  const levelData = generateLevel(level, dailySeed);
  state.currentHard = levelData.hard;
  const allCells = levelData.entities.flatMap((entity) => entity.cells);
  state.bounds = boundsFor(allCells);
  levelData.entities.forEach((entity, index) => addEntity(entity, index));
  createGrid(levelData.size);
  updateUi(levelData.hard);
  centerCamera();
}

function boundsFor(cells) {
  return cells.reduce((b, c) => ({
    minX: Math.min(b.minX, c.x), maxX: Math.max(b.maxX, c.x),
    minY: Math.min(b.minY, c.y), maxY: Math.max(b.maxY, c.y),
    minZ: Math.min(b.minZ, c.z), maxZ: Math.max(b.maxZ, c.z),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity });
}

function addEntity(entity, index) {
  const group = new THREE.Group();
  group.userData.entity = entity;
  entity.group = group;
  entity.active = true;
  entity.original = new THREE.Vector3();
  const color = colorFor(index);
  const materialRefs = [];
  entity.cells.forEach((cell) => {
    const refs = makeMaterials(entity, color);
    materialRefs.push(refs.base, refs.arrow);
    const cube = new THREE.Mesh(cubeGeometry, refs.mats);
    cube.position.set(cell.x, cell.y, cell.z);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData.entity = entity;
    group.add(cube);

    const edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 }));
    edges.position.copy(cube.position);
    group.add(edges);
    state.occupied.set(keyOf(cell), entity);
  });
  entity.materialRefs = materialRefs;
  puzzle.add(group);
  state.entities.push(entity);
}

function createGrid(size) {
  const span = size + 2;
  const gridHelper = new THREE.GridHelper(span, span, 0x28e5ff, 0x99a8c2);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.22;
  gridHelper.rotation.x = Math.PI / 2;
  grid.add(gridHelper);

  const axes = new THREE.AxesHelper(span / 2 + 1.5);
  axes.material.depthTest = false;
  grid.add(axes);
  grid.visible = state.showGrid;
}

function updateUi(hard = false) {
  const daily = state.dailySeed !== null;
  ui.modeLabel.textContent = daily ? 'Daily Mode' : 'Level Mode';
  ui.levelTitle.textContent = daily ? 'Daily Puzzle' : `Level ${state.level}`;
  ui.difficulty.textContent = hard ? 'Hard' : state.level < 4 ? 'Easy' : 'Medium';
  ui.axis.textContent = `Grid: ${state.showGrid ? 'On' : 'Off'}`;
  ui.theme.textContent = state.dark ? 'Light Mode' : 'Dark Mode';
  document.body.classList.toggle('dark', state.dark);
  ui.darkSetting.checked = state.dark;
  ui.sensitivity.value = state.sensitivity;
  ui.haptics.checked = state.haptics;
  ui.sounds.checked = state.sounds;
}

function centerCamera() {
  const count = state.entities.filter((e) => e.active).length || 1;
  const distance = Math.min(15, 6.5 + count * 0.035);
  camera.position.set(distance * 0.66, distance * 0.62, distance * 0.86);
  camera.lookAt(0, 0, 0);
}

function screenToPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return pointer;
}

function hitEntity(event) {
  raycaster.setFromCamera(screenToPointer(event), camera);
  const hits = raycaster.intersectObjects(puzzle.children, true);
  return hits.find((hit) => hit.object.userData.entity)?.object.userData.entity || null;
}

function onPointerDown(event) {
  state.pointerStart.set(event.clientX, event.clientY);
  state.pointerNow.copy(state.pointerStart);
  const entity = hitEntity(event);
  state.selected = entity?.active ? entity : null;
  state.dragging = Boolean(state.selected);
  state.rotating = !state.dragging;
  state.rotationStart.copy(puzzle.rotation);
}

function onPointerMove(event) {
  state.pointerNow.set(event.clientX, event.clientY);
  const delta = state.pointerNow.clone().sub(state.pointerStart);
  if (state.rotating && delta.length() > 2) {
    puzzle.rotation.y = state.rotationStart.y + delta.x * 0.006 * state.sensitivity;
    puzzle.rotation.x = THREE.MathUtils.clamp(state.rotationStart.x + delta.y * 0.0045 * state.sensitivity, -1.25, 1.25);
    grid.rotation.copy(puzzle.rotation);
  }
}

function onPointerUp() {
  if (state.dragging && state.selected) {
    const delta = state.pointerNow.clone().sub(state.pointerStart);
    if (delta.length() < 16) {
      tryMove(state.selected);
    } else if (swipeMatchesArrow(delta, state.selected.direction)) {
      tryMove(state.selected);
    } else {
      blockedFeedback(state.selected);
    }
  }
  state.selected = null;
  state.dragging = false;
  state.rotating = false;
}

function swipeMatchesArrow(delta, direction) {
  const worldDirection = direction.v.clone().applyEuler(puzzle.rotation).project(camera);
  const expected = new THREE.Vector2(worldDirection.x, -worldDirection.y).normalize();
  return expected.dot(delta.clone().normalize()) > 0.34;
}

function pathBlocked(entity) {
  const dir = entity.direction.v;
  const outside = (c) => c.x < state.bounds.minX || c.x > state.bounds.maxX || c.y < state.bounds.minY || c.y > state.bounds.maxY || c.z < state.bounds.minZ || c.z > state.bounds.maxZ;
  for (const cell of entity.cells) {
    let cursor = { x: cell.x + dir.x, y: cell.y + dir.y, z: cell.z + dir.z };
    while (!outside(cursor)) {
      const blocker = state.occupied.get(keyOf(cursor));
      if (blocker && blocker !== entity && blocker.active) return true;
      cursor = { x: cursor.x + dir.x, y: cursor.y + dir.y, z: cursor.z + dir.z };
    }
  }
  return false;
}

function tryMove(entity) {
  if (!entity.active || state.animations.some((a) => a.entity === entity)) return;
  if (pathBlocked(entity)) {
    blockedFeedback(entity);
    return;
  }
  successFeedback(entity);
  entity.cells.forEach((cell) => state.occupied.delete(keyOf(cell)));
  const flyTo = entity.direction.v.clone().multiplyScalar(12);
  animateEntity(entity, flyTo, 820, () => {
    entity.active = false;
    puzzle.remove(entity.group);
    if (state.entities.every((e) => !e.active)) winLevel();
  });
}

function animateEntity(entity, target, duration, done, bump = false) {
  const start = entity.group.position.clone();
  state.animations.push({ entity, start, target, duration, elapsed: 0, done, bump });
}

function blockedFeedback(entity) {
  pulse(entity, 0xff2e5f, 0.75);
  const bump = entity.direction.v.clone().multiplyScalar(0.22);
  animateEntity(entity, bump, 240, null, true);
  vibrate(35);
  playTone(120, 0.06, 'sawtooth');
}

function successFeedback(entity) {
  pulse(entity, 0x35e8ff, 1.15);
  vibrate(18);
  playTone(620, 0.08, 'triangle');
}

function pulse(entity, color, intensity) {
  entity.materialRefs.forEach((mat) => {
    mat.emissive.setHex(color);
    mat.emissiveIntensity = intensity;
  });
  setTimeout(() => {
    entity.materialRefs?.forEach((mat) => {
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    });
  }, 180);
}

function vibrate(ms) {
  if (state.haptics && navigator.vibrate) navigator.vibrate(ms);
}

function playTone(freq, seconds, type) {
  if (!state.sounds) return;
  audioContext.ctx ||= new AudioContext();
  const ctx = audioContext.ctx;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  gain.gain.setValueAtTime(0.045, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + seconds);
}

function winLevel() {
  spawnConfetti();
  playTone(880, 0.14, 'sine');
  setTimeout(() => {
    ui.winCopy.textContent = state.dailySeed ? 'Daily challenge complete.' : `Level ${state.level} cleared.`;
    ui.win.classList.remove('hidden');
  }, 420);
}

function spawnConfetti() {
  for (let i = 0; i < 120; i++) {
    const geometry = new THREE.BoxGeometry(0.08, 0.18, 0.035);
    const material = new THREE.MeshBasicMaterial({ color: colorFor(i) });
    const particle = new THREE.Mesh(geometry, material);
    particle.position.set(0, 0, 0);
    const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.15, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 4);
    scene.add(particle);
    state.particles.push({ particle, velocity, life: 1.8 + Math.random() * 0.8 });
  }
}

function buildCalendar() {
  const today = new Date();
  const monthName = today.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  ui.calendarMonth.textContent = monthName;
  ui.calendarGrid.innerHTML = '';
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= days; day++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `day-button${day === today.getDate() ? ' today' : ''}`;
    button.textContent = String(day);
    button.addEventListener('click', () => {
      const seed = Number(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(day).padStart(2, '0')}`);
      loadLevel(8 + (day % 14), seed);
      ui.calendarPanel.classList.add('hidden');
    });
    ui.calendarGrid.appendChild(button);
  }
}

function setDark(dark) {
  state.dark = dark;
  localStorage.setItem('arrows3d-dark', String(dark));
  updateUi(state.currentHard);
}

function tickAnimations(delta) {
  state.animations = state.animations.filter((anim) => {
    anim.elapsed += delta * 1000;
    const t = Math.min(1, anim.elapsed / anim.duration);
    const eased = anim.bump ? Math.sin(t * Math.PI) : 1 - Math.pow(1 - t, 3);
    anim.entity.group.position.copy(anim.start).lerp(anim.target, eased);
    if (t >= 1) {
      if (anim.bump) anim.entity.group.position.copy(anim.start);
      anim.done?.();
      return false;
    }
    return true;
  });
}

function tickParticles(delta) {
  state.particles = state.particles.filter((item) => {
    item.life -= delta;
    item.velocity.y -= delta * 1.8;
    item.particle.position.addScaledVector(item.velocity, delta);
    item.particle.rotation.x += delta * 7;
    item.particle.rotation.y += delta * 5;
    item.particle.material.opacity = Math.max(0, item.life / 2.4);
    item.particle.material.transparent = true;
    if (item.life <= 0) {
      scene.remove(item.particle);
      item.particle.geometry.dispose();
      item.particle.material.dispose();
      return false;
    }
    return true;
  });
}

let last = performance.now();
function animate(now = performance.now()) {
  const delta = Math.min(0.04, (now - last) / 1000);
  last = now;
  tickAnimations(delta);
  tickParticles(delta);
  puzzle.rotation.y += state.rotating ? 0 : 0.0008;
  grid.rotation.copy(puzzle.rotation);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

ui.prev.addEventListener('click', () => loadLevel(Math.max(1, state.level - 1), null));
ui.next.addEventListener('click', () => loadLevel(state.level + 1, null));
ui.axis.addEventListener('click', () => {
  state.showGrid = !state.showGrid;
  grid.visible = state.showGrid;
  updateUi(state.currentHard);
});
ui.theme.addEventListener('click', () => setDark(!state.dark));
ui.daily.addEventListener('click', () => {
  buildCalendar();
  ui.calendarPanel.classList.toggle('hidden');
});
ui.closeCalendar.addEventListener('click', () => ui.calendarPanel.classList.add('hidden'));
ui.settings.addEventListener('click', () => ui.settingsPanel.classList.toggle('hidden'));
ui.closeSettings.addEventListener('click', () => ui.settingsPanel.classList.add('hidden'));
ui.continueButton.addEventListener('click', () => {
  if (state.dailySeed) loadLevel(state.level, null);
  else {
    localStorage.setItem('arrows3d-level', String(state.level + 1));
    loadLevel(state.level + 1, null);
  }
});
ui.sensitivity.addEventListener('input', (event) => {
  state.sensitivity = Number(event.target.value);
  localStorage.setItem('arrows3d-sensitivity', String(state.sensitivity));
});
ui.haptics.addEventListener('change', (event) => {
  state.haptics = event.target.checked;
  localStorage.setItem('arrows3d-haptics', String(state.haptics));
});
ui.sounds.addEventListener('change', (event) => {
  state.sounds = event.target.checked;
  localStorage.setItem('arrows3d-sounds', String(state.sounds));
});
ui.darkSetting.addEventListener('change', (event) => setDark(event.target.checked));
ui.privacyLink.addEventListener('click', (event) => {
  event.preventDefault();
  ui.privacyNote.classList.toggle('hidden');
});

setDark(state.dark);
loadLevel(state.level, null);
animate();
