import { disableAi, getSample } from './ai';
import { button, el, euros } from './hud';
import type { Game } from './world';

// Mesa de ventas: CRM con los leads en una hoja tipo Excel. Eliges un lead,
// marcas su número a mano y le llamas. El cliente lo interpreta una IA con
// los datos del lead (si no hay IA, un cliente de guion). Si compra, la
// comisión queda pendiente y la cobras en el despacho del supervisor.

export const PRODUCTS = [
  { id: 'facturas', name: 'Automatización de facturas', price: 199, pitch: 'facturas y cobros automáticos' },
  { id: 'whatsapp', name: 'Chatbot de WhatsApp con IA', price: 149, pitch: 'responder clientes 24/7' },
  { id: 'crm', name: 'CRM automático', price: 299, pitch: 'seguimiento de clientes sin Excel' },
  { id: 'emails', name: 'Respuesta de emails con IA', price: 99, pitch: 'bandeja de entrada al día' },
  { id: 'reservas', name: 'Reservas online automáticas', price: 79, pitch: 'citas sin llamadas' },
];

interface Lead {
  id: string;
  name: string;
  role: string;
  company: string;
  sector: string;
  city: string;
  phone: string;
  employees: number;
  heat: 'frío' | 'tibio' | 'caliente';
  pain: string;
  budget: number;
  personality: string;
}

const FIRST = ['Carmen', 'Javier', 'Laura', 'Manolo', 'Sofía', 'Iván', 'Lucía', 'Andrés', 'Marta', 'Raúl', 'Elena', 'Pablo', 'Nuria', 'Diego', 'Rocío', 'Sergio'];
const LAST = ['García', 'López', 'Martín', 'Ruiz', 'Navarro', 'Ortega', 'Romero', 'Molina', 'Serrano', 'Castro', 'Delgado', 'Vidal'];
const BUSINESSES: [string, string, string][] = [
  ['Clínica dental', 'Salud', 'pierde citas porque la recepción no coge el teléfono'],
  ['Gimnasio', 'Deporte', 'los socios preguntan horarios por WhatsApp a todas horas'],
  ['Asesoría fiscal', 'Servicios', 'hace las facturas a mano y se le acumulan'],
  ['Restaurante', 'Hostelería', 'las reservas por teléfono se le cruzan los fines de semana'],
  ['Inmobiliaria', 'Inmobiliario', 'pierde leads porque no hace seguimiento'],
  ['Taller mecánico', 'Automoción', 'no da abasto con los presupuestos por email'],
  ['Tienda online de ropa', 'E-commerce', 'recibe 200 emails al día de clientes'],
  ['Academia de inglés', 'Educación', 'los alumnos se apuntan y se le olvida cobrarles'],
  ['Peluquería', 'Belleza', 'tiene huecos vacíos porque la gente no confirma la cita'],
  ['Empresa de reformas', 'Construcción', 'tarda días en mandar presupuestos y facturas'],
];
const CITIES = ['Madrid', 'Sevilla', 'Valencia', 'Bilbao', 'Málaga', 'Zaragoza', 'Barcelona', 'Murcia'];
const PERSONALITIES = [
  'desconfiado y seco, odia las llamadas comerciales',
  'simpático pero muy ocupado, quiere que vayas al grano',
  'tacaño, todo le parece caro y regatea',
  'curioso, hace muchas preguntas técnicas',
  'estresado, está atendiendo a clientes mientras habla',
  'escéptico con la IA, cree que es humo',
];

function makeLeads(seed: number): Lead[] {
  let n = seed;
  const r = (m: number) => {
    n = (n * 9301 + 49297) % 233280;
    return n % m;
  };
  return Array.from({ length: 12 }, (_, i) => {
    const [company, sector, pain] = BUSINESSES[r(BUSINESSES.length)];
    const name = `${FIRST[r(FIRST.length)]} ${LAST[r(LAST.length)]}`;
    const employees = 2 + r(40);
    return {
      id: `L${seed}-${i}`,
      name,
      role: r(2) ? 'dueño/a' : 'gerente',
      company: `${company} ${LAST[r(LAST.length)]}`,
      sector,
      city: CITIES[r(CITIES.length)],
      phone: `6${String(10000000 + r(89999999)).padStart(8, '0')}`,
      employees,
      heat: (['frío', 'tibio', 'caliente'] as const)[r(3)],
      pain,
      budget: 60 + r(5) * 60 + (employees > 20 ? 150 : 0),
      personality: PERSONALITIES[r(PERSONALITIES.length)],
    };
  });
}

