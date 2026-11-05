# YearWrapped — "Tu año en el gym"

Wrapped de fin de año estilo Spotify (stories con barras de progreso, números que cuentan,
tono divertido pero serio) con la paleta de la app (teal `#177E89`, navy `#04151F`, menta `#ACF39D`).
Carpeta independiente: **no modifica ningún archivo existente**.

## Qué muestra (11 slides)
1. Intro · 2. Días de gym · 3. Puntos ganados · 4. Amigos nuevos · 5. Logros ·
6. Metas alcanzadas (≤3 → se listan todas; >3 → las 3 más difíciles) · 7. Máquinas distintas (+ favorita) ·
8. Día más intenso · 9. Rutinas distintas · 10. Resumen · 11. **"Tenemos un regalo para vos..."** → 50% OFF en la cuota de enero.

Controles: tap derecha = siguiente, izquierda = atrás, mantener = pausa. Cada slide avanza sola (~7 s).

## Cómo se calcula cada número (`backend/yearWrapped.service.js`)
| Dato | Criterio |
|---|---|
| Puntos | suma de `PointTransaction` **positivas** del año |
| Amigos | personas distintas en `SocialChallenge` `COMPLETED` del año |
| Logros | `UserAchievement.unlockedAt` dentro del año |
| Días de gym | días calendario distintos con `GymSession` (zona UTC-3, configurable) |
| Metas | metas con un `ProgressEntry` ≥100% en el año |
| Máquinas | `machineId` distintos en `MachineUsage` |
| Día más intenso | mayor `minutos + 10 × usos de máquina` entre días con check-in |
| Rutinas | días del cronograma (por rutina general o título) + `Routine` creadas en el año, sin repetidos |

Son criterios razonables que elegí; si querés otra definición (p. ej. "intenso" por puntos), se cambia en un solo lugar.

## Ya está integrado en el proyecto
Esta carpeta es la fuente/documentación. La versión activa vive en:
- `Backend/src/services/yearWrapped.service.js` y `Backend/src/controllers/yearWrapped.controller.js`
- Ruta `GET /analytics/year-wrapped?year=YYYY` en `Backend/src/routes/index.js` (usa los datos reales de la DB del usuario logueado)
- `Frontend/screens/user/yearWrapped/` (usa los colores de `styles/globals.js`)
- `getYearWrapped` en `Frontend/features/api/services/gamification.api.js`
- Pantalla `UserYearWrapped` en `Frontend/navigation/RootNavigator.js`
- Botón "Tu Wrapped 2026" en `Frontend/screens/user/HomeScreen.js`, justo arriba de "Pedir ayuda"
- Textos `user.home.yearWrappedTitle/Subtitle` en `en.json` y `es.json`

Salir: la **✕** de arriba a la derecha (siempre visible), el botón **"Salir del Wrapped"** en la última slide, y el gesto/botón atrás del sistema.
Si cambiás algo, hacelo en las copias activas de arriba.

## Pendiente (no incluido)
El **canje del 50%** es solo visual: `onRedeem` es el gancho donde guardar el cupón
(p. ej. crear una `Reward`/`RewardRedemption` o marcarlo en el usuario) y aplicarlo en la cuota de enero.
Los textos están en español fijo dentro de `slides.js` (no usan el i18n de la app).
