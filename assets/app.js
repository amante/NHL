// NHL Toolkit SPA — vanilla JS
(() => {
  const $ = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));
  const fmt = n => (n===null||n===undefined||isNaN(n)) ? "" : Number(n).toFixed(2);
  const state = {
    csv: {}, // name -> text
    data: {}, // parsed objects
    params: {
      b2b: -4.8, r2r: -1.5, cap: 8.0,
      l5: {"5-0":4.0,"4-1":2.5,"3-2":1.0,"2-3":-1.0,"1-4":-2.5,"0-5":-4.0},
      w7: {"4":-0.8,"5":-1.8,"6":-3.0,"7":-4.0}
    }
  };

  // ---- UI Tabs
  $$(".tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $$(".tab").forEach(t => t.classList.remove("active"));
      $("#tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  // ---- CSV helpers (minimal)
  function parseCSV(text){
    const rows = [];
    let i=0, cur="", cell="", inQ=false;
    while(i<text.length){
      const ch = text[i];
      if(ch === '"'){
        if(inQ && text[i+1]==='"'){ cell += '"'; i++; }
        else inQ = !inQ;
      } else if(ch === ',' && !inQ){ rows.push(cell); cell=""; }
      else if((ch === '\n' || ch === '\r') && !inQ){
        rows.push(cell); cell="";
        if(rows.length) {
          // flush row
          const arr = [];
          for(let j=0;j<rows.length;j++){
            arr.push(rows[j]);
          }
          // store
          if(arr.some(x=>x!=="" )){
            (parseCSV._rows = parseCSV._rows || []).push(arr);
          }
          rows.length = 0;
        }
      } else cell += ch;
      i++;
    }
    if(cell.length || rows.length){ rows.push(cell); (parseCSV._rows = parseCSV._rows || []).push(rows.slice()); }
    const all = parseCSV._rows || [];
    parseCSV._rows = null;
    if(all.length===0) return {header:[], data:[]};
    const header = all[0].map(s=>s.trim());
    const data = all.slice(1).map(r => Object.fromEntries(header.map((h,idx)=>[h, (r[idx]??"").trim()])));
    return {header, data};
  }
  function toCSV(arr, header){
    const esc=v=> {
      v = v==null?"":String(v);
      return (/[",\n\r]/.test(v))?('"'+v.replace(/"/g,'""')+'"'):v;
    };
    const h = header||Object.keys(arr[0]||{});
    const lines = [h.map(esc).join(",")];
    for(const row of arr){
      lines.push(h.map(k=>esc(row[k])).join(","));
    }
    return lines.join("\n");
  }

  // ---- IO
  async function fetchIfExists(path){
    try{
      const r = await fetch(path, {cache:"no-store"});
      if(!r.ok) return null;
      return await r.text();
    }catch(e){ return null; }
  }
  async function loadFromDataFolder(){
    const files = ["games.csv","lineups.csv","today_schedule.csv","today_lineups.csv","prohibidos.csv","props_candidates.csv","nhl_changelog.csv","nhl_final_probs.csv","nhl_cartilla_locales.csv","nhl_cartilla_visitas.csv"];
    let msg = [];
    for(const f of files){
      const t = await fetchIfExists(`data/${f}`);
      if(t){
        state.csv[f]=t;
        msg.push(`✓ ${f}`);
      } else {
        msg.push(`— ${f} (no encontrado)`);
      }
    }
    $("#state").innerHTML = "<pre>"+msg.join("\n")+"</pre>";
  }
  $("#btn-load-data").addEventListener("click", loadFromDataFolder);

  $("#file-input").addEventListener("change", async (ev)=>{
    const files = ev.target.files;
    const names = [];
    for(const file of files){
      const t = await file.text();
      state.csv[file.name]=t;
      names.push("✓ "+file.name);
    }
    $("#state").innerHTML = "<pre>"+names.join("\n")+"</pre>";
  });

  $("#btn-show-state").addEventListener("click", ()=>{
    const keys = Object.keys(state.csv);
    $("#state").innerHTML = "<pre>"+(keys.length?keys.join("\n"):"(sin archivos cargados)")+"</pre>";
  });

  // ---- Parameters
  function readParams(){
    state.params.b2b = parseFloat($("#param-b2b").value)||0;
    state.params.r2r = parseFloat($("#param-r2r").value)||0;
    state.params.cap = parseFloat($("#param-cap").value)||8;
    state.params.l5 = {
      "5-0": parseFloat($("#l5-5-0").value)||0,
      "4-1": parseFloat($("#l5-4-1").value)||0,
      "3-2": parseFloat($("#l5-3-2").value)||0,
      "2-3": parseFloat($("#l5-2-3").value)||0,
      "1-4": parseFloat($("#l5-1-4").value)||0,
      "0-5": parseFloat($("#l5-0-5").value)||0,
    };
    state.params.w7 = {
      "4": parseFloat($("#w7-4").value)||0,
      "5": parseFloat($("#w7-5").value)||0,
      "6": parseFloat($("#w7-6").value)||0,
      "7": parseFloat($("#w7-7").value)||0,
    };
  }

  // ---- Math helpers
  const mlProb = (ml)=> {
    ml = parseFloat(ml);
    if(isNaN(ml)) return null;
    return (ml<0) ? (-ml)/((-ml)+100) : 100/(ml+100);
  };
  const norm2 = (a,b)=> {
    const s = a+b;
    if(s<=0) return [0.5,0.5];
    return [a/s, b/s];
  };
  const clamp = (x,cap)=> Math.max(-cap, Math.min(cap, x));
  const normalizePairPercent = (pa, pb)=>{
    pa = Math.max(0, Math.min(100, pa));
    pb = Math.max(0, Math.min(100, pb));
    const s = pa+pb || 1;
    return [100*pa/s, 100*pb/s];
  };

  // ---- PIF computation (client-side)
  function computeResidualGames(games){
    return games.map(g => {
      const pA = mlProb(g.team_ml);
      const pB = mlProb(g.opp_ml);
      const [pt,po] = norm2(pA, pB);
      return {...g, p_base_team: pt, residual: (parseFloat(g.win)||0) - pt};
    });
  }
  function computePIF(gamesRes, lineups, shrinkK=10, minPlayed=1, minNot=1){
    // merge on (date, team)
    const key = (d,t)=> d+"__"+t;
    const resByKey = Object.fromEntries(gamesRes.map(r=>[key(r.date,r.team), r.residual]));
    const byTP = {};
    for(const L of lineups){
      const k = key(L.date, L.team);
      const r = resByKey[k];
      if(r===undefined) continue;
      const tp = L.team+"__"+L.player;
      (byTP[tp] = byTP[tp] || {team:L.team, player:L.player, play:[], nplay:[]});
      if(String(L.played)=="1") byTP[tp].play.push(r); else byTP[tp].nplay.push(r);
    }
    const out = [];
    for(const tp in byTP){
      const o = byTP[tp];
      const n_play = o.play.length, n_nplay = o.nplay.length;
      if(n_play>=minPlayed && n_nplay>=minNot){
        const eff = (o.play.reduce((a,b)=>a+b,0)/n_play) - (o.nplay.reduce((a,b)=>a+b,0)/n_nplay);
        const n = Math.min(n_play, n_nplay);
        const shrink = n / (n + shrinkK);
        const eff_pp = 100*(eff * shrink);
        out.push({team:o.team, player:o.player, n_play, n_nplay, effect_pp: eff_pp});
      }
    }
    return out.sort((a,b)=> (b.effect_pp||0) - (a.effect_pp||0));
  }

  // ---- Parsing of all CSVs to arrays
  function ensureLoaded(){
    const required = ["today_schedule.csv","today_lineups.csv"];
    for(const r of required){
      if(!state.csv[r]) throw new Error(`Falta ${r}. Cárgalo desde /data o súbelo.`);
    }
    // Optional but recommended
    if(!state.csv["games.csv"] || !state.csv["lineups.csv"]){
      console.warn("No hay histórico para PIF; se calculará sin PIF.");
    }
  }
  function parseAll(){
    readParams();
    ensureLoaded();
    const tSched = parseCSV(state.csv["today_schedule.csv"]).data;
    const tLU = parseCSV(state.csv["today_lineups.csv"]).data;
    const games = state.csv["games.csv"] ? parseCSV(state.csv["games.csv"]).data : [];
    const luHist = state.csv["lineups.csv"] ? parseCSV(state.csv["lineups.csv"]).data : [];
    const props = state.csv["props_candidates.csv"] ? parseCSV(state.csv["props_candidates.csv"]).data : defaultProps();
    const prohib = state.csv["prohibidos.csv"] ? parseCSV(state.csv["prohibidos.csv"]).data : [];

    // Normalize numeric types
    const num = v => (v===""||v==null)?null:parseFloat(v);
    const tSchedN = tSched.map(r => ({
      date:r.date, team:r.team, opponent:r.opponent,
      base_p_team: num(r.base_p_team),
      base_p_opp: num(r.base_p_opp),
      b2b_team_pp: num(r.b2b_team_pp)||0,
      r2r_team_pp: num(r.r2r_team_pp)||0,
      b2b_opp_pp: num(r.b2b_opp_pp)||0,
      r2r_opp_pp: num(r.r2r_opp_pp)||0,
      l5_adj_team_pp: num(r.l5_adj_team_pp)||0,
      l5_adj_opp_pp: num(r.l5_adj_opp_pp)||0,
      w7_team_games: num(r.w7_team_games)||null,
      w7_opp_games: num(r.w7_opp_games)||null,
    }));
    const tLUN = tLU.map(r => ({date:r.date, team:r.team, player:r.player, expected_play: String(r.expected_play||"1")}));
    const gamesN = games.map(r => ({
      date:r.date, team:r.team, opponent:r.opponent,
      team_ml: num(r.team_ml), opp_ml: num(r.opp_ml),
      win: parseInt(r.win||"0"), b2b: parseInt(r.b2b||"0"), road_to_road: parseInt(r.road_to_road||"0")
    }));
    const luHistN = luHist.map(r => ({date:r.date, team:r.team, player:r.player, played: String(r.played||"0")}));
    const propsN = props.map(r => ({team:r.team, player:r.player, points_line: num(r.points_line)||0.5, pp_unit:r.pp_unit||"PP1", line:r.line||"L1"}));
    const ban = new Set(prohib.map(x=>(x.player||"").trim()).filter(Boolean));

    state.data = { tSched:tSchedN, tLU:tLUN, games:gamesN, luHist:luHistN, props:propsN, ban };
  }

  // ---- Default props if not provided
  function defaultProps(){
    // Matches the pool we used during setup (Mammoth incluido)
    return [
      {"team":"Islanders","player":"Bo Horvat","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Islanders","player":"Noah Dobson","points_line":0.5,"pp_unit":"PP1","line":"D1"},
      {"team":"Sharks","player":"William Eklund","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Sharks","player":"Mikael Granlund","points_line":0.5,"pp_unit":"PP1","line":"L2"},
      {"team":"Maple Leafs","player":"John Tavares","points_line":0.5,"pp_unit":"PP1","line":"L2"},
      {"team":"Maple Leafs","player":"Mitch Marner","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Devils","player":"Jesper Bratt","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Devils","player":"Jack Hughes","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Capitals","player":"Dylan Strome","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Capitals","player":"John Carlson","points_line":0.5,"pp_unit":"PP1","line":"D1"},
      {"team":"Kraken","player":"Matty Beniers","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Kraken","player":"Jaden Schwartz","points_line":0.5,"pp_unit":"PP1","line":"L2"},
      {"team":"Penguins","player":"Evgeni Malkin","points_line":0.5,"pp_unit":"PP1","line":"L2"},
      {"team":"Penguins","player":"Rickard Rakell","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Canucks","player":"J.T. Miller","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Canucks","player":"Elias Pettersson","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Senators","player":"Tim Stützle","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Senators","player":"Brady Tkachuk","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Oilers","player":"Zach Hyman","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Oilers","player":"Evan Bouchard","points_line":0.5,"pp_unit":"PP1","line":"D1"},
      {"team":"Bruins","player":"Brad Marchand","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Bruins","player":"Charlie McAvoy","points_line":0.5,"pp_unit":"PP1","line":"D1"},
      {"team":"Panthers","player":"Matthew Tkachuk","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Panthers","player":"Sam Reinhart","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Blues","player":"Jordan Kyrou","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Blues","player":"Pavel Buchnevich","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Kings","player":"Kevin Fiala","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Kings","player":"Adrian Kempe","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Predators","player":"Roman Josi","points_line":0.5,"pp_unit":"PP1","line":"D1"},
      {"team":"Predators","player":"Ryan O'Reilly","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Ducks","player":"Mason McTavish","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Ducks","player":"Troy Terry","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Stars","player":"Wyatt Johnston","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Stars","player":"Miro Heiskanen","points_line":0.5,"pp_unit":"PP1","line":"D1"},
      {"team":"Blue Jackets","player":"Johnny Gaudreau","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Blue Jackets","player":"Zach Werenski","points_line":0.5,"pp_unit":"PP1","line":"D1"},
      {"team":"Mammoth","player":"Dylan Guenther","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Mammoth","player":"Logan Cooley","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Avalanche","player":"Valeri Nichushkin","points_line":0.5,"pp_unit":"PP1","line":"L1"},
      {"team":"Avalanche","player":"Mikko Rantanen","points_line":0.5,"pp_unit":"PP1","line":"L1"},
    ];
  }

  // ---- Build today pairs from today_schedule
  function uniqueGamesFromSchedule(tSched){
    // collapse to one row per matchup (away/home unknown, we just keep team/opponent as given)
    const seen = new Set(), out = [];
    for(const r of tSched){
      const key = [r.team, r.opponent].sort().join("::");
      if(seen.has(key)) continue;
      seen.add(key);
      // as default assume r.team is away (display only)
      out.push({date:r.date, away:r.team, home:r.opponent});
    }
    return out;
  }

  // ---- Probabilities calculation pipeline
  function calcProbabilities(){
    parseAll();
    const {tSched, tLU, games, luHist} = state.data;
    // Compute PIF if history available
    let pif = [];
    if(games.length && luHist.length){
      const gamesRes = computeResidualGames(games);
      pif = computePIF(gamesRes, luHist, 10, 1, 1);
    }
    // Sum PIF per team for EXPECTED players today
    const expByTeam = {};
    for(const r of tLU){ if(r.expected_play==="1"){ (expByTeam[r.team]=expByTeam[r.team]||new Set()).add(r.player);} }
    const pifMap = {}; // team -> sum pp
    for(const row of pif){
      if(expByTeam[row.team] && expByTeam[row.team].has(row.player)){
        pifMap[row.team] = (pifMap[row.team]||0) + (row.effect_pp||0);
      }
    }
    // Apply adjustments per schedule row
    const cap = state.params.cap;
    function adjSum(r, side){ // returns pp
      const base = (side==="team") ? (r.b2b_team_pp + r.r2r_team_pp + r.l5_adj_team_pp) : (r.b2b_opp_pp + r.r2r_opp_pp + r.l5_adj_opp_pp);
      const teamName = (side==="team") ? r.team : r.opponent;
      const pifS = pifMap[teamName] || 0;
      // workload last 7 days (optional)
      const w7Games = (side==="team") ? r.w7_team_games : r.w7_opp_games;
      let w7pp = 0;
      if(w7Games!=null){
        const t = String(w7Games);
        const map = state.params.w7;
        w7pp = (map[t]||0);
      }
      return clamp(base + pifS + w7pp, cap);
    }
    const rows = [];
    for(const r of tSched){
      const pt = (r.base_p_team||0)*100;
      const po = (r.base_p_opp||0)*100;
      const adjT = adjSum(r, "team");
      const adjO = adjSum(r, "opp");
      let pt2 = pt + adjT - adjO;
      let po2 = po + adjO - adjT;
      const [pft,pfo] = normalizePairPercent(pt2, po2);
      rows.push({
        date: r.date, team:r.team, opponent:r.opponent,
        base_p_team_%: fmt(pt), base_p_opp_%: fmt(po),
        adj_team_pp_total: fmt(adjT), adj_opp_pp_total: fmt(adjO),
        final_p_team_%: fmt(pft), final_p_opp_%: fmt(pfo)
      });
    }
    state.data.finalRows = rows;
    // render table
    const tbl = renderTable(rows, ["date","team","opponent","base_p_team_%","base_p_opp_%","adj_team_pp_total","adj_opp_pp_total","final_p_team_%","final_p_opp_%"]);
    $("#prob-table").innerHTML = tbl;
  }

  $("#btn-calc-prob").addEventListener("click", calcProbabilities);

  $("#btn-export-prob").addEventListener("click", ()=>{
    const rows = state.data.finalRows || [];
    const csv = toCSV(rows, Object.keys(rows[0]||{date:"",team:"",opponent:""}));
    downloadCSV(csv, "nhl_adjusted_probs.csv");
  });

  // ---- Cartillas
  function buildCartillas(){
    if(!state.data.tSched) parseAll();
    const games = uniqueGamesFromSchedule(state.data.tSched);
    const props = state.data.props;
    const ban = state.data.ban;
    const todayExpected = new Set(state.data.tLU.filter(r=>r.expected_play==="1").map(r=>r.team+"__"+r.player));

    function pick(team, taken){
      const cands = props.filter(p => p.team===team && p.points_line<=0.5 && !ban.has(p.player) && !taken.has(p.player));
      cands.sort((a,b)=>{
        const sA = score(a), sB = score(b);
        if(sA!==sB) return sB-sA;
        return (a.player<b.player)?-1:1;
      });
      // try to respect expected_play if present
      for(const c of cands){
        if(todayExpected.size===0 || todayExpected.has(c.team+"__"+c.player)){
          return c;
        }
      }
      return cands[0] || null;
    }
    const score = (c)=> (c.pp_unit==="PP1"?2:1) + (c.line==="L1"?4:c.line==="L2"?3:(c.line==="D1"?3:2));
    const taken = new Set();
    const locals=[], visits=[];

    for(const g of games){
      const lp = pick(g.home, taken);
      if(lp){ locals.push({date:g.date, matchup:`${g.away}@${g.home}`, side:"local", team:g.home, player:lp.player, market:"puntos 0.5+", seleccion:"Sí"}); taken.add(lp.player); }
      const vp = pick(g.away, taken);
      if(vp){ visits.push({date:g.date, matchup:`${g.away}@${g.home}`, side:"visita", team:g.away, player:vp.player, market:"puntos 0.5+", seleccion:"Sí"}); taken.add(vp.player); }
    }
    state.data.locals = locals; state.data.visits = visits;
    $("#cards-local").innerHTML = renderTable(locals, ["date","matchup","team","player","market","seleccion"]);
    $("#cards-visit").innerHTML = renderTable(visits, ["date","matchup","team","player","market","seleccion"]);
  }

  $("#btn-build-cards").addEventListener("click", buildCartillas);

  $("#btn-export-cards").addEventListener("click", ()=>{
    const L = state.data.locals || [];
    const V = state.data.visits || [];
    const csvL = toCSV(L, Object.keys(L[0]||{date:"",matchup:"",team:"",player:""}));
    const csvV = toCSV(V, Object.keys(V[0]||{date:"",matchup:"",team:"",player:""}));
    downloadCSV(csvL, "nhl_cartilla_locales.csv");
    downloadCSV(csvV, "nhl_cartilla_visitas.csv");
  });

  // ---- Changelog
  $("#btn-load-changelog").addEventListener("click", ()=>{
    if(!state.csv["nhl_changelog.csv"]) return alert("No se encontró nhl_changelog.csv. Cárgalo desde /data o súbelo.");
    const log = parseCSV(state.csv["nhl_changelog.csv"]).data;
    $("#changelog-table").innerHTML = renderTable(log, Object.keys(log[0]||{}));
  });
  $("#btn-clear-changelog").addEventListener("click", ()=>{
    $("#changelog-table").innerHTML = "";
  });
  $("#btn-export-changelog").addEventListener("click", ()=>{
    if(!state.csv["nhl_changelog.csv"]) return alert("No hay changelog cargado.");
    downloadCSV(state.csv["nhl_changelog.csv"], "nhl_changelog.csv");
  });

  // ---- Render helpers
  function renderTable(rows, cols){
    if(!rows || !rows.length) return "<div class='badge'>Sin datos</div>";
    cols = cols || Object.keys(rows[0]);
    let h = "<table><thead><tr>";
    for(const c of cols) h += `<th>${c}</th>`;
    h += "</tr></thead><tbody>";
    for(const r of rows){
      h += "<tr>";
      for(const c of cols) h += `<td>${r[c]??""}</td>`;
      h += "</tr>";
    }
    h += "</tbody></table>";
    return h;
  }

  function downloadCSV(csv, name){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8;"}));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- Team monograms
  const teamMono = (name)=>{
    const map = {
      "Islanders":"NYI","Sharks":"SJ","Maple Leafs":"TOR","Devils":"NJD","Capitals":"WSH",
      "Kraken":"SEA","Penguins":"PIT","Canucks":"VAN","Senators":"OTT","Oilers":"EDM",
      "Bruins":"BOS","Panthers":"FLA","Blues":"STL","Kings":"LAK","Predators":"NSH",
      "Ducks":"ANA","Stars":"DAL","Blue Jackets":"CBJ","Avalanche":"COL","Mammoth":"MAM"
    };
    return map[name] || (name ? name.slice(0,3).toUpperCase() : "");
  };

  // ---- Build Matches view
  function buildMatchesView(){
    // Prefer nhl_final_probs.csv if present
    let rows = [];
    if(state.csv["nhl_final_probs.csv"]){
      const obj = parseCSV(state.csv["nhl_final_probs.csv"]);
      rows = obj.data.map(r => ({
        date: r.date, away: r.away, home: r.home,
        pv: parseFloat(r.p_visitante_%) || 0,
        ph: parseFloat(r.p_local_%) || 0
      }));
    } else if(state.data && state.data.finalRows){
      // derive from computed final rows in Probabilidades tab
      const FR = state.data.finalRows;
      const seen = new Set();
      for(const r of FR){
        const key = [r.team, r.opponent].sort().join("::");
        if(seen.has(key)) continue;
        seen.add(key);
        // assume team listed first is away display-wise
        const pv = parseFloat(r.final_p_team_%)||0;
        const ph = parseFloat(r.final_p_opp_%)||0;
        rows.push({date:r.date, away:r.team, home:r.opponent, pv, ph});
      }
    } else {
      $("#matches-view").innerHTML = "<div class='badge'>Carga primero <code>nhl_final_probs.csv</code> o calcula probabilidades.</div>";
      return;
    }
    // Render
    let html = "<div class='matches'>";
    for(const g of rows){
      const diff = Math.abs(g.ph - g.pv);
      const favHome = g.ph >= g.pv;
      const favClass = diff < 10 ? "close" : "fav";
      const homeCls = favHome ? `teambox2 ${favClass}` : "teambox2";
      const awayCls = favHome ? "teambox2" : `teambox2 ${favClass}`;
      const diffTxt = (favHome ? `+${(g.ph - g.pv).toFixed(1)} pp ${g.home}` : `+${(g.pv - g.ph).toFixed(1)} pp ${g.away}`);
      html += `
      <div class="match-row">
        <div class="${awayCls}">
          <div class="logo2">${teamMono(g.away)}</div>
          <div class="teammeta"><div class="name">${g.away}</div><div class="sub">${g.pv.toFixed(1)}% de ganar</div></div>
        </div>
        <div class="center-vs">vs</div>
        <div class="${homeCls}">
          <div class="logo2">${teamMono(g.home)}</div>
          <div class="teammeta"><div class="name">${g.home}</div><div class="sub">${g.ph.toFixed(1)}% de ganar</div></div>
        </div>
        <div class="diffbox"><span class="diffbadge">${diffTxt}</span></div>
      </div>`;
    }
    html += "</div>";
    $("#matches-view").innerHTML = html;
  }

  $("#btn-render-matches").addEventListener("click", ()=>{
    try{ buildMatchesView(); }catch(e){ console.error(e); alert("Error renderizando partidos: "+e.message); }
  });


  // Initialize params onchange
  $$("input").forEach(inp => inp.addEventListener("change", readParams));
  readParams();
})();
