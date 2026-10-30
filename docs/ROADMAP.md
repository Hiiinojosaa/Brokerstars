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
  hacer pleno a un número con rayo.

---

## PRÓXIMO (prioridad): Ruleta terminal estilo casino físico (MegaFire/Lightning)
Referencia: terminal tipo ZUUM (varios puestos alrededor de una ruleta
central, pantalla grande arriba con JACKPOT y números en fuego).

Cómo debe funcionar (reemplaza el "pulsar E → panel soso" actual):
1. **Te sientas** en un puesto del terminal (como sentarse en una silla).
   La cámara mira a la pantalla del puesto.
2. **La ruleta gira SOLA cada X tiempo** (ronda por tiempo, p.ej. 30-40 s):
   - Fase de apuestas con cuenta atrás (barra/segundos en pantalla).
   - Apuestas en la pantalla táctil: por **zonas** (docenas, color, par/impar…)
     o por **números**; la **ficha queda en el centro del número y lo tapa**.
   - Giro: **bola ultra realista** cayendo (ya existe el canvas, mejorarlo).
3. **Pantalla superior** (la grande del terminal): en cada tiro aparecen
   **números en fuego** (los "lucky/fire numbers") con su multiplicador.
4. **Minijuego cuando toca un número en fuego** (estilo MegaFire):
   - Caen **bolas** que se quedan en **cuadrados/bloques**.
   - Caen **multiplicadores** x1 x2 x4 x5 x10 x15 x20…
   - Si **llueve** (las bolas NO se quedan en los cuadrados) → **tirada gratis**;
     si llueve **3 veces seguidas**, acaba.
   - Al final se **suman los multiplicadores** acumulados = premio.
   - Si se **rellenan bloques** y hay una **estrella arriba** → sale una
     **ruleta de bonus x10 x100 x500 x1000**.
5. Mantener el "no deja de ser un juego": fichas del casino, nada de €.

Notas de implementación:
- Hoy la ruleta es `roulettePanel` en `src/game/casino.ts` (canvas de rueda
  + bola + tapete DOM + tira Lightning). Hay que convertirla en experiencia
  de terminal con **ronda por tiempo** y el **minijuego de bolas/bloques**.
- El terminal 3D está en `src/scene/casino.ts` (mesas `rouletteTable`).
  Añadir puestos para sentarse (pose 'sentado' ya existe en Character).
- CSS de la ruleta/Lightning al final de `src/game/game.css`.

---

## Backlog (siguientes bloques, uno por turno/chat)

### Casino
- [ ] Ruleta terminal + minijuego MegaFire (arriba, PRIORIDAD).
- [ ] **Slots estilo MegaFire**: con multiplicadores que caen, bonus y
      tiradas gratis (misma estética que la ruleta nueva).
- [ ] Sentarse físicamente en las mesas (ruleta, blackjack, baccarat).
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
