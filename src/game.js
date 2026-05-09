import * as THREE from '../vendor/three.module.js';

const CELL_SIZE = 1.08;
const ESCAPE_DISTANCE = 13;
const AXES = {
  px: { vector: new THREE.Vector3(1, 0, 0), label: '+X' },
  nx: { vector: new THREE.Vector3(-1, 0, 0), label: '-X' },
  py: { vector: new THREE.Vector3(0, 1, 0), label: '+Y' },
  ny: { vector: new THREE.Vector3(0, -1, 0), label: '-Y' },
  pz: { vector: new THREE.Vector3(0, 0, 1), label: '+Z' },
  nz: { vector: new THREE.Vector3(0, 0, -1), label: '-Z' }
};

const LEVELS = [
  {
    name: 'Level 1',
    tier: 'Warm Up',
    pieces: [
      piece('a', [[0, 0, 0]], 'nx'), piece('b', [[1, 0, 0]], 'px'),
      piece('c', [[0, 1, 0]], 'py'), piece('d', [[1, 1, 0]], 'pz')
    ]
  },
  {
    name: 'Level 2',
    tier: '2×2×2 Cluster',
    pieces: cubeLevel(2)
  },
  {
    name: 'Level 3',
    tier: 'Stacked Paths',
    pieces: [
      piece('a', [[0, 0, 0], [0, 1, 0]], 'nx'), piece('b', [[1, 0, 0]], 'px'),
      piece('c', [[1, 1, 0]], 'py'), piece('d', [[0, 0, 1]], 'nz'),
      piece('e', [[1, 0, 1], [1, 1, 1]], 'px'), piece('f', [[0, 1, 1]], 'py')
    ]
  },
  {
    name: 'Level 4',
    tier: 'Cross Beam',
    pieces: [
      piece('a', [[-1, 0, 0], [0, 0, 0]], 'nx'), piece('b', [[1, 0, 0]], 'px'),
      piece('c', [[0, 1, 0]], 'py'), piece('d', [[0, -1, 0]], 'ny'),
      piece('e', [[0, 0, 1], [0, 0, 2]], 'pz'), piece('f', [[1, 1, 0]], 'px'),
      piece('g', [[-1, -1, 0]], 'nx')
    ]
  },
  {
    name: 'Level 5',
    tier: '3D Weave',
    pieces: [
      piece('a', [[0, 0, 0], [1, 0, 0]], 'nx'), piece('b', [[2, 0, 0]], 'px'),
      piece('c', [[0, 1, 0]], 'py'), piece('d', [[1, 1, 0], [1, 1, 1]], 'pz'),
      piece('e', [[2, 1, 0]], 'px'), piece('f', [[0, 0, 1]], 'nz'),
      piece('g', [[2, 0, 1], [2, 1, 1]], 'px'), piece('h', [[0, 1, 1]], 'py')
    ]
  },
  {
    name: 'Level 6',
    tier: 'Hard',
    pieces: hardLevel(3, 6)
  },
  {
    name: 'Level 7',
    tier: 'Depth Check',
    pieces: [
      piece('a', [[0, 0, 0]], 'nz'), piece('b', [[1, 0, 0], [1, 1, 0]], 'px'),
      piece('c', [[2, 0, 0]], 'px'), piece('d', [[0, 1, 0]], 'py'),
      piece('e', [[2, 1, 0]], 'py'), piece('f', [[0, 0, 1], [0, 1, 1]], 'nx'),
      piece('g', [[1, 0, 1]], 'nz'), piece('h', [[2, 0, 1], [2, 1, 1]], 'px'),
      piece('i', [[1, 1, 1]], 'py')
    ]
  },
  { name: 'Level 8', tier: 'Offset Columns', pieces: hardLevel(3, 8) },
  { name: 'Level 9', tier: 'Spiral Knot', pieces: hardLevel(3, 9) },
  { name: 'Level 10', tier: 'Hard', pieces: hardLevel(4, 10) },
  { name: 'Level 16', tier: 'Hard', pieces: hardLevel(4, 16) },
  { name: 'Level 20', tier: 'Hard', pieces: hardLevel(5, 20) }
];

