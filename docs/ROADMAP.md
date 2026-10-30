# Brokerstars · Roadmap y backlog

> Este archivo es la memoria del proyecto entre sesiones. Tras un `/clear`,
> en el chat nuevo basta con decir: **"lee docs/ROADMAP.md y sigue con X"**.
> Juego: sim de vida 3D multijugador en una torre (Three.js + TS + Vite).
> Repo: https://github.com/Hiiinojosaa/Brokerstars
> Demo jugable (artifact): https://claude.ai/artifact/T1fPJkA7iEuS26swq45F9N

## Límites (acordados, NO cruzar)
- **Nada de iframes** de Evolution/Microgaming/casas reales: la demo está
  publicada (link compartible), esos sitios bloquean el embebido y es su IP.
  → Se recrean los juegos con implementación propia.
- **Lado oscuro = versión GTA (abstracta)**. NO se monta el flujo real de
  phishing: meter usuario+contraseña de una víctima y entrar en su banco a
  vaciarla es fraude real paso a paso. Sí: víctimas con patrimonio+seguridad,
  "golpe" como minijuego de riesgo, Sender con campañas, mulas con %.

## Hecho hasta ahora (demo 0.x)
- 4 plantas + ascensor real con puertas y botonera.
- Planta 0: banco (cuenta, tarjeta, PIN, préstamos) + MegaMart grande
  (vitrinas por categoría, electrónica, armería, carro grande con productos
  a la vista, caja atendida + 3 autocajas, productos de ocio).
- Planta 1: Wall Street (CRM/ventas con IA, trading con velas, dropshipping).
- Planta 2: Planta Gris abstracta (Sender, Banca, Telegram, mulas, calor).
- Planta 3: casino (ruleta, blackjack, póker, tragaperras, apuestas, bar,
  boutique, caja, VIP) + Crazy Time + Speed Baccarat + jugadores NPC.
- Móvil estilo iPhone: apps Banco, Wallet cripto, Mensajes, Tienda,
  **Casino "Royale Online"** (depositar/retirar, juega desde el móvil y se
  centra al abrir), **Noticias** (feed), **Chat** de colegas (local), Ajustes.
- **Ruleta Lightning** (primera versión): números con ⚡ y multiplicador en
  una tira arriba, la ficha tapa el número, lluvia de multiplicadores al
  hacer pleno a un número con rayo. (Sigue disponible como `roulettePanel`.)
- **Ruleta terminal MegaFire**: terminal con ruleta central, pantalla grande
  (JACKPOT + números en fuego) y puestos para **sentarse** (3 jugables + 2
  NPC). **Rondas por tiempo** (16 s de apuestas con cuenta atrás, giro
  automático, o "Girar ya"). Apuestas por zonas o números con la **ficha en el
  centro del número**. Si la bola cae en un **número en fuego** donde tienes
  ficha → **minijuego MegaFire**: bolas que caen en una rejilla 5×4 con
  multiplicadores (×1…×20), **lluvia = tirada gratis** (3 seguidas y acaba),
  al final se **suman los multiplicadores**, y si se **llenan los bloques con
  estrella** → **ruleta de bonus ×10/×100/×500/×1000**. En móvil (Royale
  Online) y en la Planta 3. `megaFireTerminalPanel` en `src/game/casino.ts`;
  terminal 3D `megaFireTerminal()` en `src/scene/casino.ts`; CSS al final de
  `src/game/game.css`.

---

## Backlog (siguientes bloques, uno por turno/chat)

### Casino
- [x] Ruleta terminal + minijuego MegaFire.
- [x] **Slots MegaFire**: orbes 🔥 con multiplicador, colector 💰 que los
      cobra todos, 3+ ⭐ = tiradas gratis con multiplicador creciente, 🎁 =
      ruleta de bonus ×10…×1000. `megaFireSlotsPanel` en `src/game/casino.ts`,
      cabina 3D `megaFireSlotsCabinet()`, en el móvil y en el menú de slots.
- [x] Sentarse físicamente en las mesas: ruleta MegaFire (ya), blackjack,
      póker y baccarat. Taburete por mesa; al cerrar la ventana te levantas.
- [x] Más juegos: **Gemas (Mines)** (descubre gemas, evita bombas, 3/5/10
      bombas, retírate cuando quieras) y **Mega Wheel** (rueda del dinero con
      top slot). `minesPanel`/`megaWheelPanel`; arcades 3D en la Planta 3 y en
      el móvil.

### Cajeros interactivos (Las Vegas / banco real)
- [x] **Cajero BBVA SL**: pantalla "inserte su tarjeta" → insertar tarjeta →
      PIN → saldo → sacar / ingresar. Además **ingreso a un IBAN sin tarjeta**
      (metes efectivo y lo manda a esa cuenta). `atmPanel` en `src/game/bank.ts`.
- [x] **Cajero Bitcoin Bitbase** (en el vestíbulo, junto a los cajeros):
      comprar cripto con efectivo → **imprime un vale con QR** → lo
      **escaneas en el lector** del cajero y recibes la cripto; también vende
      cripto por efectivo. `bitbasePanel` en `src/game/bank.ts`. (La mesa OTC
      del cambista de la Planta Gris sigue, es lavado del lado oscuro.)
- [x] App del móvil (banco → Enviar): **Bizum** a colegas (contactos +
      importes rápidos) y **transferencias** por IBAN. En `bankApp` (apps.ts).

