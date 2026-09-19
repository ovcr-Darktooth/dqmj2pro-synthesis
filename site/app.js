(() => {
  const { monsters: monsterList, recipes: allRecipes } = window.DQ_DATA;
  const monsters = new Map(monsterList.map((m) => [m.id, m]));

  const DEFAULT_LEVELS = 5;
  const RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "???"];
  const FAMILIES = ["Slime", "Dragon", "Nature", "Beast", "Material", "Demon", "Zombie", "???"];

  const I18N = {
    fr: {
      title: "Synthèses DQMJ2 Pro",
      romOriginal: "ROM originale",
      romPatch: "ROM patchée",
      tabRecipes: "Recettes",
      tabMonsters: "Monstres",
      search: "Rechercher un monstre…",
      recipes: (n) => `${n} recette${n > 1 ? "s" : ""}`,
      monsters: (n) => `${n} monstre${n > 1 ? "s" : ""}`,
      empty: "Aucun résultat.",
      patch: "PATCH",
      patchTitle: "Recette ajoutée par le patch",
      rank: "Rang",
      size: "Taille",
      obtainedBy: "Comment l'obtenir",
      usedIn: "Sert à créer",
      noRecipe: "Aucune synthèse spéciale : à obtenir par recrutement ou synthèse de familles.",
      noUse: "N'apparaît dans aucune synthèse spéciale.",
      traits: "Traits",
      stats: ["PV", "PM", "Att.", "Déf.", "Agi.", "Sag."],
      families: { Slime: "Gluant", Dragon: "Dragon", Nature: "Nature", Beast: "Bête", Material: "Matière",
        Demon: "Démon", Zombie: "Zombie", "???": "???" },
      close: "Fermer",
      footer: "Données et icônes issues du jeu et du patch",
      tabTree: "Arbre",
      showTree: "🌳 Arbre de synthèse",
      treePick: "Choisis le monstre à obtenir :",
      treeSearch: "Monstre à synthétiser…",
      expandAll: "Tout déplier",
      collapseAll: "Replier",
      resetTree: "Réinitialiser les choix",
      synths: (n) => `${n} synthèse${n > 1 ? "s" : ""} à réaliser`,
      bases: (n) => `${n} monstre${n > 1 ? "s" : ""} de base`,
      baseList: "Monstres de base à réunir",
      base: "base",
      baseTitle: "Pas de synthèse spéciale : recrutement ou synthèse de familles",
      cycle: "↻",
      cycleTitle: "Déjà présent plus haut dans cette branche",
      recipeSwitch: "Changer de recette",
      owned: "Déjà obtenu",
      ownedTitle: "Je l'ai déjà : ne pas développer cette branche",
      treeHint: "Clique sur ▸ pour déplier une branche, sur un monstre pour voir sa fiche.",
      levels: "Niveaux affichés",
      toTop: "Retour en haut de la page",
    },
    en: {
      title: "DQMJ2 Pro Synthesis",
      romOriginal: "Original ROM",
      romPatch: "Patched ROM",
      tabRecipes: "Recipes",
      tabMonsters: "Monsters",
      search: "Search a monster…",
      recipes: (n) => `${n} recipe${n > 1 ? "s" : ""}`,
      monsters: (n) => `${n} monster${n > 1 ? "s" : ""}`,
      empty: "No results.",
      patch: "PATCH",
      patchTitle: "Recipe added by the patch",
      rank: "Rank",
      size: "Size",
      obtainedBy: "How to get it",
      usedIn: "Used to create",
      noRecipe: "No special synthesis: scout it or use family synthesis.",
      noUse: "Not used in any special synthesis.",
      traits: "Traits",
      stats: ["HP", "MP", "Atk", "Def", "Agi", "Wis"],
      families: Object.fromEntries(FAMILIES.map((f) => [f, f])),
      close: "Close",
      footer: "Data and icons from the game and the patch",
      tabTree: "Tree",
      showTree: "🌳 Synthesis tree",
      treePick: "Pick the monster you want:",
      treeSearch: "Monster to synthesize…",
      expandAll: "Expand all",
      collapseAll: "Collapse",
      resetTree: "Reset choices",
      synths: (n) => `${n} synthesis${n > 1 ? "es" : ""} to do`,
      bases: (n) => `${n} base monster${n > 1 ? "s" : ""}`,
      baseList: "Base monsters to gather",
      base: "base",
      baseTitle: "No special synthesis: scout it or use family synthesis",
      cycle: "↻",
      cycleTitle: "Already present higher in this branch",
      recipeSwitch: "Switch recipe",
      owned: "Owned",
      ownedTitle: "I already have it: don't expand this branch",
      treeHint: "Click ▸ to expand a branch, a monster to open its page.",
      levels: "Levels shown",
      toTop: "Back to top",
    },
  };

  const store = {
    get(key, fallback) {
      try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* stockage indisponible */ }
    },
  };

  const storeJson = (key, fallback) => {
    try { return JSON.parse(store.get(key, "")) ?? fallback; } catch { return fallback; }
  };

  const state = {
    lang: store.get("lang", "fr"),
    rom: store.get("rom", "patch"),
    view: "recipes",
    query: "",
    ranks: new Set(),
    families: new Set(),
    listView: "recipes",
    // Arbre
    treeRoot: null,
    treeQuery: "",
    treeLevels: null, // colonnes affichées ; null = DEFAULT_LEVELS (ou moins si l'arbre est moins profond)
    treeOpen: new Map(),
    owned: new Set(storeJson("owned", [])),
    choice: storeJson("choice", {}),
  };

  const $ = (sel) => document.querySelector(sel);
  const t = (key) => I18N[state.lang][key];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const norm = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

  const nameOf = (m) => m.name[state.lang] || m.name.en;
  const recipes = () => (state.rom === "patch" ? allRecipes : allRecipes.filter((r) => !r.patch));

  // --- Rendu des briques ---------------------------------------------------

  function highlight(text) {
    const q = state.view === "tree" ? "" : norm(state.query.trim());
    if (!q) return esc(text);
    const i = norm(text).indexOf(q);
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
  }

  function iconHtml(m) {
    if (m.icon == null) return '<span class="icon-box"><span class="icon-missing"></span></span>';
    return `<span class="icon-box"><img class="icon" src="icons/${m.id}.png" alt="" loading="lazy"
      style="--h: ${m.icon / 40}"></span>`;
  }

  function monHtml(id, cls = "") {
    const m = monsters.get(id);
    return `<button type="button" class="mon ${cls}" data-id="${id}">
      ${iconHtml(m)}
      <span class="name">${highlight(nameOf(m))}</span>
      ${cls.includes("result") ? rankHtml(m) : ""}
    </button>`;
  }

  function rankHtml(m) {
    return m.rank ? `<span><span class="rank" data-r="${esc(m.rank)}">${esc(m.rank)}</span>
      <span class="fam">${esc(t("families")[m.family] || m.family || "")}</span></span>` : "";
  }

  function recipeHtml(r) {
    const parents = r.p.map((id) => monHtml(id)).join('<span class="plus">+</span>');
    const patch = r.patch ? `<span class="tag-patch" title="${esc(t("patchTitle"))}">${t("patch")}</span>` : "";
    return `<article class="recipe window">
      ${monHtml(r.r, "result")}
      <span class="eq" aria-hidden="true">⇐</span>
      <div class="parents">${parents}${patch}</div>
    </article>`;
  }

  // --- Filtres -------------------------------------------------------------

  function matchesFilters(m) {
    return (!state.ranks.size || state.ranks.has(m.rank || "???"))
      && (!state.families.size || state.families.has(m.family || "???"));
  }

  function matchesQuery(ids) {
    const q = norm(state.query.trim());
    return !q || ids.some((id) => norm(nameOf(monsters.get(id))).includes(q)
      || norm(monsters.get(id).name.en).includes(q));
  }

  function renderChips() {
    const chip = (group, value, label) =>
      `<button type="button" class="chip" data-group="${group}" data-value="${esc(value)}"
        aria-pressed="${state[group].has(value)}">${esc(label)}</button>`;
    $("#rank-chips").innerHTML = RANKS.map((r) => chip("ranks", r, `${t("rank")} ${r}`)).join("");
    $("#family-chips").innerHTML = FAMILIES.map((f) => chip("families", f, t("families")[f])).join("");
  }

  function renderList() {
    const list = $("#list");
    let html = "";
    let count = 0;
    if (state.view === "recipes") {
      const q = norm(state.query.trim());
      const items = recipes().filter((r) => matchesFilters(monsters.get(r.r)) && matchesQuery([r.r, ...r.p]));
      // Les recettes dont le résultat correspond à la recherche passent en premier
      if (q) items.sort((a, b) => matchesQuery([b.r]) - matchesQuery([a.r]));
      html = items.map(recipeHtml).join("");
      count = items.length;
      $("#count").textContent = t("recipes")(count);
    } else {
      const items = monsterList.filter((m) => matchesFilters(m) && matchesQuery([m.id]))
        .sort((a, b) => (a.dex ?? 9999) - (b.dex ?? 9999) || a.id - b.id);
      html = items.map((m) => monHtml(m.id, "result")).join("");
      count = items.length;
      $("#count").textContent = t("monsters")(count);
    }
    list.className = state.view;
    list.innerHTML = count ? html : `<p class="empty">${t("empty")}</p>`;
  }

  // --- Fiche monstre -------------------------------------------------------

  const maxStats = [0, 1, 2, 3, 4, 5].map((i) => Math.max(...monsterList.map((m) => m.stats?.[i] ?? 0)));

  function openDetail(id) {
    const m = monsters.get(id);
    if (!m) return;
    const made = recipes().filter((r) => r.r === id);
    const uses = recipes().filter((r) => r.p.includes(id));
    const stats = m.stats ? `<div class="stats">${m.stats.map((v, i) => `
        <span>${t("stats")[i]}</span>
        <span class="bar"><span style="width:${(100 * v) / maxStats[i]}%"></span></span>
        <span>${v}</span>`).join("")}</div>` : "";
    const traits = m.traits?.length
      ? `<div><h3>${t("traits")}</h3><ul class="traits">${m.traits.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
    const section = (title, items, empty) => `<div><h3>${title}</h3>${
      items.length ? items.map(recipeHtml).join("") : `<p class="note">${empty}</p>`}</div>`;

    const dialog = $("#detail");
    dialog.innerHTML = `
      <button type="button" class="close" aria-label="${t("close")}">✕</button>
      <div class="detail">
        <div class="detail-head">
          ${iconHtml(m).replace(' loading="lazy"', "")}
          <div>
            <h2>${esc(nameOf(m))}</h2>
            <div class="meta">
              ${rankHtml(m)}
              ${m.size ? `<span>${t("size")} ${m.size}</span>` : ""}
              ${state.lang !== "en" && m.name.fr ? `<span>(${esc(m.name.en)})</span>` : ""}
            </div>
            ${made.length ? `<button type="button" class="tree-link" data-tree="${id}">${t("showTree")}</button>` : ""}
          </div>
        </div>
        ${stats}
        ${traits}
        ${section(t("obtainedBy"), made, t("noRecipe"))}
        ${section(t("usedIn"), uses, t("noUse"))}
      </div>`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    if (location.hash !== `#m/${id}`) history.pushState({ detail: true }, "", `#m/${id}`);
  }

  // Fermer = revenir en arrière si la fiche a été ouverte depuis le site, sinon nettoyer l'URL
  function dismiss() {
    if (history.state?.detail) return history.back();
    history.replaceState(null, "", location.pathname + location.search);
    closeDetail();
  }

  function closeDetail() {
    const dialog = $("#detail");
    if (dialog.open) dialog.close();
  }

  // --- Arbre de synthèse --------------------------------------------------
  //
  // Chaque nœud = un monstre et la quantité nécessaire. Ses enfants = les parents de la recette
  // choisie, regroupés (4× Mottle Slime). Par défaut on prend la recette qui demande le moins de
  // monstres de base ; les choix manuels et les monstres « déjà obtenus » sont mémorisés.

  function recipesByResult() {
    const map = new Map();
    for (const r of recipes()) {
      if (!map.has(r.r)) map.set(r.r, []);
      map.get(r.r).push(r);
    }
    return map;
  }

  function groupParents(ids) {
    const counts = new Map();
    ids.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    return [...counts];
  }

  // Plan optimal par recherche exhaustive (≈ 8 ms dans le pire cas, Baboodread) :
  // - monstre sans recette -> « base » (1) ; déjà présent dans sa propre branche -> « cycle » (1) ;
  // - « déjà obtenu » -> 0 ; sinon la recette (ou le choix manuel) qui minimise le nombre de monstres de base.
  // Un cache par branche serait faux ici : le résultat dépend des ancêtres à cause des cycles.
  let planCache = { key: null, plan: null };

  function buildPlan(root) {
    const key = JSON.stringify([state.rom, root, state.choice, [...state.owned]]);
    if (planCache.key === key) return planCache.plan;
    const byResult = recipesByResult();
    const path = new Set();
    const plan = (id) => {
      const rs = byResult.get(id);
      if (!rs) return { id, kind: "base", cost: 1 };
      if (path.has(id)) return { id, kind: "cycle", cost: 1 };
      if (path.size && state.owned.has(id)) return { id, kind: "owned", cost: 0 };
      path.add(id);
      const manual = state.choice[id];
      const options = manual < rs.length ? [manual] : rs.map((_, i) => i);
      let best = null;
      for (const idx of options) {
        const parents = groupParents(rs[idx].p).map(([pid, count]) => ({ plan: plan(pid), count }));
        const cost = parents.reduce((acc, x) => acc + x.plan.cost * x.count, 0);
        if (!best || cost < best.cost) best = { id, kind: "synth", cost, idx, recipes: rs, parents };
      }
      path.delete(id);
      return best;
    };
    planCache = { key, plan: plan(root) };
    return planCache.plan;
  }

  // Récapitulatif : synthèses à faire et monstres de base, quantités cumulées
  function planTotals(root) {
    const base = new Map();
    let synths = 0;
    const walk = (node, n) => {
      if (node.kind === "synth") {
        synths += n;
        node.parents.forEach((x) => walk(x.plan, n * x.count));
      } else if (node.kind !== "owned") {
        base.set(node.id, (base.get(node.id) || 0) + n);
      }
    };
    walk(root, 1);
    return { base, synths };
  }

  // Nombre de niveaux du plan (racine comprise)
  function planLevels(node) {
    return node.kind === "synth" ? 1 + Math.max(...node.parents.map((x) => planLevels(x.plan))) : 1;
  }

  function treeNodeHtml(node, n, path) {
    const { id, kind } = node;
    const m = monsters.get(id);
    const key = [...path, id].join(".");
    const depth = path.length;
    const isRoot = depth === 0;
    const synth = kind === "synth";
    const open = synth && (state.treeOpen.get(key) ?? depth < state.treeLevels - 1);

    const toggle = synth
      ? `<button type="button" class="t-toggle" data-toggle="${key}" aria-expanded="${open}">${open ? "▾" : "▸"}</button>`
      : "";
    const family = t("families")[m.family] || m.family || "";
    const tags = [
      m.rank ? `<span class="rank" data-r="${esc(m.rank)}" title="${esc(family)}">${esc(m.rank)}</span>` : "",
      n > 1 ? `<span class="t-count">×${n}</span>` : "",
      kind === "base" ? `<span class="t-tag" title="${esc(t("baseTitle"))}">${t("base")}</span>` : "",
      kind === "cycle" ? `<span class="t-tag" title="${esc(t("cycleTitle"))}">${t("cycle")}</span>` : "",
      synth && node.recipes[node.idx].patch ? `<span class="tag-patch" title="${esc(t("patchTitle"))}">${t("patch")}</span>` : "",
    ].join("");
    const switcher = synth && node.recipes.length > 1
      ? `<span class="t-switch" title="${esc(t("recipeSwitch"))}">
          <button type="button" data-choice="${id}" data-current="${node.idx}" data-count="${node.recipes.length}" data-dir="-1" aria-label="${esc(t("recipeSwitch"))}">‹</button>
          ${node.idx + 1}/${node.recipes.length}
          <button type="button" data-choice="${id}" data-current="${node.idx}" data-count="${node.recipes.length}" data-dir="1" aria-label="${esc(t("recipeSwitch"))}">›</button>
        </span>` : "";
    const ownBtn = !isRoot && (synth || kind === "owned")
      ? `<button type="button" class="t-own" data-own="${id}" aria-pressed="${kind === "owned"}" title="${esc(`${t("owned")} : ${t("ownedTitle")}`)}"
          aria-label="${esc(t("owned"))}">✓</button>`
      : "";
    const children = open
      ? `<div class="t-children">${node.parents
        .map((x) => treeNodeHtml(x.plan, n * x.count, [...path, id])).join("")}</div>`
      : "";

    return `<div class="t-node">
      <div class="t-card${kind === "owned" ? " owned" : ""}${kind === "base" || kind === "cycle" ? " leaf" : ""}${isRoot ? " root" : ""}">
        ${monHtml(id)}
        <div class="t-tags">${tags}${switcher}${ownBtn}</div>
        ${toggle}
      </div>
      ${children}
    </div>`;
  }

  function renderTree() {
    const byResult = recipesByResult();
    const root = state.treeRoot;
    const q = norm(state.treeQuery.trim());
    const candidates = monsterList
      .filter((m) => byResult.has(m.id) && (!q || norm(nameOf(m)).includes(q) || norm(m.name.en).includes(q)))
      .slice(0, q ? 40 : 0);
    $("#tree-picker").innerHTML = candidates
      .map((m) => `<button type="button" class="mon result" data-tree="${m.id}">${iconHtml(m)}
        <span class="name">${esc(nameOf(m))}</span>${rankHtml(m)}</button>`).join("");

    const body = $("#tree-body");
    if (root == null || !monsters.has(root)) {
      body.innerHTML = `<p class="empty">${t("treePick")}</p>`;
      return;
    }
    const plan = buildPlan(root);
    const maxLevels = planLevels(plan);
    state.treeLevels = Math.min(state.treeLevels ?? DEFAULT_LEVELS, maxLevels);
    const { base, synths } = planTotals(plan);
    const needed = [...base.values()].reduce((a, b) => a + b, 0);
    // Du rang le plus haut au plus bas, puis par quantité décroissante
    const rankOrder = (id) => {
      const i = RANKS.indexOf(monsters.get(id).rank);
      return i < 0 ? RANKS.length : RANKS.length - 1 - i;
    };
    const baseChips = [...base]
      .sort((a, b) => rankOrder(a[0]) - rankOrder(b[0]) || b[1] - a[1]
        || nameOf(monsters.get(a[0])).localeCompare(nameOf(monsters.get(b[0]))))
      .map(([id, n]) => {
        const m = monsters.get(id);
        const family = t("families")[m.family] || m.family || "";
        return `<div class="t-base">${monHtml(id)}<span class="t-count">×${n}</span>
          ${m.rank ? `<span class="rank" data-r="${esc(m.rank)}" title="${esc(family)}">${esc(m.rank)}</span>` : ""}</div>`;
      }).join("");

    body.innerHTML = `
      <div class="window t-summary">
        <div class="t-summary-head">
          <h2>${esc(nameOf(monsters.get(root)))}</h2>
          <p>${t("synths")(synths)} · ${t("bases")(needed)}</p>
          <div class="t-actions">
            <button type="button" data-tree-action="expand">${t("expandAll")}</button>
            <button type="button" data-tree-action="collapse">${t("collapseAll")}</button>
            <button type="button" data-tree-action="reset">${t("resetTree")}</button>
          </div>
        </div>
        ${synths ? `<h3>${t("baseList")}</h3><div class="t-bases">${baseChips}</div>` : ""}
      </div>
      <div class="t-toolbar">
        ${maxLevels > 1 ? `<label class="t-levels">
          <span>${t("levels")} : <strong id="tree-levels-value">${state.treeLevels}</strong> / ${maxLevels}</span>
          <input type="range" id="tree-levels" min="1" max="${maxLevels}" step="1" value="${state.treeLevels}">
        </label>` : ""}
        <p class="count">${t("treeHint")}</p>
      </div>
      <div class="window t-scroll"><div class="t-canvas"></div></div>`;
    renderTreeCanvas();
  }

  // Seul l'arbre est redessiné quand le curseur bouge (le curseur garde le focus pendant le glisser)
  function renderTreeCanvas() {
    const canvas = $(".t-canvas");
    if (!canvas) return;
    canvas.innerHTML = treeNodeHtml(buildPlan(state.treeRoot), 1, []);
    const value = $("#tree-levels-value");
    if (value) value.textContent = state.treeLevels;
  }

  function saveTreePrefs() {
    store.set("owned", JSON.stringify([...state.owned]));
    store.set("choice", JSON.stringify(state.choice));
  }

  // Re-rendu en gardant la position de défilement horizontal de l'arbre
  function rerenderTree() {
    const scroller = $(".t-scroll");
    const left = scroller?.scrollLeft ?? 0;
    renderTree();
    const next = $(".t-scroll");
    if (next) next.scrollLeft = left;
  }

  // --- Réglages / navigation ----------------------------------------------

  function go(hash) {
    history.pushState(null, "", hash || location.pathname + location.search);
    route();
  }

  function applySettings() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll("[data-i18n-label]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nLabel)); });
    document.title = t("title");
    document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === state.lang));
    document.querySelectorAll("[data-rom]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.rom === state.rom));
    document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === state.view));
    const tree = state.view === "tree";
    $("#tree").hidden = !tree;
    $("#list").hidden = tree;
    $(".filters").hidden = tree;
    if (tree) rerenderTree();
    else {
      renderChips();
      renderList();
    }
    const open = location.hash.match(/^#m\/(\d+)$/);
    if (open && $("#detail").open) openDetail(Number(open[1]));
  }

  // #m/<id> : fiche (par-dessus la vue courante) · #t ou #t/<id> : arbre · vide : listes
  function route() {
    const hash = location.hash;
    const detail = hash.match(/^#m\/(\d+)$/);
    if (detail) return openDetail(Number(detail[1]));
    closeDetail();
    const tree = hash.match(/^#t(?:\/(\d+))?$/);
    if (tree) {
      const root = tree[1] ? Number(tree[1]) : state.treeRoot;
      if (root !== state.treeRoot) {
        state.treeRoot = root;
        state.treeLevels = null;
        state.treeOpen.clear();
        window.scrollTo(0, 0);
      }
      state.view = "tree";
    } else {
      state.view = state.listView;
    }
    applySettings();
  }

  document.addEventListener("click", (e) => {
    const target = e.target;
    const treeBtn = target.closest("[data-tree]");
    if (treeBtn) {
      state.treeQuery = "";
      $("#tree-search").value = "";
      return go(`#t/${treeBtn.dataset.tree}`);
    }
    const toggle = target.closest("[data-toggle]");
    if (toggle) {
      state.treeOpen.set(toggle.dataset.toggle, toggle.getAttribute("aria-expanded") !== "true");
      return rerenderTree();
    }
    const choice = target.closest("[data-choice]");
    if (choice) {
      const id = Number(choice.dataset.choice);
      const count = Number(choice.dataset.count);
      state.choice[id] = (Number(choice.dataset.current) + Number(choice.dataset.dir) + count) % count;
      saveTreePrefs();
      return rerenderTree();
    }
    const own = target.closest("[data-own]");
    if (own) {
      const id = Number(own.dataset.own);
      state.owned.has(id) ? state.owned.delete(id) : state.owned.add(id);
      saveTreePrefs();
      return rerenderTree();
    }
    const action = target.closest("[data-tree-action]");
    if (action) {
      const kind = action.dataset.treeAction;
      state.treeOpen.clear();
      if (kind === "expand") state.treeLevels = Infinity;
      if (kind === "collapse") state.treeLevels = 1;
      if (kind === "reset") {
        state.choice = {};
        state.owned.clear();
        state.treeLevels = null;
        saveTreePrefs();
      }
      return rerenderTree();
    }
    const mon = target.closest(".mon");
    if (mon) return openDetail(Number(mon.dataset.id));
    const chip = target.closest(".chip");
    if (chip) {
      const set = state[chip.dataset.group];
      set.has(chip.dataset.value) ? set.delete(chip.dataset.value) : set.add(chip.dataset.value);
      chip.setAttribute("aria-pressed", set.has(chip.dataset.value));
      return renderList();
    }
    const btn = target.closest("[data-lang], [data-rom], [data-view]");
    if (btn) {
      if (btn.dataset.lang) store.set("lang", (state.lang = btn.dataset.lang));
      if (btn.dataset.rom) store.set("rom", (state.rom = btn.dataset.rom));
      if (btn.dataset.view === "tree") return go(state.treeRoot == null ? "#t" : `#t/${state.treeRoot}`);
      if (btn.dataset.view) {
        state.listView = btn.dataset.view;
        return go("");
      }
      return applySettings();
    }
    if (target.closest(".close")) dismiss();
  });

  const dialog = $("#detail");
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dismiss(); });
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); dismiss(); });

  const debounce = (fn) => {
    let timer;
    return (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(e.target.value), 120);
    };
  };
  $("#search").addEventListener("input", debounce((value) => { state.query = value; renderList(); }));
  // Bouton « retour en haut » : visible seulement une fois la page défilée
  const toTop = $("#to-top");
  const updateToTop = () => { toTop.hidden = scrollY < 300; };
  addEventListener("scroll", updateToTop, { passive: true });
  updateToTop();
  toTop.addEventListener("click", () => {
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  });

  // Cliquer-glisser dans l'arbre (souris) : défile le cadre horizontalement et la page verticalement.
  // Le glissement démarre après quelques pixels pour laisser passer les clics simples.
  const DRAG_THRESHOLD = 5;
  let drag = null;
  let suppressClick = false;
  document.addEventListener("pointerdown", (e) => {
    const scroller = e.target.closest(".t-scroll");
    if (!scroller || e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { scroller, x: e.clientX, y: e.clientY, moved: false };
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.scroller.classList.add("dragging");
      window.getSelection()?.removeAllRanges();
    }
    drag.scroller.scrollLeft -= dx;
    window.scrollBy(0, -dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const endDrag = () => {
    if (!drag) return;
    if (drag.moved) {
      drag.scroller.classList.remove("dragging");
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
    drag = null;
  };
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  // Le clic qui termine un glissement ne doit ni ouvrir une fiche ni replier une branche
  document.addEventListener("click", (e) => {
    if (suppressClick) {
      e.stopPropagation();
      e.preventDefault();
      suppressClick = false;
    }
  }, true);

  let levelsFrame;
  document.addEventListener("input", (e) => {
    if (e.target.id !== "tree-levels") return;
    state.treeLevels = Number(e.target.value);
    state.treeOpen.clear();
    clearTimeout(levelsFrame);
    levelsFrame = setTimeout(renderTreeCanvas, 16);
  });
  $("#tree-search").addEventListener("input", debounce((value) => { state.treeQuery = value; renderTree(); }));

  window.addEventListener("popstate", route);
  route();
})();