export function salesPc(game: Game, onClose: () => void) {
  const { state, hud } = game;
  const leads = makeLeads(state.day * 7 + 3);
  hud.openPanel('PC · CRM de leads', (body) => {
    body.append(el('p', 'muted', 'Elige un lead, apunta su número y márcalo en el teléfono. Usa lo que pone en las notas para venderle.'));
    const wrap = el('div', 'sheet-wrap');
    const table = el('table', 'sheet');
    table.innerHTML = '<thead><tr><th></th><th>Nombre</th><th>Empresa</th><th>Ciudad</th><th>Teléfono</th><th>Emp.</th><th>Interés</th><th>Notas</th><th>Estado</th></tr></thead>';
    const tbody = el('tbody');
    leads.forEach((l, i) => {
      const called = state.data.calledLeads.includes(l.id);
      const tr = el('tr', called ? 'done' : '');
      tr.innerHTML = `<td>${i + 2}</td><td>${l.name}</td><td>${l.company}</td><td>${l.city}</td><td class="mono">${l.phone}</td><td>${l.employees}</td><td class="heat-${l.heat}">${l.heat}</td><td>${l.pain}</td><td>${called ? 'llamado' : 'pendiente'}</td>`;
      tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);
    body.append(wrap, button('📞 Abrir teléfono para marcar', () => dialer(game, leads, onClose)));
  }, onClose);
}

function dialer(game: Game, leads: Lead[], onClose: () => void) {
  const { hud } = game;
  let number = '';
  hud.openPanel('Teléfono', (body) => {
    const display = el('div', 'dial-display', ' ');
    const pad = el('div', 'keypad');
    const show = () => (display.textContent = number || ' ');
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '📞']) {
      pad.append(button(k, () => {
        if (k === '⌫') number = number.slice(0, -1);
        else if (k === '📞') {
          const lead = leads.find((l) => l.phone === number);
          if (!lead) {
            hud.toast(number.length < 9 ? 'Faltan cifras' : 'Ese número no existe. Míralo bien en el Excel.', 'bad');
            return;
          }
          call(game, lead, onClose);
          return;
        } else if (number.length < 9) number += k;
        show();
      }, k === '📞' ? 'key call' : 'key'));
    }
    // también se puede escribir con el teclado
    const typed = el('input', 'field') as HTMLInputElement;
    typed.placeholder = 'o escríbelo aquí';
    typed.inputMode = 'numeric';
    typed.oninput = () => {
      number = typed.value.replace(/\D/g, '').slice(0, 9);
      show();
    };
    typed.onkeydown = (e) => e.key === 'Enter' && (pad.lastElementChild as HTMLButtonElement).click();
    body.append(display, typed, pad, button('← Volver al CRM', () => salesPc(game, onClose), 'btn ghost'));
  }, onClose);
}

function instructions(lead: Lead) {
  const catalog = PRODUCTS.map((p) => `- ${p.name}: ${p.price} €/mes (${p.pitch})`).join('\n');
  return `Vas a interpretar a un cliente potencial que recibe una llamada comercial en un juego de rol de ventas. Mantente SIEMPRE en el personaje y responde en español de España, como hablando por teléfono, en 1 a 3 frases cortas.

Tu personaje:
- Nombre: ${lead.name}, ${lead.role} de "${lead.company}" (${lead.sector}, ${lead.city}, ${lead.employees} empleados).
- Problema real que tienes (no lo digas a la primera, que te lo descubran preguntando): ${lead.pain}.
- Carácter: ${lead.personality}.
- Interés inicial por el comercial: ${lead.heat}.
- Presupuesto máximo que pagarías al mes, en secreto: ${lead.budget} €.

El comercial vende automatizaciones de la empresa Brokerstars. Su catálogo:
${catalog}

Reglas para comprar (sé exigente y realista, que no sea fácil):
- Solo compras si el comercial: se presenta con educación, te hace preguntas y descubre tu problema, te propone un producto que de verdad lo resuelve, te explica el beneficio en tu negocio, y resuelve tu objeción principal (precio, confianza o tiempo).
- Si el precio supera tu presupuesto, pide descuento o prueba gratis; puedes aceptar una prueba o un precio menor si te convence.
- Si el comercial es borde, insistente, miente o suelta un rollo genérico, cuelgas.
- Si la conversación pasa de 10 mensajes sin cerrar, cuelgas con educación.

Al final de CADA respuesta añade en una línea aparte exactamente una etiqueta:
[SIGUE] si la llamada continúa,
[CUELGA] si cuelgas,
[COMPRA: nombre del producto; precio mensual acordado en número] si aceptas comprar.`;
}

