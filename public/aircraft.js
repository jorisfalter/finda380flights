// Generic aircraft map page. Driven by window.AIRCRAFT_CONFIG that the
// EJS template injects per route. Replaces the per-aircraft scripts.
//
// Performance note: routes are rendered as ONE GeoJSON source + two line
// layers (visible + wide invisible hit-area), not one source/layer pair
// per route. With 995 routes (747) the old per-route approach created
// ~2000 layers + ~4000 event handlers and ground the UI to a halt.
// Filtering uses native GL filter expressions and hover uses feature-state,
// both of which run in the render engine instead of JS.

mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
const cfg = window.AIRCRAFT_CONFIG;

const lineTooltip = document.getElementById("lineTooltip");
const tooltip = document.getElementById("tooltip");
const mapboxMarkers = [];

let airlinesCategoryData = { airlines: {} };
let currentCategory = "all";
let selectedAirlines = []; // mutated by airline-tile clicks
let _activeAirlines = new Set();
let _map = null;
let _routes = []; // importedRoutesV2, for tooltip lookup by feature idx

// ---------------------------------------------------------------------
// Classification (only meaningful when cfg.hasCategoryFilter)

function classifyFlight(flightNumber) {
  if (!cfg.hasCategoryFilter) return "any";
  if (!flightNumber) return "cargo";
  const prefix = flightNumber.substring(0, 2).toUpperCase();
  const entry = airlinesCategoryData.airlines[prefix];
  if (!entry) return "cargo";
  if (entry.category === "cargo") return "cargo";
  if (entry.cargo_flight_min) {
    const numPart = flightNumber.substring(2).replace(/\D/g, "");
    const num = parseInt(numPart, 10);
    if (!isNaN(num) && num >= entry.cargo_flight_min) return "cargo";
  }
  return "passenger";
}

function routeCategoriesOf(route) {
  if (!cfg.hasCategoryFilter) return ["any"];
  const cats = new Set();
  [...(route.goflights || []), ...(route.returnflights || [])].forEach((f) => {
    cats.add(classifyFlight(f.flightNumber));
  });
  return Array.from(cats);
}

function airlinesOf(route) {
  const set = new Set();
  [...(route.goflights || []), ...(route.returnflights || [])].forEach((f) => {
    if (f.airline) set.add(f.airline);
  });
  return Array.from(set);
}

// ---------------------------------------------------------------------
// Dynamic airline tiles

function renderAirlineTiles(statusList, activeAirlines, allRoutes) {
  const container = document.getElementById("airline-filter");
  if (!container) return;

  const routeCountByAirline = new Map();
  allRoutes.forEach((r) => {
    [...(r.goflights || []), ...(r.returnflights || [])].forEach((f) => {
      if (!f.airline) return;
      routeCountByAirline.set(f.airline, (routeCountByAirline.get(f.airline) || 0) + 1);
    });
  });

  const statusByName = {};
  statusList.forEach((s) => {
    if (s.airline && s.airline !== "Unknown") statusByName[s.airline] = s;
  });

  const allNames = new Set();
  activeAirlines.forEach((a) => allNames.add(a));
  statusList.forEach((s) => {
    if (s.airline && s.airline !== "Unknown") allNames.add(s.airline);
  });

  const sorted = Array.from(allNames).sort((a, b) => {
    const aActive = activeAirlines.has(a);
    const bActive = activeAirlines.has(b);
    if (aActive !== bActive) return aActive ? -1 : 1;
    if (aActive) {
      return (routeCountByAirline.get(b) || 0) - (routeCountByAirline.get(a) || 0);
    }
    return (statusByName[b]?.lastFlight || "").localeCompare(statusByName[a]?.lastFlight || "");
  });

  selectedAirlines = Array.from(activeAirlines);

  sorted.forEach((airline) => {
    const isActive = activeAirlines.has(airline);
    const tile = document.createElement("button");
    tile.className = "airline-tile" + (isActive ? " selected" : " airline-inactive");
    tile.dataset.airline = airline;
    tile.textContent = airline;

    if (isActive) {
      tile.addEventListener("click", () => toggleAirline(airline, tile));
    } else {
      const status = statusByName[airline];
      let msg = `${airline} — no current ${cfg.label} routes`;
      if (status && status.lastFlight) {
        const dateStr = new Date(status.lastFlight).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        msg += `. Last ${cfg.label} flight: ${dateStr}`;
      }
      tile.addEventListener("mouseenter", () => {
        const rect = tile.getBoundingClientRect();
        tooltip.textContent = msg;
        tooltip.style.display = "block";
        const left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
        tooltip.style.left = `${Math.max(4, left)}px`;
        tooltip.style.top = `${rect.bottom + 8}px`;
      });
      tile.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });
    }
    container.appendChild(tile);
  });
}

