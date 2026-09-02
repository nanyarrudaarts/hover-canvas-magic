/**
 * Hover-driven frame animation — hotspots
 * ------------------------------------------------------------
 * - A composição possui 5 hotspots invisíveis (sem overlay, sem tooltip).
 * - Cada hotspot é um polígono definido em porcentagem da imagem
 *   (0..1), portanto acompanha o canvas em qualquer tamanho de tela.
 * - Mouse entra na área → reproduz a sequência de frames do objeto.
 * - Mouse sai da área → a sequência volta ao início (estado inicial).
 * - Preload de todos os frames em cache; redesenho via
 *   requestAnimationFrame apenas quando o índice do frame muda.
 * - Nomes gerados dinamicamente com padding de 3 dígitos.
 */
(function () {
  "use strict";

  // ---------- Configuração ----------
  const CONFIG = {
    path: "../frames/",
    prefix: "ezgif-frame-",
    extension: ".jpg",
    padLength: 3,
    baseFrame: 25,   // frame exibido em repouso
    fps: 30,         // velocidade base de reprodução (frames por segundo)
  };

  const DEFAULTS = { speed: 1, precision: 100 };

  /**
   * Hotspots — coordenadas em fração da imagem (x/1600, y/900).
   * A ordem define a prioridade quando há sobreposição visual:
   * os objetos mais à frente vêm primeiro.
   */
  const HOTSPOTS = [
    {
      id: "sticker",
      start: 203,
      end: 232,
      polygon: [[0.459, 0.517], [0.525, 0.517], [0.525, 0.600], [0.459, 0.600]],
    },
    {
      id: "micard",
      start: 159,
      end: 191,
      polygon: [[0.398, 0.500], [0.438, 0.494], [0.446, 0.606], [0.405, 0.606]],
    },
    {
      id: "postcard",
      start: 108,
      end: 141,
      polygon: [[0.537, 0.439], [0.603, 0.450], [0.600, 0.556], [0.550, 0.583], [0.531, 0.522]],
    },
    {
      id: "fineart",
      start: 51,
      end: 100,
      polygon: [[0.403, 0.394], [0.500, 0.387], [0.501, 0.528], [0.406, 0.528]],
    },
    {
      id: "carta",
      start: 25,
      end: 50,
      polygon: [[0.459, 0.322], [0.597, 0.314], [0.600, 0.444], [0.544, 0.472], [0.500, 0.450], [0.500, 0.391], [0.459, 0.394]],
    },
  ];

  // ---------- Elementos ----------
  const container = document.getElementById("animation-container");
  const canvas = document.getElementById("animation-canvas");
  const ctx = canvas.getContext("2d");
  const loader = document.getElementById("loader");
  const loaderFill = document.getElementById("loader-fill");
  const loaderText = document.getElementById("loader-text");
  const controls = document.getElementById("controls");
  const controlsToggle = document.getElementById("controls-toggle");
  const speedInput = document.getElementById("speed");
  const speedValue = document.getElementById("speed-value");
  const precisionInput = document.getElementById("precision");
  const precisionValue = document.getElementById("precision-value");
  const resetButton = document.getElementById("reset");

  // ---------- Estado ----------
  const frames = new Map();      // número do frame → HTMLImageElement | null
  const neededFrames = [];       // lista de todos os frames a carregar
  HOTSPOTS.forEach((h) => {
    for (let n = h.start; n <= h.end; n++) neededFrames.push(n);
  });
  if (!neededFrames.includes(CONFIG.baseFrame)) neededFrames.push(CONFIG.baseFrame);

  let currentFrame = -1;         // frame atualmente desenhado
  let activeHotspot = null;      // hotspot sob o cursor (ou null)
  let playingHotspot = null;     // hotspot cuja sequência está na tela
  let playhead = 0;              // posição (float) dentro da sequência
  let rafId = null;
  let lastTime = null;

  let speed = DEFAULTS.speed;
  let precision = DEFAULTS.precision / 100;

  // ---------- Utilidades ----------

  /** ezgif-frame-025.jpg */
  function frameFileName(frameNumber) {
    return `${CONFIG.path}${CONFIG.prefix}${String(frameNumber).padStart(CONFIG.padLength, "0")}${CONFIG.extension}`;
  }

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /** Se um frame não carregou, usa o frame vizinho mais próximo da mesma sequência. */
  function resolveFrame(frameNumber, hotspot) {
    if (frames.get(frameNumber)) return frames.get(frameNumber);
    const lo = hotspot ? hotspot.start : CONFIG.baseFrame;
    const hi = hotspot ? hotspot.end : CONFIG.baseFrame;
    for (let offset = 1; offset <= hi - lo; offset++) {
      const a = frameNumber - offset;
      const b = frameNumber + offset;
      if (a >= lo && frames.get(a)) return frames.get(a);
      if (b <= hi && frames.get(b)) return frames.get(b);
    }
    return frames.get(CONFIG.baseFrame) || null;
  }

  /** Teste ponto-em-polígono (ray casting). */
  function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /** Converte clientX/Y em fração da imagem e devolve o hotspot correspondente. */
  function hotspotAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    // Histerese: se o cursor ainda está sobre o hotspot ativo (com uma
    // pequena margem), mantém a seleção — evita "pulos" na borda.
    if (activeHotspot && pointInPolygon(x, y, expandedPolygon(activeHotspot))) {
      return activeHotspot;
    }
    for (const h of HOTSPOTS) {
      if (pointInPolygon(x, y, h.polygon)) return h;
    }
    return null;
  }

  /** Polígono levemente expandido a partir do centro (margem de tolerância). */
  const expandedCache = new WeakMap();
  function expandedPolygon(hotspot) {
    const margin = 0.01 + (1 - precision) * 0.05;
    const cached = expandedCache.get(hotspot);
    if (cached && cached.margin === margin) return cached.polygon;
    const cx = hotspot.polygon.reduce((s, p) => s + p[0], 0) / hotspot.polygon.length;
    const cy = hotspot.polygon.reduce((s, p) => s + p[1], 0) / hotspot.polygon.length;
    const polygon = hotspot.polygon.map(([px, py]) => {
      const dx = px - cx;
      const dy = py - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [px + (dx / len) * margin, py + (dy / len) * margin];
    });
    expandedCache.set(hotspot, { margin, polygon });
    return polygon;
  }


  // ---------- Renderização ----------

  function drawFrame(frameNumber, hotspot) {
    const img = resolveFrame(frameNumber, hotspot);
    if (!img) return;

    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    currentFrame = frameNumber;
  }

  /**
   * Loop: avança o playhead em direção ao alvo (fim da sequência enquanto o
   * cursor está sobre o objeto; início quando sai) e só redesenha quando o
   * frame inteiro muda.
   */
  function tick(now) {
    rafId = null;
    const dt = lastTime === null ? 0 : Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (!playingHotspot) {
      if (currentFrame !== CONFIG.baseFrame) drawFrame(CONFIG.baseFrame, null);
      lastTime = null;
      return;
    }

    const length = playingHotspot.end - playingHotspot.start;
    const target = activeHotspot === playingHotspot ? length : 0;
    const diff = target - playhead;

    // Suavização exponencial (ease-out): rápido no início, desacelera ao
    // chegar no alvo e para totalmente — o quadro final fica estático.
    const rate = CONFIG.fps * speed * 0.22; // constante de suavização
    const eased = diff * (1 - Math.exp(-rate * dt));
    const minStep = CONFIG.fps * speed * 0.15 * dt; // evita ficar lento demais
    let delta = Math.abs(eased) < minStep ? Math.sign(diff) * minStep : eased;
    if (Math.abs(delta) > Math.abs(diff)) delta = diff;

    if (Math.abs(diff) <= 0.02) playhead = target;
    else playhead += delta;


    const frameNumber = playingHotspot.start + Math.round(playhead);
    if (frameNumber !== currentFrame) drawFrame(frameNumber, playingHotspot);

    if (playhead !== target) {
      scheduleRender();
    } else if (target === 0 && activeHotspot !== playingHotspot) {
      // sequência voltou ao início: libera para o próximo objeto
      playingHotspot = null;
      lastTime = null;
      if (activeHotspot) startHotspot(activeHotspot);
      else if (currentFrame !== CONFIG.baseFrame) drawFrame(CONFIG.baseFrame, null);
    } else {
      lastTime = null;
    }
  }

  function scheduleRender() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(tick);
  }

  function startHotspot(hotspot) {
    playingHotspot = hotspot;
    playhead = 0;
    lastTime = null;
    scheduleRender();
  }

  // ---------- Interação ----------

  let pendingHotspot = null;
  let pendingTimer = null;

  function commitHotspot(hotspot) {
    if (hotspot === activeHotspot) return;
    activeHotspot = hotspot;
    container.classList.toggle("over-hotspot", !!hotspot);
    if (hotspot) container.classList.add("interacted");

    if (!playingHotspot) {
      if (hotspot) startHotspot(hotspot);
      return;
    }

    if (hotspot && hotspot !== playingHotspot && playhead === 0) {
      // sequência anterior já estava no início: troca imediatamente
      startHotspot(hotspot);
      return;
    }

    // caso contrário o loop cuida: rebobina a atual e depois inicia a nova
    scheduleRender();
  }

  /**
   * Só confirma a mudança se o cursor permanecer na nova região por um
   * curto período — impede que os elementos fiquem pulando.
   */
  function setActiveHotspot(hotspot) {
    if (hotspot === activeHotspot) {
      pendingHotspot = null;
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      return;
    }
    if (hotspot === pendingHotspot) return;

    pendingHotspot = hotspot;
    if (pendingTimer !== null) clearTimeout(pendingTimer);

    // entrar a partir do repouso é imediato; sair ou trocar tem carência
    const delay = activeHotspot === null ? 0 : 70 + (1 - precision) * 260;
    pendingTimer = window.setTimeout(() => {
      pendingTimer = null;
      commitHotspot(pendingHotspot);
    }, delay);
  }

  function handlePointer(clientX, clientY) {
    setActiveHotspot(hotspotAt(clientX, clientY));
  }


  function bindEvents() {
    container.addEventListener("mousemove", (e) => handlePointer(e.clientX, e.clientY), { passive: true });
    container.addEventListener("mouseleave", () => setActiveHotspot(null), { passive: true });

    // Toque: tocar/arrastar sobre um objeto dispara sua sequência
    const touch = (e) => {
      if (e.touches.length > 0) handlePointer(e.touches[0].clientX, e.touches[0].clientY);
    };
    container.addEventListener("touchstart", touch, { passive: true });
    container.addEventListener("touchmove", touch, { passive: true });
    container.addEventListener("touchend", () => setActiveHotspot(null), { passive: true });
    container.addEventListener("touchcancel", () => setActiveHotspot(null), { passive: true });
  }

  // ---------- Painel de ajustes ----------

  function applySpeed(value) {
    speed = Number(value);
    speedInput.value = String(speed);
    speedValue.textContent = speed.toFixed(1) + "×";
  }

  function applyPrecision(value) {
    const pct = Number(value);
    precision = pct / 100;
    precisionInput.value = String(pct);
    precisionValue.textContent = pct + "%";
  }

  function bindControls() {
    ["mousemove", "touchstart", "touchmove"].forEach((type) =>
      controls.addEventListener(type, (e) => e.stopPropagation())
    );
    ["mousemove", "touchstart", "touchmove"].forEach((type) =>
      controlsToggle.addEventListener(type, (e) => e.stopPropagation())
    );

    controlsToggle.addEventListener("click", () => {
      const collapsed = controls.classList.toggle("collapsed");
      controlsToggle.setAttribute("aria-expanded", String(!collapsed));
    });

    speedInput.addEventListener("input", (e) => applySpeed(e.target.value));
    precisionInput.addEventListener("input", (e) => applyPrecision(e.target.value));

    resetButton.addEventListener("click", () => {
      applySpeed(DEFAULTS.speed);
      applyPrecision(DEFAULTS.precision);
    });

    applySpeed(DEFAULTS.speed);
    applyPrecision(DEFAULTS.precision);
  }

  // ---------- Preload ----------

  function updateLoader(loaded) {
    const pct = Math.round((loaded / neededFrames.length) * 100);
    loaderFill.style.width = pct + "%";
    loaderText.textContent = `Carregando frames… ${pct}%`;
  }

  function preloadFrames() {
    return new Promise((resolve) => {
      let settled = 0;
      const onSettle = () => {
        settled++;
        updateLoader(settled);
        if (settled === neededFrames.length) resolve();
      };

      neededFrames.forEach((frameNumber) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          frames.set(frameNumber, img);
          onSettle();
        };
        img.onerror = () => {
          frames.set(frameNumber, null);
          console.warn("Frame não encontrado:", frameFileName(frameNumber));
          onSettle();
        };
        img.src = frameFileName(frameNumber);
      });
    });
  }

  // ---------- Inicialização ----------

  async function init() {
    bindControls();
    await preloadFrames();

    loader.classList.add("hidden");
    drawFrame(CONFIG.baseFrame, null);
    bindEvents();
  }

  init();
})();
