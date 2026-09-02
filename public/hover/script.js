/**
 * Hover-driven frame animation
 * ------------------------------------------------------------
 * - Eixo X do mouse (0 → 1) mapeado linearmente para o intervalo
 *   de frames [FRAME_START, FRAME_END].
 * - Preload de todos os frames em cache (array de HTMLImageElement).
 * - Redesenho no canvas via requestAnimationFrame apenas quando o
 *   índice do frame realmente muda.
 * - Nomes gerados dinamicamente com padding de 3 dígitos.
 */
(function () {
  "use strict";

  // ---------- Configuração ----------
  const CONFIG = {
    path: "../frames/",          // pasta onde estão os frames
    prefix: "ezgif-frame-",       // prefixo do nome do arquivo
    extension: ".jpg",            // extensão (frames otimizados para web)
    frameStart: 25,               // ezgif-frame-025
    frameEnd: 232,                // ezgif-frame-232 (sequência completa)
    padLength: 3,                 // ezgif-frame-XXX
  };

  // ---------- Elementos ----------
  const container = document.getElementById("animation-container");
  const canvas = document.getElementById("animation-canvas");
  const ctx = canvas.getContext("2d");
  const loader = document.getElementById("loader");
  const loaderFill = document.getElementById("loader-fill");
  const loaderText = document.getElementById("loader-text");

  // ---------- Estado ----------
  const frames = [];          // cache: índice 0 → frameStart, ..., n-1 → frameEnd
  const totalFrames = CONFIG.frameEnd - CONFIG.frameStart + 1;
  let currentIndex = -1;      // índice atualmente desenhado
  let targetIndex = 0;        // índice pedido pelo mouse
  let rafId = null;           // id do requestAnimationFrame pendente

  // ---------- Utilidades ----------

  /** Gera o nome do arquivo com padding de 3 dígitos: ezgif-frame-025.png */
  function frameFileName(frameNumber) {
    return `${CONFIG.path}${CONFIG.prefix}${String(frameNumber).padStart(CONFIG.padLength, "0")}${CONFIG.extension}`;
  }

  /** Converte a posição X do cursor em porcentagem normalizada 0..1 */
  function normalizeX(clientX) {
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.min(1, Math.max(0, x / rect.width));
  }

  /** Mapeia 0..1 → índice de frame (0..totalFrames-1), arredondado */
  function percentToIndex(percent) {
    return Math.round(percent * (totalFrames - 1));
  }

  /**
   * Alguns frames podem faltar na sequência. Se o frame pedido não carregou,
   * usa o frame válido mais próximo já em cache.
   */
  function resolveFrame(index) {
    if (frames[index]) return frames[index];
    for (let offset = 1; offset < totalFrames; offset++) {
      if (frames[index - offset]) return frames[index - offset];
      if (frames[index + offset]) return frames[index + offset];
    }
    return null;
  }

  // ---------- Renderização ----------

  function drawFrame(index) {
    const img = resolveFrame(index);
    if (!img) return;

    // Ajusta a resolução interna do canvas à da imagem (uma vez)
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    currentIndex = index;
  }

  /** Agenda um redesenho só se ainda não houver um pendente */
  function scheduleRender() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (targetIndex !== currentIndex) {
        drawFrame(targetIndex);
      }
    });
  }

  // ---------- Interação ----------

  function handlePointerMove(clientX) {
    const percent = normalizeX(clientX);
    const nextIndex = percentToIndex(percent);

    // Evita trabalho desnecessário se o frame não mudou
    if (nextIndex === targetIndex) return;

    targetIndex = nextIndex;
    container.classList.add("interacted");
    scheduleRender();
  }

  function bindEvents() {
    container.addEventListener("mousemove", (e) => handlePointerMove(e.clientX), { passive: true });

    // Suporte opcional a toque (arrastar o dedo na horizontal)
    container.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length > 0) handlePointerMove(e.touches[0].clientX);
      },
      { passive: true }
    );
  }

  // ---------- Preload ----------

  function updateLoader(loaded) {
    const pct = Math.round((loaded / totalFrames) * 100);
    loaderFill.style.width = pct + "%";
    loaderText.textContent = `Carregando frames… ${pct}%`;
  }

  /**
   * Carrega todas as imagens em cache antes de liberar a interação.
   * Resolve mesmo que alguns frames falhem (eles são tratados em resolveFrame).
   */
  function preloadFrames() {
    return new Promise((resolve) => {
      let settled = 0;

      const onSettle = () => {
        settled++;
        updateLoader(settled);
        if (settled === totalFrames) resolve();
      };

      for (let i = 0; i < totalFrames; i++) {
        const frameNumber = CONFIG.frameStart + i;
        const img = new Image();
        img.decoding = "async";

        img.onload = () => {
          frames[i] = img;
          onSettle();
        };
        img.onerror = () => {
          frames[i] = null;
          console.warn("Frame não encontrado:", frameFileName(frameNumber));
          onSettle();
        };

        img.src = frameFileName(frameNumber);
      }
    });
  }

  // ---------- Inicialização ----------

  async function init() {
    await preloadFrames();

    loader.classList.add("hidden");
    drawFrame(0); // frame inicial (ezgif-frame-025)
    bindEvents();
  }

  init();
})();