function toggleAirline(airline, tile) {
  const idx = selectedAirlines.indexOf(airline);
  if (idx === -1) {
    selectedAirlines.push(airline);
    tile.classList.add("selected");
  } else {
    selectedAirlines.splice(idx, 1);
    tile.classList.remove("selected");
  }
  applyFilters();
}

// ---------------------------------------------------------------------
// Filtering — native GL filter expressions (airline AND category)

function applyFilters() {
  if (!_map) return;
  const allSelected = selectedAirlines.length >= _activeAirlines.size;

  const clauses = [];
  if (!allSelected) {
    if (selectedAirlines.length === 0) {
      clauses.push(["in", "|__none__|", ["get", "airlinesStr"]]);
    } else {
      clauses.push([
        "any",
        ...selectedAirlines.map((a) => ["in", "|" + a + "|", ["get", "airlinesStr"]]),
      ]);
    }
  }
  if (cfg.hasCategoryFilter && currentCategory !== "all") {
    clauses.push(["in", "|" + currentCategory + "|", ["get", "categoriesStr"]]);
  }
  const filter = clauses.length ? ["all", ...clauses] : null;

  _map.setFilter("routes", filter);
  _map.setFilter("routes-hover", filter);

  // Markers: visible if at least one of their airlines is selected and
  // category matches. O(markers), runs once per toggle.
  mapboxMarkers.forEach((marker) => {
    const meta = marker._meta;
    const airlineMatch = allSelected || meta.airlines.some((a) => selectedAirlines.includes(a));
    const categoryMatch =
      !cfg.hasCategoryFilter || currentCategory === "all" || meta.categories.includes(currentCategory);
    const visible = airlineMatch && categoryMatch;
    if (visible && !marker._added) {
      marker.addTo(_map);
      marker._added = true;
    } else if (!visible && marker._added) {
      marker.remove();
      marker._added = false;
    }
  });
}

function applyCategoryFilter(category) {
  currentCategory = category;
  ["all", "passenger", "cargo"].forEach((c) => {
    const btn = document.getElementById(`filter-${c}`);
    if (btn) btn.classList.toggle("active", c === category);
  });
  applyFilters();
}

// ---------------------------------------------------------------------
// Geodesic arc between two points. Step count scales with distance so we
// don't burn ~500 turf calls on a short hop (or on 995 routes at once).

function buildArc(origin, destination) {
  let o = [origin[0], origin[1]];
  let d = [destination[0], destination[1]];
  // Dateline fix: keep both endpoints on the same side of ±180.
  if (o[0] - d[0] > 180) d[0] += 360;
  else if (o[0] - d[0] < -180) o[0] += 360;

  const line = { type: "Feature", geometry: { type: "LineString", coordinates: [o, d] } };
  const dist = turf.length(line); // km
  const steps = Math.max(20, Math.min(120, Math.round(dist / 80)));
  const arc = [];
  for (let i = 0; i < dist; i += dist / steps) {
    arc.push(turf.along(line, i).geometry.coordinates);
  }
  arc.push(d);
  return arc;
}

function buildLineTooltip(route) {
  let html = `<strong>${route.originName} - ${route.destinationName}</strong><br><div style="line-height: 1px;"></div>`;
  const renderFlights = (flights) => {
    let s = "";
    for (const item of flights) {
      let container = "";
      for (const day of item.daysOfWeek) container += `<span class="dow">${day}   </span>`;
      const timeLine =
        item.departureTimeLocal && item.arrivalTimeLocal
          ? `${item.departureTimeLocal} - ${item.arrivalTimeLocal}<br>`
          : ``;
      s += `${item.airline} - ${item.flightNumber}<br>${timeLine}<div style="padding: 5px 0">${container}</div><div style="line-height: 4px;"></div>`;
    }
    return s;
  };
  html += renderFlights(route.goflights || []);
  if (route.returnflights && route.returnflights.length > 0) {
    html += `<br><strong>${route.destinationName} - ${route.originName}</strong><br><div style="line-height: 1px;"></div>`;
    html += renderFlights(route.returnflights);
  }
  return html;
}

// ---------------------------------------------------------------------
// Main: load everything in parallel, then build the map

