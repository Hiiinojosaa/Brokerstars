# Brokerstars — Documento de diseño

> Vive la vida de un joven millonario. Empiezas desde abajo con tus colegas
> y vas subiendo: oficina, negocios, lujo... o el lado oscuro.

## Visión
- **Estilo:** cartoon tipo juguete, como los juegos de oficina de estafadores: cabeza grande en forma de huevo, cuerpo blandito, colores vivos, luz cálida y un poco de bloom. Queda un filtro "PS2" opcional (pixelado y dithering).
- **Multijugador cooperativo:** juegas y roleas con tus colegas en el mismo mundo.
- **Bucle adictivo:** siempre hay un siguiente objetivo (planta, coche, reloj, negocio).

## Bucle principal
1. Trabajas en la oficina con tus colegas → ganas dinero y reputación.
2. Subes de planta (becario → junior → senior → socio → dueño del edificio).
3. Inviertes en negocios propios.
4. Gastas en lujo (relojes, coches, ropa, casas) → estatus → desbloqueas contactos y zonas.

## Caminos para hacer dinero
| Camino | Idea de gameplay |
|---|---|
| Broker / trading | Gráficas en tiempo real; compras y vendes; hay riesgo de quemar la cuenta |
| Dropshipping | Buscar productos en almacenes, fijar precios, lanzar anuncios y gestionar los envíos |
| Agencia de automatización de contenido | Contratar gente, conseguir clientes, entregar a tiempo |
| Booker de artistas | Fichar artistas, negociar cachés, cerrar conciertos |
| Promotor de eventos | Alquilar la sala, montar el cartel, vender entradas y que no se caiga la noche |
| **Lado oscuro** | |
| Hacker / estafas cripto | Minijuegos de "hackeo" y rug pulls de memecoins ficticias. Mucho dinero rápido, pero aumenta la **busca** policial |
| Político corrupto | Hacer campaña, sobornos, contratos públicos amañados. Poder e influencia con riesgo de escándalo |

El lado oscuro tiene un sistema de **riesgo**: investigaciones, redadas, cárcel, pérdida de bienes y reputación. Todo es ficticio (monedas, webs y empresas inventadas).

## Lujo y estatus
- Las marcas son parodias, como en GTA (p. ej. "Rolox" en vez de Rolex), para evitar problemas legales.
- Relojes, cadenas, ropa, coches, pisos y áticos. Lo que llevas se ve en el personaje.

## Hoja de ruta
- [x] **Fase 0:** creador de personajes 3D y hoja de diseño del Operador
- [ ] **Fase 1:** oficina explorable en 3D, moverse con WASD o con el táctil, cámara en tercera persona
- [ ] **Fase 2:** economía básica: dinero, trabajo en la oficina y subir de planta
- [ ] **Fase 3:** multijugador con colegas (servidor Node + Colyseus)
- [ ] **Fase 4:** primer negocio completo (trading) y tienda de lujo
- [ ] **Fase 5:** resto de negocios y el lado oscuro

## Pendiente del personaje (para más adelante)
Diseño actual: `docs/diseno/hoja-operador.png`.
- Camisa del pecho más pequeña (ahora parece un babero)
- Hombros de traje más cuadrados
- Piernas y rodillas con más forma
- Cara con más detalle

## Técnico
- Three.js + TypeScript + Vite (se juega en el navegador, en el PC y en el móvil).
- Personajes generados por código a partir de un JSON (`CharacterConfig`), fácil de mandar por red.
