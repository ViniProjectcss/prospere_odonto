/**
 * FrameSequence: carrega a sequência de frames de forma PROGRESSIVA.
 * Ordem: a cada 8 frames -> a cada 4 -> a cada 2 -> todos.
 * Assim o scroll já funciona (com menos suavidade) assim que o primeiro
 * passe termina, e vai ficando mais fluido enquanto o resto carrega.
 */
export class FrameSequence {
  constructor(manifest, { stride = 1, onProgress } = {}) {
    this.manifest = manifest;
    this.stride = stride; // em telas fracas usamos 1 a cada N frames
    this.indices = [];
    for (let i = 0; i < manifest.frames; i += stride) this.indices.push(i);
    this.count = this.indices.length;
    this.images = new Array(this.count).fill(null);
    this.loaded = 0;
    this.onProgress = onProgress;
    this.width = manifest.width;
    this.height = manifest.height;
  }

  url(frameNumber) {
    const n = String(frameNumber + 1).padStart(this.manifest.digits, '0');
    return this.manifest.pattern.replace('{n}', n);
  }

  /** ordem de prioridade (grossa -> fina) sobre os índices locais */
  order() {
    const seen = new Set();
    const out = [];
    for (const step of [8, 4, 2, 1]) {
      for (let i = 0; i < this.count; i += step) {
        if (!seen.has(i)) { seen.add(i); out.push(i); }
      }
    }
    if (!seen.has(this.count - 1)) out.unshift(this.count - 1);
    return out;
  }

  loadOne(local) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.images[local] = img;
        this.loaded++;
        this.onProgress?.(this.loaded / this.count);
        resolve();
      };
      img.onerror = () => resolve(); // frame faltando não quebra a experiência
      img.src = this.url(this.indices[local]);
    });
  }

  /**
   * Inicia o carregamento. Resolve quando o primeiro passe (stride 8) termina;
   * o restante continua em segundo plano.
   */
  start({ concurrency = 6 } = {}) {
    const queue = this.order();
    const firstPass = queue.filter((i) => i % 8 === 0 || i === this.count - 1).length;
    let cursor = 0;
    let doneFirst;
    const gate = new Promise((r) => (doneFirst = r));
    let finished = 0;

    const worker = async () => {
      while (cursor < queue.length) {
        const local = queue[cursor++];
        await this.loadOne(local);
        finished++;
        if (finished === firstPass) doneFirst();
      }
    };
    Promise.all(Array.from({ length: concurrency }, worker)).then(doneFirst);
    return gate;
  }

  /** frame mais próximo já carregado (procura para trás e para frente) */
  nearest(local) {
    if (this.images[local]) return this.images[local];
    for (let d = 1; d < this.count; d++) {
      const a = this.images[local - d];
      if (a) return a;
      const b = this.images[local + d];
      if (b) return b;
    }
    return null;
  }
}