const state = {
  levelIndex: 0,
  activePieces: [],
  moves: 0,
  sensitivity: Number(localStorage.getItem('arrows3d:sensitivity') || 0.85),
  haptics: localStorage.getItem('arrows3d:haptics') !== 'false',
  sounds: localStorage.getItem('arrows3d:sounds') !== 'false',
  dark: localStorage.getItem('arrows3d:dark') === 'true',
  grid: false,
  won: false,
  dragging: null,
  selected: null,
  dailySeed: null
};

const els = {
  canvas: document.querySelector('#game-canvas'),
  levelTitle: document.querySelector('#level-title'),
  levelSubtitle: document.querySelector('#level-subtitle'),
  moves: document.querySelector('#moves-count'),
  blocks: document.querySelector('#blocks-count'),
  prev: document.querySelector('#prev-level'),
  next: document.querySelector('#next-level'),
  restart: document.querySelector('#restart-level'),
  toggleGrid: document.querySelector('#toggle-grid'),
  dailyMode: document.querySelector('#daily-mode'),
  settingsOpen: document.querySelector('#settings-open'),
  winPanel: document.querySelector('#win-panel'),
  winNext: document.querySelector('#win-next'),
  winReplay: document.querySelector('#win-replay'),
  dailyPanel: document.querySelector('#daily-panel'),
  dailyClose: document.querySelector('#daily-close'),
  calendarGrid: document.querySelector('#calendar-grid'),
  settingsPanel: document.querySelector('#settings-panel'),
  settingsClose: document.querySelector('#settings-close'),
  cameraSensitivity: document.querySelector('#camera-sensitivity'),
  hapticsToggle: document.querySelector('#haptics-toggle'),
  soundsToggle: document.querySelector('#sounds-toggle'),
  darkToggle: document.querySelector('#dark-toggle'),
  privacyLink: document.querySelector('#privacy-link'),
  privacyNote: document.querySelector('#privacy-note')
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, alpha: true });
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const puzzleRoot = new THREE.Group();
const pieceRoot = new THREE.Group();
const confettiRoot = new THREE.Group();
const clock = new THREE.Clock();
const mixers = [];
let gridHelper;
let axesHelper;
let audioContext;

scene.add(puzzleRoot);
puzzleRoot.add(pieceRoot);
scene.add(confettiRoot);
camera.position.set(6, 5, 7.5);
camera.lookAt(0, 0, 0);

setupScene();
setupUi();
loadLevel(0);
animate();

function piece(id, cells, direction) {
  return { id, cells, direction };
}

function cubeLevel(size) {
  const dirs = ['nx', 'px', 'ny', 'py', 'nz', 'pz'];
  const pieces = [];
  let id = 0;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const outer = [x === 0 ? 'nx' : null, x === size - 1 ? 'px' : null, y === 0 ? 'ny' : null, y === size - 1 ? 'py' : null, z === 0 ? 'nz' : null, z === size - 1 ? 'pz' : null].filter(Boolean);
        pieces.push(piece(`c${id++}`, [[x, y, z]], outer[0] || dirs[(x + y + z) % dirs.length]));
      }
    }
  }
  return pieces;
}

function hardLevel(size, seed) {
  const random = mulberry32(seed * 9973);
  const dirs = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
  const occupied = new Set();
  const pieces = [];
  let id = 0;

  for (let z = 0; z < Math.min(size, 4); z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (random() < 0.18 && size > 3) continue;
        const key = cellKey([x, y, z]);
        if (occupied.has(key)) continue;
        const direction = dirs[Math.floor(random() * dirs.length)];
        const cells = [[x, y, z]];
        occupied.add(key);
        const canExtend = random() > 0.64 && x + 1 < size && !occupied.has(cellKey([x + 1, y, z]));
        if (canExtend) {
          cells.push([x + 1, y, z]);
          occupied.add(cellKey([x + 1, y, z]));
        }
        pieces.push(piece(`h${id++}`, cells, direction));
      }
    }
  }
  return pieces;
}

function setupScene() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xf8fbff, 0x7890b8, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(6, 8, 5);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.PointLight(0x48e7ff, 18, 16);
  rim.position.set(-5, -3, 6);
  scene.add(rim);

  gridHelper = new THREE.GridHelper(8, 8, 0x77aaff, 0x9bb7e8);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.22;
  gridHelper.visible = false;
  axesHelper = new THREE.AxesHelper(4.4);
  axesHelper.visible = false;
  scene.add(gridHelper, axesHelper);
  applyEnvironment();
}