// cliente de guion para cuando no hay IA: puntúa lo que dice el comercial
function scriptedReply(lead: Lead, history: string[], message: string) {
  const m = message.toLowerCase();
  const turn = history.length;
  let score = 0;
  for (const h of history) {
    const s = h.toLowerCase();
    if (/hola|buen(os|as)|soy|le llamo/.test(s)) score += 1;
    if (/\?/.test(s)) score += 1;
    if (/ahorr|tiempo|horas|automati|clientes|cit|factur|whats|email|reserv/.test(s)) score += 1;
    if (/prueba|gratis|sin permanencia|descuento/.test(s)) score += 1;
    if (/tonto|idiota|cállate|joder/.test(s)) score -= 5;
  }
  if (/tonto|idiota|cállate|joder/.test(m)) return 'Mira, no tengo tiempo para esto. Adiós.\n[CUELGA]';
  if (turn === 0) return `Vale… dime, pero rápido, que estoy liado con el ${lead.sector.toLowerCase() === 'hostelería' ? 'servicio' : 'trabajo'}. ¿Qué me vendes?\n[SIGUE]`;
  if (score >= 6 && turn >= 3) {
    const product = PRODUCTS.find((p) => m.includes(p.id) || m.includes(p.name.toLowerCase().split(' ')[0])) ?? PRODUCTS[0];
    const price = Math.min(product.price, lead.budget);
    return `Vale, me has convencido. Probamos con eso.\n[COMPRA: ${product.name}; ${price}]`;
  }
  if (turn >= 9) return 'Bueno, déjalo, ya si eso te llamo yo. Adiós.\n[CUELGA]';
  const answers = [
    `Ya, pero ¿eso qué tiene que ver conmigo? Lo que me pasa es que ${lead.pain}.`,
    '¿Y cuánto cuesta eso? Porque todo el mundo me quiere vender algo.',
    'No sé… ¿y si luego no funciona? No me fío mucho de estas cosas.',
    '¿Hay alguna prueba o algo? No pienso firmar nada a ciegas.',
  ];
  return `${answers[Math.min(answers.length - 1, Math.floor(score / 2))]}\n[SIGUE]`;
}