### Supermercado (grande grande)
- [~] Más grande por dentro: **pasillos (góndolas)** en el centro con
      productos a la vista y **2 categorías nuevas** (Frescos: fruta/pan/lácteos
      y Hogar/limpieza, 11 productos). Pendiente de la fase multijugador: que
      los dropshippers vendan en las vitrinas y gane el vendedor cuando otro
      jugador compra (requiere servidor).
- [x] **Máquina de tabaco** junto al estanco: expendedora con los paquetes;
      eliges y se cobra en el autopago (abre la selección del estanco).
- [x] **Autopago estilo Carrefour**: varias autocajas; lista + total →
      **tarjeta de la tienda** (−8%, alta gratis) → pagar efectivo/tarjeta →
      **ticket impreso** con sello PAGADO. `checkoutPanel('self')`.
- [x] **Caja atendida**: el cajero "pasa" los artículos (barra de escaneo)
      antes de poder pagar; el carrito se queda al lado. `checkoutPanel('staffed')`.

### Ocio / animaciones
- [x] Animaciones de ocio de ~10 s en `Character`: fumar (cigarro a la boca con
      caladas, brasa que brilla y se consume, humo), **liar un porro** (lo lía
      entre las manos ~5 s y luego lo fuma), **bong** y **globo** (se hincha y
      se vacía dando bandazos con escape de aire).

### Identidad
- [x] **Logo Brokerstar** (azul "BROKERSTAR · Global Financial Solutions" con
      estrella) generado por canvas: cartel 3D sobre la entrada del vestíbulo
      y cabecera de Ajustes (`brokerstarLogoDataUrl` en apps.ts).
- [x] Móvil: **cambiar fondo de pantalla** (6 fondos en Ajustes, se guarda la
      elección) + barra de estado. Falta: icono del casino con el logo enviado
      (no tengo el archivo de imagen).

### Deportivas
- [x] Apuestas deportivas mejoradas: partidos reales de **~3 min** (antes 5),
      que se juegan **en orden uno tras otro todo el día**, con lista de
      **próximos partidos** y cuenta atrás, y **apuestas pre-partido** a los
      que aún no han empezado (además del que está en juego).

### Lado oscuro (versión GTA, abstracto)
- [x] Sender con **plantillas/logos** de campaña (paquetería, banco, premio…)
      que afectan a la calidad, y **CRM** con embudo (leads, golpes,
      conversiones, tasa de éxito, ganado).
- [x] **Víctimas** con **patrimonio estimado** y **nivel de seguridad** 🛡️
      (1-5) + pista de si "compensa"; la seguridad sube la dificultad del
      golpe y la busca si fallas.
- [x] **Golpe = minijuego de riesgo** (llamada con decisiones, sin credenciales
      reales), premio abstracto y **busca policial** si falla (ya existía,
      ahora escala con la seguridad).
- [x] **Telegram de mulas** con cortes y porcentajes (ya existía).

### Multijugador (fase grande)
- [ ] Servidor autoritativo: chat real, ver a los colegas, **cada grupo su
      edificio** y visitar otros para métodos/negocios.
- [ ] Dropshipping colaborativo real entre jugadores.

---

## Flujo de trabajo (para ahorrar tokens)
- Un bloque por chat. Al acabar: `/clear` y nuevo chat.
- En el chat nuevo: **"lee docs/ROADMAP.md y sigue con <bloque>"**.
- Modelo barato (`/model sonnet`) para lo simple; Opus para lógica compleja.
- Actualizar este archivo al cerrar cada bloque (marcar [x] y mover a "Hecho").
- Verificar con `npm run build`, commitear cada bloque y pushear.
- Desplegar la demo: `npm run build` (ya usa `base: './'`) y republicar el
  `dist/` en el artifact → https://claude.ai/artifact/T1fPJkA7iEuS26swq45F9N

---

## SIGUIENTE CHAT: "lee docs/ROADMAP.md y sigue con el multijugador"
Estado a día de hoy (todo en `main`, árbol limpio, el juego arranca sin
errores de consola; demo artifact actualizado a la Versión 9 en el enlace de
arriba): completado todo el backlog de casino, súper, cajeros, deportivas,
lado oscuro, identidad y ocio. **Lo único que queda es el Multijugador.**

Antes de picar código del multijugador, decidir:
1. **Backend / infra**: elegir servidor (Node + WebSockets / Colyseus, o
   Firebase, …) y **dónde se hostea de verdad**. OJO: el contenedor de estas
   sesiones es efímero y sin servidor persistente, así que esto no se puede
   “dejar corriendo” aquí; hay que desplegarlo fuera.
2. **Alcance de la 1ª iteración**: servidor autoritativo, chat real, ver a los
   colegas moverse, y "cada grupo su edificio" + visitar otros. El dropshipping
   colaborativo (vender en vitrinas y que gane el vendedor cuando otro compra)
   va después.
3. **Estado del juego**: hoy es 100% local (`localStorage`, clave
   `brokerstars.partida.v2`, en `src/game/state.ts`). Hay que separar lo que
   pasa a ser autoritativo del servidor de lo que sigue siendo local.

Sugerencia para el chat nuevo: que lo primero sea **proponer un plan de
arquitectura del multijugador** (infra + qué se mueve al servidor + protocolo)
y aprobarlo antes de tocar código.
