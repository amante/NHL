# NHL — Probabilidades & Cartillas (GitHub Pages)

Sitio estático para generar **probabilidades sin vig** y **cartillas (1 leg, 0.5+ puntos)** para la NHL, con:
- Ajustes de **B2B** (−4.8 pp), **road→road** (−1.5 pp), **racha L5** (configurable), y **PIF** (influencia de jugadores).
- Editor de parámetros, carga de CSVs desde `/data` o subida manual.
- Exportación de resultados a CSV (probabilidades y cartillas).

## Estructura del repo
```
NHL/
├─ index.html
├─ assets/
│  ├─ style.css
│  └─ app.js
└─ data/
   └─ (coloca aquí tus CSVs)
```

## Cómo publicar en GitHub Pages
1. Sube esta carpeta al repo **NHL** (raíz).
2. En el repo, ve a **Settings → Pages** y selecciona **Deploy from branch** → **main** y carpeta **/** (root). Guarda.
3. Abre la URL que te da GitHub Pages (algo como: `https://tuusuario.github.io/NHL/`).

## CSVs esperados en `/data`
- `games.csv` — `date,team,opponent,team_ml,opp_ml,win,b2b,road_to_road`
- `lineups.csv` — `date,team,player,played`
- `today_schedule.csv` — `date,team,opponent,base_p_team,base_p_opp,b2b_team_pp,r2r_team_pp,b2b_opp_pp,r2r_opp_pp,l5_adj_team_pp,l5_adj_opp_pp,w7_team_games,w7_opp_games`
- `today_lineups.csv` — `date,team,player,expected_play`
- `prohibidos.csv` — `player,team(optional),reason(optional),until_date(optional)`
- `props_candidates.csv` — `team,player,points_line,pp_unit,line`
- `nhl_changelog.csv` — (opcional) historial

## Notas
- Si un CSV no existe, el sitio te dejará **subirlo manualmente**.
- **Utah Mammoth** está soportado como franquicia NHL vigente.
- El cálculo de **PIF** se hace con tus históricos (si los subes). Si no hay datos, se salta esa capa de ajuste.
- Todo corre **en el navegador**; no hay backend.
