import { COLORS, DEFAULT_CHARACTER, OPTIONS, PRESETS } from '../characters/catalog';
import type { Pose } from '../characters/Character';
import type { CharacterConfig } from '../characters/types';

// Panel del creador de personajes. No sabe nada de Three.js: solo
// edita un CharacterConfig y avisa con onChange.

type OptionKey = keyof typeof OPTIONS;
type ColorKey = { [K in keyof CharacterConfig]: CharacterConfig[K] extends string ? K : never }[keyof CharacterConfig];

type Field =
  | { kind: 'option'; key: OptionKey; label: string }
  | { kind: 'color'; key: ColorKey; label: string; palette: keyof typeof COLORS };

const TABS: { id: string; label: string; fields: Field[] }[] = [
  {
    id: 'cuerpo',
    label: 'Cuerpo',
    fields: [
      { kind: 'option', key: 'build', label: 'Complexión' },
      { kind: 'color', key: 'skin', label: 'Piel', palette: 'skin' },
      { kind: 'color', key: 'hair', label: 'Pelo', palette: 'hair' },
    ],
  },
  {
    id: 'cabeza',
    label: 'Cabeza',
    fields: [
      { kind: 'option', key: 'face', label: 'Cara' },
      { kind: 'option', key: 'hairStyle', label: 'Peinado' },
      { kind: 'option', key: 'facialHair', label: 'Barba' },
      { kind: 'option', key: 'hat', label: 'Gorra / gorro' },
      { kind: 'color', key: 'hatColor', label: 'Color gorra', palette: 'cloth' },
      { kind: 'option', key: 'glasses', label: 'Gafas' },
    ],
  },
  {
    id: 'arriba',
    label: 'Arriba',
    fields: [
      { kind: 'option', key: 'top', label: 'Prenda' },
      { kind: 'color', key: 'topColor', label: 'Color', palette: 'cloth' },
      { kind: 'color', key: 'sleeveColor', label: 'Color camisa / manga larga', palette: 'cloth' },
      { kind: 'option', key: 'tie', label: 'Corbata' },
      { kind: 'option', key: 'print', label: 'Estampado' },
    ],
  },
  {
    id: 'abajo',
    label: 'Abajo',
    fields: [
      { kind: 'option', key: 'pants', label: 'Pantalón' },
      { kind: 'color', key: 'pantsColor', label: 'Color', palette: 'denim' },
      { kind: 'option', key: 'shoes', label: 'Zapatillas' },
      { kind: 'color', key: 'shoesColor', label: 'Color zapas', palette: 'cloth' },
    ],
  },
  {
    id: 'joyas',
    label: 'Joyas',
    fields: [
      { kind: 'option', key: 'chain', label: 'Cadena' },
      { kind: 'option', key: 'watch', label: 'Reloj' },
    ],
  },
];

const POSES: Record<Pose, string> = { quieto: 'Quieto', presentacion: 'Pose A', sentado: 'Sentado', pose: 'Pose', brazos_cruzados: 'Brazos cruzados', billetes: 'Billetes' };

const STORAGE_KEY = 'brokerstars.character';

export function loadSaved(): CharacterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CHARACTER, ...JSON.parse(raw) };
  } catch {
    // sin almacenamiento: empezamos con el personaje por defecto
  }
  return { ...PRESETS[0] };
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function randomCharacter(name: string): CharacterConfig {
  const opt = <K extends OptionKey>(k: K) => pick(Object.keys(OPTIONS[k])) as CharacterConfig[K];
  return {
    name,
    build: opt('build'),
    skin: pick(COLORS.skin),
    hair: pick(COLORS.hair),
    face: opt('face'),
    hairStyle: opt('hairStyle'),
    facialHair: opt('facialHair'),
    hat: opt('hat'),
    hatColor: pick(COLORS.cloth),
    glasses: opt('glasses'),
    top: opt('top'),
    topColor: pick(COLORS.cloth),
    sleeveColor: pick(COLORS.cloth),
    print: opt('print'),
    pants: opt('pants'),
    pantsColor: pick(COLORS.denim),
    shoes: opt('shoes'),
    shoesColor: pick(COLORS.cloth),
    chain: opt('chain'),
    watch: opt('watch'),
    tie: opt('tie'),
  };
}