function setupUi() {
  els.cameraSensitivity.value = state.sensitivity;
  els.hapticsToggle.checked = state.haptics;
  els.soundsToggle.checked = state.sounds;
  els.darkToggle.checked = state.dark;
  document.body.classList.toggle('dark', state.dark);

  els.prev.addEventListener('click', () => loadLevel(Math.max(0, state.levelIndex - 1)));
  els.next.addEventListener('click', () => loadLevel((state.levelIndex + 1) % LEVELS.length));
  els.restart.addEventListener('click', () => loadLevel(state.levelIndex, state.dailySeed));
  els.winNext.addEventListener('click', () => loadLevel((state.levelIndex + 1) % LEVELS.length));
  els.winReplay.addEventListener('click', () => loadLevel(state.levelIndex, state.dailySeed));
  els.toggleGrid.addEventListener('click', toggleGrid);
  els.dailyMode.addEventListener('click', () => togglePanel(els.dailyPanel, true));
  els.dailyClose.addEventListener('click', () => togglePanel(els.dailyPanel, false));
  els.settingsOpen.addEventListener('click', () => togglePanel(els.settingsPanel, true));
  els.settingsClose.addEventListener('click', () => togglePanel(els.settingsPanel, false));
  els.privacyLink.addEventListener('click', (event) => {
    event.preventDefault();
    els.privacyNote.classList.toggle('hidden');
  });
  els.cameraSensitivity.addEventListener('input', () => {
    state.sensitivity = Number(els.cameraSensitivity.value);
    localStorage.setItem('arrows3d:sensitivity', state.sensitivity);
  });
  els.hapticsToggle.addEventListener('change', () => storeToggle('haptics', els.hapticsToggle.checked));
  els.soundsToggle.addEventListener('change', () => storeToggle('sounds', els.soundsToggle.checked));
  els.darkToggle.addEventListener('change', () => {
    storeToggle('dark', els.darkToggle.checked);
    document.body.classList.toggle('dark', state.dark);
    applyEnvironment();
  });

  els.canvas.addEventListener('pointerdown', onPointerDown);
  els.canvas.addEventListener('pointermove', onPointerMove);
  els.canvas.addEventListener('pointerup', onPointerUp);
  els.canvas.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('resize', onResize);
  buildCalendar();
}

function loadLevel(index, dailySeed = null) {
  clearPieces();
  clearConfetti();
  state.levelIndex = index;
  state.dailySeed = dailySeed;
  state.moves = 0;
  state.won = false;
  state.selected = null;
  togglePanel(els.winPanel, false);

  const level = dailySeed ? makeDailyLevel(dailySeed) : LEVELS[index];
  state.activePieces = level.pieces.map((data, order) => createPiece(data, order));
  centerPuzzle();
  updateHud(level);
}

function makeDailyLevel(seedText) {
  const seed = [...seedText].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const size = seed % 5 === 0 ? 4 : 3;
  const tier = seed % 3 === 0 ? 'Daily Hard' : 'Daily Challenge';
  return { name: seedText, tier, pieces: hardLevel(size, seed) };
}

function createPiece(data, order) {
  const group = new THREE.Group();
  const baseColor = new THREE.Color().setHSL((order * 0.09 + 0.56) % 1, 0.64, 0.58);
  const brightColor = baseColor.clone().offsetHSL(0, 0.12, 0.16);
  const errorColor = new THREE.Color(0xff375f);
  const arrowTexture = makeArrowTexture(data.direction);
  const blankTexture = makeBlankTexture(baseColor);
  const materials = makeMaterials(data.direction, baseColor, arrowTexture, blankTexture);

  data.cells.forEach((cell) => {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.94, 0.94, 3, 3, 3), materials);
    cube.position.copy(gridToWorld(cell));
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData.piece = group;
    group.add(cube);
  });

  group.userData = {
    id: data.id,
    cells: data.cells.map((cell) => [...cell]),
    direction: data.direction,
    vector: AXES[data.direction].vector.clone(),
    baseColor,
    brightColor,
    errorColor,
    escaping: false,
    velocity: 0,
    removed: false,
    materials
  };
  pieceRoot.add(group);
  return group;
}

