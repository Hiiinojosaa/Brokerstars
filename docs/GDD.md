# Brokerstars — Documento de diseño

> Una torre, tus colegas y una sola pregunta: ¿hasta dónde vas a llegar?
> Abres tu cuenta en el banco con cuatro duros, eliges a qué te dedicas y
> empiezas a hacer dinero… para fundírtelo en el casino de la última planta.

Todo es ficticio: empresas, bancos, monedas, webs, marcas y equipos son
inventados o parodias, como en GTA. **En el casino solo se juega con dinero
del juego; nunca habrá apuestas con dinero real** (si no, el juego pasaría
a ser un juego de azar regulado y no se podría publicar).

---

## 1. Visión
- **Estilo:** personajes estilizados con proporciones humanas, oficinas
  cálidas con luz de tarde, colores vivos. Referencia: juegos de oficina de
  estafadores y GTA. Hojas de diseño en `docs/diseno/`.
- **Multijugador para rolear:** hasta 32 jugadores por torre, chat de voz de
  proximidad, cada uno con su rol. La gracia es lo que pasa *entre* jugadores.
- **Lo que todo el mundo persigue:** pasta, relojes, coches, el ático, ser el
  número 1 del ranking y que tus colegas lo vean.

## 2. El bucle que no te deja parar
1. **Trabajas** en tu rol (minijuegos cortos de 1-3 min) → efectivo, banco o cripto.
2. **Mejoras**: subes de rango, contratas equipo, compras mejor ordenador.
3. **Tratas con otros jugadores**: vendes leads, cambias cripto, pides favores.
4. **Gastas**: casino, lujo, el súper, fiestas.
5. **Presumes**: ranking semanal «Forbes Brokerstars», tu ropa, tu reloj, tu coche.
6. Siempre hay algo a medias: un pedido que llega, una mula en camino, un
   partido que empieza en 2 minutos, una votación en el ayuntamiento.

## 3. La Torre Brokerstars
| Planta | Qué hay | Para qué |
|---|---|---|
| **Azotea** | Ático y helipuerto (fase futura) | Lujo máximo: el sitio del nº 1 |
| **Planta 3 · Casino Royale** | Ruleta, póker, blackjack, tragaperras, apuestas deportivas, bar, sala VIP | Gastar todo lo ganado con los colegas |
| **Planta 2 · La Planta Gris** | Estafadores y muleros, hacker, político y sala de prensa, mesa OTC de cripto | Dinero rápido con riesgo |
| **Planta 1 · Los Negocios** | Brokers, dropshipping, agencia de contenido, booking, oficina de eventos, cocina | Dinero «legal» |
| **Planta 0 · Calle** | Banco con cajeros, MegaMart, entrada y seguridad | Empezar, comprar y sacar dinero |

En **cada planta de trabajo** hay ordenadores, cajeros ATM, impresora, cocina
con microondas, máquina de café, baños y taquillas para guardar cosas.

## 4. Empezar a jugar (Planta 0)
1. Creas tu personaje (creador actual).
2. Entras al **banco** («Banco Estrella»): abres tu cuenta, te dan tarjeta,
   PIN y 500 € de bienvenida. Desde aquí: transferencias entre jugadores,
   préstamos con intereses, historial y la app del banco en el móvil.
3. Eliges tu **primer rol** (puedes cambiar más tarde, pero pierdes rango).
4. Pasas por el **MegaMart** a por café y comida.

### Tres tipos de dinero
- **Efectivo:** lo que llevas encima. Te lo pueden robar; se saca en cajeros.
- **Banco:** seguro, pero los movimientos se ven (Hacienda y policía).
- **Cripto:** rápido y difícil de rastrear. Sube y baja de precio.

## 5. Roles y equipos
Cada negocio puede tener **equipo**. El jefe decide los **porcentajes** del
reparto y todos los ven en la app del equipo.