export function createCreator(
  root: HTMLElement,
  initial: CharacterConfig,
  handlers: { onChange: (c: CharacterConfig) => void; onPose: (p: Pose) => void; onRetro: (on: boolean) => void },
) {
  let config = { ...initial };
  let tab = TABS[0].id;
  let pose: Pose = 'quieto';
  let retro = false;

  const set = (next: CharacterConfig) => {
    config = next;
    handlers.onChange(config);
    render();
  };

  const el = (tag: string, cls = '', text = '') => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };

  const chip = (label: string, active: boolean, onClick: () => void) => {
    const b = el('button', 'chip' + (active ? ' active' : ''), label) as HTMLButtonElement;
    b.type = 'button';
    b.onclick = onClick;
    return b;
  };

  function render() {
    root.innerHTML = '';

    const header = el('div', 'panel-header');
    header.append(el('div', 'brand', 'BROKERSTARS'), el('div', 'subtitle', 'Crea tu personaje'));
    const name = el('input', 'name-input') as HTMLInputElement;
    name.value = config.name;
    name.maxLength = 20;
    name.placeholder = 'Nombre';
    name.oninput = () => {
      config = { ...config, name: name.value };
      handlers.onChange(config);
    };
    header.append(name);
    root.append(header);

    const presets = el('div', 'row');
    presets.append(el('span', 'row-label', 'Plantillas'));
    for (const p of PRESETS) presets.append(chip(p.name, false, () => set({ ...p })));
    presets.append(chip('🎲 Aleatorio', false, () => set(randomCharacter(config.name))));
    root.append(presets);

    const tabs = el('div', 'tabs');
    for (const t of TABS) {
      tabs.append(chip(t.label, t.id === tab, () => {
        tab = t.id;
        render();
      }));
    }
    root.append(tabs);

    const body = el('div', 'tab-body');
    for (const f of TABS.find((t) => t.id === tab)!.fields) {
      const group = el('div', 'field');
      group.append(el('div', 'field-label', f.label));
      const opts = el('div', 'options');
      if (f.kind === 'option') {
        for (const [value, label] of Object.entries(OPTIONS[f.key])) {
          opts.append(chip(label, config[f.key] === value, () => set({ ...config, [f.key]: value })));
        }
      } else {
        for (const color of COLORS[f.palette]) {
          const s = chip('', config[f.key] === color, () => set({ ...config, [f.key]: color }));
          s.classList.add('swatch');
          s.style.background = color;
          s.title = color;
          opts.append(s);
        }
      }
      group.append(opts);
      body.append(group);
    }
    root.append(body);

    const footer = el('div', 'row footer');
    footer.append(el('span', 'row-label', 'Pose'));
    for (const [p, label] of Object.entries(POSES) as [Pose, string][]) {
      footer.append(chip(label, pose === p, () => {
        pose = p;
        handlers.onPose(p);
        render();
      }));
    }
    root.append(footer);

    const look = el('div', 'row');
    look.append(el('span', 'row-label', 'Imagen'));
    look.append(chip('Filtro PS2', retro, () => {
      retro = !retro;
      handlers.onRetro(retro);
      render();
    }));
    root.append(look);

    const actions = el('div', 'actions');
    const save = el('button', 'primary', 'Guardar personaje') as HTMLButtonElement;
    save.onclick = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        save.textContent = '✓ Guardado';
      } catch {
        save.textContent = 'No se pudo guardar';
      }
      setTimeout(() => (save.textContent = 'Guardar personaje'), 1500);
    };
    const exportBtn = el('button', 'secondary', 'Copiar JSON') as HTMLButtonElement;
    exportBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
        exportBtn.textContent = '✓ Copiado';
      } catch {
        exportBtn.textContent = 'No se pudo copiar';
      }
      setTimeout(() => (exportBtn.textContent = 'Copiar JSON'), 1500);
    };
    const play = el('button', 'primary', '▶ Jugar') as HTMLButtonElement;
    play.onclick = () => {
      // se guarda el personaje y se entra a la torre con él
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch {
        // sin almacenamiento se juega con el personaje por defecto
      }
      location.href = './index.html';
    };
    actions.append(play, save, exportBtn);
    root.append(actions);
  }

  render();
}