function makeMaterials(direction, baseColor, arrowTexture, blankTexture) {
  const faceForDirection = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }[direction];
  return Array.from({ length: 6 }, (_, face) => new THREE.MeshStandardMaterial({
    color: baseColor,
    map: face === faceForDirection ? arrowTexture : blankTexture,
    roughness: 0.48,
    metalness: 0.05,
    emissive: 0x000000,
    emissiveIntensity: 0.0
  }));
}

function makeBlankTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${color.getHexString()}`;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(4, 4, 56, 56);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeArrowTexture(direction) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, 18, 18, 220, 220, 34);
  ctx.fill();
  ctx.save();
  ctx.translate(128, 128);
  if (direction === 'ny' || direction === 'nx' || direction === 'nz') ctx.rotate(Math.PI);
  if (direction === 'px' || direction === 'nx') ctx.rotate(-Math.PI / 2);
  if (direction === 'pz' || direction === 'nz') ctx.rotate(Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(0, -82);
  ctx.lineTo(72, -8);
  ctx.lineTo(28, -8);
  ctx.lineTo(28, 78);
  ctx.lineTo(-28, 78);
  ctx.lineTo(-28, -8);
  ctx.lineTo(-72, -8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '800 28px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(AXES[direction].label, 128, 226);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function onPointerDown(event) {
  els.canvas.setPointerCapture(event.pointerId);
  const hit = pickPiece(event);
  state.dragging = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    mode: hit ? 'piece' : 'camera',
    piece: hit,
    moved: false
  };
  if (hit) selectPiece(hit);
}

function onPointerMove(event) {
  if (!state.dragging || event.pointerId !== state.dragging.pointerId) return;
  const dx = event.clientX - state.dragging.lastX;
  const dy = event.clientY - state.dragging.lastY;
  const total = Math.hypot(event.clientX - state.dragging.startX, event.clientY - state.dragging.startY);
  state.dragging.moved = state.dragging.moved || total > 8;

  if (state.dragging.mode === 'camera') {
    puzzleRoot.rotation.y += dx * 0.008 * state.sensitivity;
    puzzleRoot.rotation.x += dy * 0.006 * state.sensitivity;
    puzzleRoot.rotation.x = THREE.MathUtils.clamp(puzzleRoot.rotation.x, -1.25, 1.25);
  }
  state.dragging.lastX = event.clientX;
  state.dragging.lastY = event.clientY;
}

function onPointerUp(event) {
  if (!state.dragging || event.pointerId !== state.dragging.pointerId) return;
  const drag = state.dragging;
  state.dragging = null;
  if (drag.mode !== 'piece' || !drag.piece || drag.piece.userData.escaping) return;

  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (!drag.moved || swipeMatchesDirection(drag.piece, dx, dy)) {
    attemptMove(drag.piece);
  } else {
    pulsePiece(drag.piece, 'error');
    feedback(false);
  }
}

function pickPiece(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pieceRoot.children, true);
  return hits[0]?.object?.userData?.piece || null;
}

function swipeMatchesDirection(pieceGroup, dx, dy) {
  const vector = pieceGroup.userData.vector.clone().applyEuler(puzzleRoot.rotation).normalize();
  const origin = new THREE.Vector3(0, 0, 0).project(camera);
  const target = vector.project(camera);
  const screenDir = new THREE.Vector2(target.x - origin.x, -(target.y - origin.y)).normalize();
  const swipeDir = new THREE.Vector2(dx, dy).normalize();
  return screenDir.dot(swipeDir) > 0.45;
}

function attemptMove(pieceGroup) {
  if (state.won || pieceGroup.userData.escaping) return;
  state.moves += 1;
  if (isPathClear(pieceGroup)) {
    escapePiece(pieceGroup);
    feedback(true);
  } else {
    bumpPiece(pieceGroup);
    feedback(false);
  }
  updateHud();
}

function isPathClear(pieceGroup) {
  const direction = pieceGroup.userData.direction;
  const vector = pieceGroup.userData.vector;
  const occupied = new Set();
  state.activePieces.forEach((pieceCandidate) => {
    if (pieceCandidate === pieceGroup || pieceCandidate.userData.removed) return;
    pieceCandidate.userData.cells.forEach((cell) => occupied.add(cellKey(cell)));
  });

  const bounds = getBounds();
  for (const cell of pieceGroup.userData.cells) {
    let cursor = [cell[0] + vector.x, cell[1] + vector.y, cell[2] + vector.z];
    while (withinBounds(cursor, bounds, direction)) {
      if (occupied.has(cellKey(cursor))) return false;
      cursor = [cursor[0] + vector.x, cursor[1] + vector.y, cursor[2] + vector.z];
    }
  }
  return true;
}

function withinBounds(cell, bounds, direction) {
  if (direction === 'px') return cell[0] <= bounds.maxX;
  if (direction === 'nx') return cell[0] >= bounds.minX;
  if (direction === 'py') return cell[1] <= bounds.maxY;
  if (direction === 'ny') return cell[1] >= bounds.minY;
  if (direction === 'pz') return cell[2] <= bounds.maxZ;
  return cell[2] >= bounds.minZ;
}

function escapePiece(pieceGroup) {
  pieceGroup.userData.escaping = true;
  pulsePiece(pieceGroup, 'success');
  pieceGroup.userData.velocity = 0.09;
}

function bumpPiece(pieceGroup) {
  const vector = pieceGroup.userData.vector.clone().multiplyScalar(0.23);
  const start = pieceGroup.position.clone();
  const timeline = { t: 0, duration: 0.34, update: null };
  timeline.update = (delta) => {
    timeline.t += delta;
    const progress = Math.min(timeline.t / timeline.duration, 1);
    const amount = Math.sin(progress * Math.PI) * 1.0;
    pieceGroup.position.copy(start).addScaledVector(vector, amount);
    if (progress >= 1) return false;
    return true;
  };
  mixers.push(timeline);
  pulsePiece(pieceGroup, 'error');
}

function pulsePiece(pieceGroup, type) {
  const userData = pieceGroup.userData;
  const color = type === 'error' ? userData.errorColor : userData.brightColor;
  userData.materials.forEach((material) => {
    material.emissive.copy(color);
    material.emissiveIntensity = type === 'error' ? 0.82 : 0.58;
  });
  const timeline = { t: 0, duration: 0.5, update: null };
  timeline.update = (delta) => {
    timeline.t += delta;
    const progress = Math.min(timeline.t / timeline.duration, 1);
    userData.materials.forEach((material) => {
      material.emissiveIntensity = THREE.MathUtils.lerp(type === 'error' ? 0.82 : 0.58, 0, progress);
    });
    return progress < 1;
  };
  mixers.push(timeline);
}

function selectPiece(pieceGroup) {
  if (state.selected && state.selected !== pieceGroup) {
    state.selected.scale.setScalar(1);
  }
  state.selected = pieceGroup;
  pieceGroup.scale.setScalar(1.035);
}

function updateEscapes(delta) {
  for (const pieceGroup of [...state.activePieces]) {
    if (!pieceGroup.userData.escaping) continue;
    pieceGroup.userData.velocity += delta * 6.3;
    const movement = pieceGroup.userData.vector.clone().multiplyScalar(pieceGroup.userData.velocity * delta * CELL_SIZE);
    pieceGroup.position.add(movement);
    pieceGroup.rotation.x += delta * 1.6;
    pieceGroup.rotation.y += delta * 1.2;
    if (pieceGroup.position.length() > ESCAPE_DISTANCE) {
      pieceGroup.userData.removed = true;
      pieceRoot.remove(pieceGroup);
      state.activePieces = state.activePieces.filter((candidate) => candidate !== pieceGroup);
      if (state.activePieces.length === 0) winLevel();
    }
  }
}

function winLevel() {
  state.won = true;
  updateHud();
  spawnConfetti();
  feedback(true, 75);
  setTimeout(() => togglePanel(els.winPanel, true), 700);
}

function spawnConfetti() {
  clearConfetti();
  const geometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  for (let i = 0; i < 180; i++) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.85, 0.62) });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.velocity = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(7),
      THREE.MathUtils.randFloat(1.2, 6),
      THREE.MathUtils.randFloatSpread(7)
    );
    mesh.userData.spin = new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(5);
    confettiRoot.add(mesh);
  }
}

function updateConfetti(delta) {
  confettiRoot.children.forEach((mesh) => {
    mesh.userData.velocity.y -= delta * 2.8;
    mesh.position.addScaledVector(mesh.userData.velocity, delta);
    mesh.rotation.x += mesh.userData.spin.x * delta;
    mesh.rotation.y += mesh.userData.spin.y * delta;
    mesh.rotation.z += mesh.userData.spin.z * delta;
    mesh.material.opacity = Math.max(0, 1 - mesh.position.length() / 10);
  });
}

function updateHud(level = null) {
  const activeLevel = level || (state.dailySeed ? makeDailyLevel(state.dailySeed) : LEVELS[state.levelIndex]);
  els.levelTitle.textContent = activeLevel.name;
  els.levelSubtitle.textContent = `${activeLevel.tier} · Swipe arrows along X, Y, or Z until the space is clear.`;
  els.moves.textContent = `${state.moves} move${state.moves === 1 ? '' : 's'}`;
  els.blocks.textContent = `${state.activePieces.length} block${state.activePieces.length === 1 ? '' : 's'} left`;
  els.prev.disabled = state.levelIndex === 0 && !state.dailySeed;
}

function buildCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  els.calendarGrid.innerHTML = '';
  for (let day = 1; day <= lastDay; day++) {
    const button = document.createElement('button');
    const date = new Date(year, month, day);
    const iso = date.toISOString().slice(0, 10);
    button.type = 'button';
    button.textContent = String(day);
    button.title = `Play daily puzzle ${iso}`;
    button.classList.toggle('today', day === today.getDate());
    button.addEventListener('click', () => {
      loadLevel(0, iso);
      togglePanel(els.dailyPanel, false);
    });
    els.calendarGrid.append(button);
  }
}

function centerPuzzle() {
  const bounds = getBounds(true);
  const center = new THREE.Vector3(
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minY + bounds.maxY) / 2,
    (bounds.minZ + bounds.maxZ) / 2
  ).multiplyScalar(CELL_SIZE);
  pieceRoot.children.forEach((child) => child.position.sub(center));
  puzzleRoot.rotation.set(-0.28, 0.62, 0);
}

function getBounds(includeRemoved = false) {
  const cells = [];
  state.activePieces.forEach((pieceGroup) => {
    if (!includeRemoved && pieceGroup.userData.removed) return;
    cells.push(...pieceGroup.userData.cells);
  });
  if (!cells.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  return {
    minX: Math.min(...cells.map((cell) => cell[0])),
    maxX: Math.max(...cells.map((cell) => cell[0])),
    minY: Math.min(...cells.map((cell) => cell[1])),
    maxY: Math.max(...cells.map((cell) => cell[1])),
    minZ: Math.min(...cells.map((cell) => cell[2])),
    maxZ: Math.max(...cells.map((cell) => cell[2]))
  };
}

function gridToWorld(cell) {
  return new THREE.Vector3(cell[0], cell[1], cell[2]).multiplyScalar(CELL_SIZE);
}

function cellKey(cell) {
  return `${cell[0]},${cell[1]},${cell[2]}`;
}

function storeToggle(key, value) {
  state[key] = value;
  localStorage.setItem(`arrows3d:${key}`, value);
}

function toggleGrid() {
  state.grid = !state.grid;
  gridHelper.visible = state.grid;
  axesHelper.visible = state.grid;
  els.toggleGrid.setAttribute('aria-pressed', String(state.grid));
}

function togglePanel(panel, show) {
  panel.classList.toggle('hidden', !show);
}

function applyEnvironment() {
  scene.fog = new THREE.Fog(state.dark ? 0x030712 : 0xdfeeff, 16, 34);
  renderer.setClearColor(state.dark ? 0x030712 : 0xdfeeff, 0);
}

function clearPieces() {
  while (pieceRoot.children.length) pieceRoot.remove(pieceRoot.children[0]);
}

function clearConfetti() {
  while (confettiRoot.children.length) confettiRoot.remove(confettiRoot.children[0]);
}

function feedback(success, duration = 35) {
  if (state.haptics && navigator.vibrate) navigator.vibrate(success ? duration : [20, 35, 20]);
  if (!state.sounds) return;
  audioContext ||= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = success ? 'sine' : 'sawtooth';
  oscillator.frequency.value = success ? 620 : 130;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.2);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.033);
  for (let i = mixers.length - 1; i >= 0; i--) {
    if (!mixers[i].update(delta)) mixers.splice(i, 1);
  }
  updateEscapes(delta);
  updateConfetti(delta);
  renderer.render(scene, camera);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
