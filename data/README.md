# Carpeta /data

Coloca aquí los CSV con el mismo nombre para que el sitio los cargue automáticamente con **Cargar CSVs desde /data**:

- `games.csv` — histórico (date,team,opponent,team_ml,opp_ml,win,b2b,road_to_road)
- `lineups.csv` — disponibilidad histórica (date,team,player,played)
- `today_schedule.csv` — juegos de hoy (+ ajustes) (date,team,opponent,base_p_team,base_p_opp,b2b_team_pp,r2r_team_pp,b2b_opp_pp,r2r_opp_pp,l5_adj_team_pp,l5_adj_opp_pp,w7_team_games,w7_opp_games)
- `today_lineups.csv` — quién juega hoy (date,team,player,expected_play)
- `prohibidos.csv` — lista negra (player, team?, reason?, until_date?)
- `props_candidates.csv` — candidatos (team,player,points_line,pp_unit,line)
- `nhl_changelog.csv` — registro de corridas (opcional para ver en el tab Changelog)

> Consejo: puedes empezar subiendo tus CSVs reales y mantener algunos archivos vacíos con encabezados para que el flujo corra igual.