function call(game: Game, lead: Lead, onClose: () => void) {
  const { state, hud } = game;
  if (!state.data.calledLeads.includes(lead.id)) state.data.calledLeads.push(lead.id);
  state.data.energy = Math.max(0, state.data.energy - 8);
  state.persist();
  const turns: { role: 'user' | 'assistant'; content: string }[] = [];
  const said: string[] = [];
  let finished = false;
  hud.openPanel(`📞 ${lead.name} · ${lead.company}`, (body) => {
    const log = el('div', 'chat');
    const status = el('div', 'muted', 'Llamando… 📳');
    const box = el('textarea', 'field chat-input') as HTMLTextAreaElement;
    box.placeholder = 'Escribe lo que le dices al cliente y pulsa Enviar';
    const send = button('Enviar', () => speak());
    const hang = button('Colgar', () => end('Has colgado.'), 'btn ghost');
    const ref = el('div', 'muted small-text', `Ficha: ${lead.employees} empleados · interés ${lead.heat} · notas: ${lead.pain}`);
    body.append(ref, log, status, box, el('div', 'row'));
    (body.lastChild as HTMLElement).append(send, hang);
    const bubble = (who: 'me' | 'them', text: string) => {
      const b = el('div', who === 'me' ? 'bubble me' : 'bubble', text);
      log.append(b);
      log.scrollTop = log.scrollHeight;
      return b;
    };
    const end = (text: string) => {
      finished = true;
      status.textContent = text;
      box.disabled = true;
      send.disabled = true;
      hang.textContent = 'Volver al CRM';
      hang.onclick = () => salesPc(game, onClose);
    };
    const handle = (reply: string, b: HTMLElement) => {
      const tag = reply.match(/\[(SIGUE|CUELGA|COMPRA:[^\]]*)\]/i);
      const clean = reply.replace(/\[(SIGUE|CUELGA|COMPRA:[^\]]*)\]/gi, '').trim();
      b.textContent = clean || '…';
      turns.push({ role: 'assistant', content: reply });
      if (!tag) return;
      const t = tag[1].toUpperCase();
      if (t.startsWith('CUELGA')) end(`☎️ ${lead.name} ha colgado.`);
      else if (t.startsWith('COMPRA')) {
        const [, productName = PRODUCTS[0].name, priceText = '0'] = tag[1].match(/COMPRA:\s*([^;]+);\s*([\d.,]+)/i) ?? [];
        const price = Math.max(20, Number(String(priceText).replace(',', '.')) || PRODUCTS[0].price);
        const commission = Math.round(price * 1.5);
        state.addSale(commission);
        hud.toast(`✅ ¡VENTA! ${productName.trim()} a ${euros(price)}/mes · comisión ${euros(commission)}`, 'ok');
        end(`✅ Venta cerrada: ${productName.trim()} por ${euros(price)}/mes. Comisión de ${euros(commission)} pendiente: cóbrala en el despacho del supervisor.`);
      }
    };
    const speak = async () => {
      const text = box.value.trim();
      if (!text || finished) return;
      box.value = '';
      bubble('me', text);
      said.push(text);
      turns.push({ role: 'user', content: text });
      const b = bubble('them', '…');
      send.disabled = true;
      const sample = await getSample();
      if (sample) {
        try {
          const { text: reply } = await sample([{ role: 'user', content: instructions(lead) }, ...turns], {
            modelTier: 'quick',
            cache: false,
            onText: ({ text: t }: { text: string }) => (b.textContent = t.replace(/\[[^\]]*\]?$/, '')),
          });
          handle(reply, b);
        } catch (e) {
          const code = (e as { code?: string }).code;
          if (code === 'not_granted' || code === 'sampling_disabled') disableAi();
          handle(scriptedReply(lead, said.slice(0, -1), text), b);
        }
      } else {
        await new Promise((r) => setTimeout(r, 700));
        handle(scriptedReply(lead, said.slice(0, -1), text), b);
      }
      if (!finished) send.disabled = false;
      box.focus();
    };
    box.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        speak();
      }
    };
    // el cliente descuelga
    setTimeout(() => {
      status.textContent = 'En llamada';
      bubble('them', `¿Sí? ¿Quién es?`);
      turns.push({ role: 'user', content: '(El cliente descuelga el teléfono.)' });
      turns.push({ role: 'assistant', content: '¿Sí? ¿Quién es?\n[SIGUE]' });
      box.focus();
    }, 1200);
  }, onClose);
}

// despacho del supervisor: cobrar comisiones y ver tu rango
export function bossPanel(game: Game) {
  const { state, hud } = game;
  const ranks = [
    [0, 'Becario'], [3, 'Junior'], [10, 'Senior'], [25, 'Jefe de equipo'], [60, 'Leyenda'],
  ] as const;
  const rank = [...ranks].reverse().find(([n]) => state.data.sales >= n)![1];
  const next = ranks.find(([n]) => n > state.data.sales);
  hud.openPanel('Despacho del Sr. Ruiz', (body) => {
    body.append(el('div', 'bubble', state.data.pendingCommission > 0 ? '«Buen trabajo, chaval. Aquí tienes lo tuyo. Sigue así y subes.»' : '«¿Qué haces aquí? Ve a vender, que sin ventas no hay comisión.»'));
    body.append(el('div', 'muted', `Rango: ${rank} · ventas totales: ${state.data.sales}${next ? ` · ${next[0] - state.data.sales} ventas más para ${next[1]}` : ''}`));
    body.append(el('div', 'big', euros(state.data.pendingCommission)), el('div', 'muted', 'comisión pendiente de cobro'));
    const b = button('Cobrar comisión', () => {
      const c = state.collectCommission();
      if (c > 0) hud.toast(`💰 +${euros(c)} en tu cuenta`, 'ok');
      bossPanel(game);
    });
    b.disabled = state.data.pendingCommission <= 0;
    body.append(b);
  });
}