### Planta 1 · Los Negocios
- **Broker (trabaja solo).** Gráficas en tiempo real de criptos y acciones
  inventadas, órdenes con apalancamiento, noticias que mueven el mercado (el
  político y la prensa también las mueven). Puede **cambiar cripto por euros
  a los estafadores** en la mesa OTC cobrando comisión, a riesgo de quedar
  «manchado».
- **Dropshipper.** Busca productos en tendencia desde el ordenador, monta la
  tienda, pone precio, lanza anuncios y gestiona pedidos, reseñas y
  devoluciones. Equipo: atención al cliente y creador de anuncios.
- **Agencia de contenido.** Consigue clientes, automatiza sus redes y les
  entrega vídeos. Ingresos mensuales fijos. Equipo: editores.
- **Booker de artistas.** Ficha artistas (NPC o jugadores que rapean o
  pinchan), negocia cachés y cierra bolos. Cobra comisión.
- **Promotor de eventos.** Monta fiestas en el casino o en la azotea: alquila
  la sala, cierra el cartel con el booker, vende entradas. Si viene poca gente,
  pierde dinero.

### Planta 2 · La Planta Gris
- **Estafador (jefe).** Desde su puesto hace llamadas y campañas falsas
  (minijuego de guion). Lo que entra no se puede tocar directamente: hay que
  sacarlo.
- **Mulero.** Recluta **mulas** (NPC) y las manda a los cajeros a sacar el
  dinero. Cada mula puede ser pillada, desaparecer con la pasta o salir bien.
  El reparto típico: estafador / mulero / mula, en los porcentajes que pacten.
- **Hacker.** Contratos desde su ordenador (minijuego de hackeo): entrar en
  la web de un político (filtrar a la prensa o chantajear), robar bases de
  leads para venderlas a estafadores y dropshippers, tumbar la tienda de un
  rival, o cobrar por *proteger* a otros jugadores. Rigs de minado: dinero
  pasivo, pero suben la factura de la luz.
- **Político.** Hace campaña, da ruedas de prensa, recibe «donaciones», adjudica
  contratos y **aprueba leyes que afectan a toda la torre**: impuestos, más o
  menos policía, licencia del casino, horario del MegaMart. Si el hacker o la
  prensa le pillan, escándalo.
- **Prensa (NPC al principio, rol de jugador más adelante).** Publica
  noticias que mueven precios y reputaciones. Se puede sobornar o filtrar.

### Cómo se conectan
- Hacker → vende leads → estafador y dropshipper.
- Estafador → dinero → mulero → mulas → cajeros.
- Estafador → cripto → broker (OTC) → euros limpios con comisión.
- Político ↔ prensa: noticias, desmentidos, sobornos.
- Hacker → web del político → filtración a la prensa → el precio de las
  criptos y la reputación del político se mueven.
- Promotor + booker → fiesta → todos gastan.

### Riesgo: la busca
Lo de la Planta Gris sube tu **nivel de busca** (0-5 estrellas). Con busca
alta hay inspecciones, redadas, cuentas congeladas o cárcel (minijuego y
tiempo fuera). Se baja con abogado, sobornos al político o esperando.

## 6. Planta 3 · Casino Royale
- Fichas compradas en la caja con dinero del juego. **Nunca dinero real.**
- **Ruleta** europea, **blackjack**, **tragaperras** temáticas.
- **Póker Texas Hold'em entre amigos:** mesas públicas y privadas con contraseña.
- **Apuestas deportivas:** partidos históricos reales de equipos reales, que se
  ven *en directo* en las pantallas resumidos en 5 minutos. Los nombres de los
  equipos salen de un archivo de datos (para publicar, revisar licencias de
  nombres y escudos). Apuestas a
  ganador, goles y apuestas en vivo durante el partido.
- **Bar** (consumibles), **sala VIP High Roller** (solo con estatus) y
  **escenario** para las fiestas del promotor.
- Todo se juega con los colegas que estén en la sala.