Promise.all([
  fetch(cfg.apiUrl).then((r) => r.json()),
  fetch(cfg.airlineStatusUrl).then((r) => r.json()),
  cfg.airlinesJsonUrl
    ? fetch(cfg.airlinesJsonUrl).then((r) => r.json())
    : Promise.resolve({ airlines: {} }),
])
  .then(([allRoutes, statusList, airlinesJson]) => {
    airlinesCategoryData = airlinesJson;
    _routes = allRoutes;
    console.log(`${cfg.label} map: ${allRoutes.length} routes loaded`);

    const activeAirlines = new Set();
    allRoutes.forEach((r) => airlinesOf(r).forEach((a) => activeAirlines.add(a)));
    _activeAirlines = activeAirlines;

    renderAirlineTiles(statusList, activeAirlines, allRoutes);

    // Build ONE FeatureCollection for all routes + dedupe airports for markers.
    const features = [];
    const airportMeta = new Map(); // name -> {coordinates, cityName, airlines:Set, categories:Set}

    allRoutes.forEach((route, k) => {
      const arc = buildArc(route.originCoordinates, route.destinationCoordinates);
      const airlines = airlinesOf(route);
      const categories = routeCategoriesOf(route);
      features.push({
        type: "Feature",
        id: k,
        geometry: { type: "LineString", coordinates: arc },
        properties: {
          idx: k,
          airlinesStr: "|" + airlines.join("|") + "|",
          categoriesStr: "|" + categories.join("|") + "|",
        },
      });

      [
        { name: route.originName, coordinates: route.originCoordinates, cityName: route.originCityName },
        { name: route.destinationName, coordinates: route.destinationCoordinates, cityName: route.destinationCityName },
      ].forEach((p) => {
        let m = airportMeta.get(p.name);
        if (!m) {
          m = { coordinates: p.coordinates, cityName: p.cityName, airlines: new Set(), categories: new Set() };
          airportMeta.set(p.name, m);
        }
        airlines.forEach((a) => m.airlines.add(a));
        categories.forEach((c) => m.categories.add(c));
      });
    });

    const routesFC = { type: "FeatureCollection", features };

    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-96, 37.8],
      zoom: 1,
    });
    _map = map;

    map.on("load", () => {
      map.addSource("routes-src", { type: "geojson", data: routesFC });

      // Visible line layer — colour/width react to hover feature-state.
      map.addLayer({
        id: "routes",
        source: "routes-src",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "#FF5733",
            "#007cbf",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            6,
            3,
          ],
          "line-opacity": 1,
        },
      });

      // Wide transparent hit-area layer for easier hover/click.
      map.addLayer({
        id: "routes-hover",
        source: "routes-src",
        type: "line",
        paint: { "line-width": 20, "line-color": "#000", "line-opacity": 0.01 },
      });

      // --- Hover / click: 3 handlers total (vs ~4000 before) ---
      let hoveredId = null;

      function showTooltip(e) {
        if (!e.features || !e.features.length) return;
        const k = e.features[0].properties.idx;
        lineTooltip.innerHTML = buildLineTooltip(_routes[k]);
        lineTooltip.style.display = "block";
        lineTooltip.style.left = e.originalEvent.pageX + "px";
        lineTooltip.style.top = e.originalEvent.pageY + "px";
      }

      map.on("mousemove", "routes-hover", (e) => {
        if (!e.features || !e.features.length) return;
        const id = e.features[0].id;
        if (hoveredId !== null && hoveredId !== id) {
          map.setFeatureState({ source: "routes-src", id: hoveredId }, { hover: false });
        }
        hoveredId = id;
        map.setFeatureState({ source: "routes-src", id }, { hover: true });
        map.getCanvas().classList.add("hover-pointer");
        showTooltip(e);
      });
      map.on("click", "routes-hover", showTooltip);
      map.on("mouseleave", "routes-hover", () => {
        if (hoveredId !== null) {
          map.setFeatureState({ source: "routes-src", id: hoveredId }, { hover: false });
          hoveredId = null;
        }
        map.getCanvas().classList.remove("hover-pointer");
        lineTooltip.style.display = "none";
      });

      // --- Markers ---
      airportMeta.forEach((meta, name) => {
        const el = document.createElement("div");
        el.className = "marker";
        const marker = new mapboxgl.Marker(el).setLngLat(meta.coordinates).addTo(map);
        marker._meta = { airlines: Array.from(meta.airlines), categories: Array.from(meta.categories) };
        marker._added = true;
        mapboxMarkers.push(marker);

        el.addEventListener("mouseenter", () => {
          const rect = el.getBoundingClientRect();
          tooltip.textContent = `${meta.cityName} (${name})`;
          tooltip.style.display = "block";
          const left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
        });
        el.addEventListener("mouseleave", () => {
          tooltip.style.display = "none";
        });
      });
    });

    // Category filter wiring (only present when hasCategoryFilter)
    if (cfg.hasCategoryFilter) {
      ["all", "passenger", "cargo"].forEach((c) => {
        const btn = document.getElementById(`filter-${c}`);
        if (btn) btn.addEventListener("click", () => applyCategoryFilter(c));
      });
    }
  })
  .catch((e) => console.error(`${cfg.label} aircraft map failed:`, e));
