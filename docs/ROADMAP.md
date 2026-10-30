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
- [ ] Más juegos (gemas/diamantes, Mega Wheel…).

### Cajeros interactivos (Las Vegas / banco real)
- [ ] **Cajero BBVA SL**: entras → pantalla grande "inserte tarjeta" →
      metes tarjeta → PIN → ves saldo → sacar / ingresar, con interfaz de
      banco. Opción de **ingresar a un IBAN** (sin tarjeta).
- [ ] **Cajero Bitcoin estilo Bitbase**: compra cripto; **saca un papel con
      un QR** y luego lo **escaneas en otro apartado** del cajero. Sustituye
      al "tío que cambia bitcoin".
- [ ] App del móvil: **Bizum** y **transferencias** a otros amigos (IBAN).

### Supermercado (grande grande)
- [ ] Hacerlo mucho más grande (es clave: los dropshippers venden productos
      que aparecen en las **vitrinas**; si otro jugador compra, gana el
      vendedor). Se vende de todo: móviles, armas, etc.
- [ ] **Stand de tabaco** con distintos paquetes bien puestos en estantería +
      **máquina interactiva** al lado: aparece cada paquete con su precio,
      saca el tabaco y se paga en el autopago.
- [ ] **Autopago estilo Carrefour**: cuadrado con varias máquinas
      interactivas; metes productos → lista y total → pagar con efectivo o
      tarjeta → **ticket**. **Tarjeta de la tienda** (descuentos) que se mete
      antes de pagar.
- [ ] **Caja atendida**: dejas los artículos, el empleado los pasa, y el
      carrito se queda al lado de la caja.

### Ocio / animaciones
- [ ] Animaciones de fumar **más profesionales y de ~10 s**: se ve fumando,
      **liando un porro**, fumando **bong**, o **hinchando/vaciando un globo**.

### Identidad
- [ ] **Logo Brokerstar** (imagen azul "BROKERSTAR Global Financial
      Solutions") como logo de empresa/edificio, e icono del casino con el
      logo enviado (renombrar si colisiona con nombre existente).
- [ ] Móvil: **cambiar fondo de pantalla**, mejorar la interfaz.

### Deportivas
- [ ] Pantalla de partidos mejorada: **partidos de fútbol reales**, que
      **duren ~3 min** y se pueda apostar; varios a lo largo del día.

### Lado oscuro (versión GTA, abstracto)
- [ ] Sender con **campañas y logos**, CRM de **leads/conversiones**.
- [ ] **Víctimas** con **patrimonio estimado** y **nivel de seguridad**;
      decidir si "compensa" el golpe.
- [ ] **Golpe = minijuego de riesgo** (no credenciales reales), con premio
      abstracto y **calor policial** si falla.
- [ ] **Telegram de mulas** con cortes y porcentajes.

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