## 7. Planta 0 · MegaMart
Supermercado 24 h; lo que compras va al **inventario** (por huecos y peso).
- **Comida precocinada** → se calienta en el microondas de cualquier planta.
- **Bebidas:** refrescos (parodias), refrescos exóticos importados, café, energéticas.
- **Para mezclar:** jarabe + refresco de lima-limón = bebida «Púrpura».
- **Gas de la risa** (globos), **hierba** del estanco del súper.
- **Armería** al fondo, con licencia (requisito: busca baja).
- Ropa, relojes y joyas de imitación (las buenas, en tiendas de lujo).

### Necesidades y efectos
- **Hambre** y **energía** bajan con el tiempo; si están bajas, los minijuegos
  salen peor. Comida y café las suben.
- Los consumibles «de fiesta» tienen efectos visuales y de juego: Púrpura
  (cámara lenta, todo se ve morado), gas de la risa (risa y visión
  ondulada), hierba (más ánimo, menos concentración). Consumir en el trabajo
  baja tu rendimiento y el supervisor lo puede ver.

## 8. Progresión y presumir
- **Rangos por rol:** Becario → Junior → Senior → Jefe → Leyenda. Cada rango
  desbloquea herramientas (mejor ordenador, más pantallas, contratar equipo).
- **Estatus:** se gana gastando y presumiendo; abre la sala VIP, la azotea y
  los mejores contactos.
- **Lujo:** relojes («Rolox»), cadenas, ropa de marca parodia, coches en el
  parking, pisos y el ático.
- **Ranking semanal «Forbes Brokerstars»:** patrimonio, mayor premio en el
  casino, mayor golpe… con trofeo para el nº 1.
- **Objetivos diarios y semanales**, logros y **temporadas** con eventos
  (crash cripto, elecciones, Mundial en el casino).

## 9. El móvil del jugador
Apps: Banco, Cripto, Mensajes, Equipo (reparto y tareas), Apuestas, Noticias,
Mapa de la torre y Cámara (fotos para presumir).

## 10. Hoja de ruta
- [x] **Fase 0:** creador de personajes 3D y hojas de diseño
- [x] **Diseño:** oficina Planta 1 en 3D, planos de la torre y de cada planta
- [x] **Demo 0.1:** moverse por la torre (WASD y táctil), cámara en tercera
  persona, ascensor, Planta 0 (banco, cajeros, MegaMart) y Planta 1 (oficina),
  sentarse en un puesto y vender por teléfono, dinero, inventario, microondas,
  hambre y energía, objetivos de tutorial
- [ ] **Fase 2:** banco, efectivo/banco/cripto, inventario, MegaMart, hambre y energía
- [ ] **Fase 3:** multijugador (servidor Node + Colyseus) y chat de voz de proximidad
- [ ] **Fase 4:** primeros roles jugables: broker y dropshipper
- [ ] **Fase 5:** casino: ruleta, blackjack y póker entre amigos
- [ ] **Fase 6:** Planta Gris: estafador, mulero, hacker, político, prensa y busca
- [ ] **Fase 7:** apuestas deportivas, fiestas, ranking, temporadas y azotea

## 11. Diseño visual
- Personaje: `docs/diseno/hoja-operador.png`
- Oficina en 3D (Planta 1, call center original): `docs/diseno/hoja-oficina.png`
- Planos de la torre y sus plantas: `docs/diseno/torre-brokerstars.png`
- Cómo se mueve el dinero entre roles: `docs/diseno/economia.png`
- Primeros planos por negocio (referencia): `docs/diseno/planos-lugares.png`

### Pendiente del personaje
- Camisa del pecho más pequeña · hombros de traje más cuadrados · cara con más detalle

## 12. Técnico
- Three.js + TypeScript + Vite: se juega en el navegador, en PC y en móvil.
- Personajes generados por código a partir de un JSON (`CharacterConfig`),
  fácil de mandar por red.
- Multijugador con servidor autoritativo: el dinero, el inventario y las
  apuestas se calculan en el servidor para que no se pueda hacer trampa.
