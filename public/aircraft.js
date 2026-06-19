// Generic aircraft map page. Driven by window.AIRCRAFT_CONFIG that the
// EJS template injects per route. Replaces the per-aircraft scripts —
// to add a new aircraft type, add an aircraft_config.py entry + a route
// in app.js that renders aircraft.ejs with the right config.

mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
const cfg = window.AIRCRAFT_CONFIG;

const lineTooltip = document.getElementById("lineTooltip");
const tooltip = document.getElementById("tooltip");
const mapboxMarkers = [];

let airlinesCategoryData = { airlines: {} };
let currentCategory = "all";
let selectedAirlines = []; // mutated by airline-tile clicks

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

  // Build the universe of tiles: active airlines plus historically-seen ones.
  const allNames = new Set();
  activeAirlines.forEach((a) => allNames.add(a));
  statusList.forEach((s) => {
    if (s.airline && s.airline !== "Unknown") allNames.add(s.airline);
  });

  // Sort: active first (by route count desc), then inactive (by lastFlight desc).
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
  refreshVisibility(window._map);
}

// ---------------------------------------------------------------------
// Combined filter: airline AND category

function refreshVisibility(map) {
  map.getStyle().layers.forEach((layer) => {
    if (layer.type !== "line") return;
    const isHover = layer.id.startsWith("hoverroute");
    const isRoute = !isHover && layer.id.startsWith("route");
    if (!isRoute && !isHover) return;

    const meta = map.getLayer(layer.id).metadata || {};
    const layerAirlines = meta.airline || [];
    const layerCategories = meta.category || ["any"];

    const airlineMatch = layerAirlines.some((a) => selectedAirlines.includes(a));
    const categoryMatch = currentCategory === "all" || layerCategories.includes(currentCategory);
    const visible = airlineMatch && categoryMatch;

    const onOpacity = isHover ? 0.01 : 1;
    map.setPaintProperty(layer.id, "line-opacity", visible ? onOpacity : 0);
  });

  // Markers: show if the airport's airline set + category set intersects.
  mapboxMarkers.forEach((marker) => {
    const markerAirlines = (marker._element.dataset.airlines || "").split("|").filter(Boolean);
    const markerCats = (marker._element.dataset.categories || "any").split(",");
    const airlineMatch = markerAirlines.some((a) => selectedAirlines.includes(a));
    const categoryMatch = currentCategory === "all" || markerCats.includes(currentCategory);
    if (airlineMatch && categoryMatch) marker.addTo(window._map);
    else marker.remove();
  });
}

function applyCategoryFilter(category) {
  currentCategory = category;
  ["all", "passenger", "cargo"].forEach((c) => {
    const btn = document.getElementById(`filter-${c}`);
    if (btn) btn.classList.toggle("active", c === category);
  });
  refreshVisibility(window._map);
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
    const importedRoutesV2 = allRoutes;
    console.log(`${cfg.label} map: ${allRoutes.length} routes loaded`);

    const activeAirlines = new Set();
    allRoutes.forEach((r) => {
      [...(r.goflights || []), ...(r.returnflights || [])].forEach((f) => {
        if (f.airline) activeAirlines.add(f.airline);
      });
    });

    renderAirlineTiles(statusList, activeAirlines, allRoutes);

    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-96, 37.8],
      zoom: 1,
    });
    window._map = map;

    for (let k = 0; k < importedRoutesV2.length; k++) {
      let origin1 = importedRoutesV2[k].originCoordinates;
      let originCityName = importedRoutesV2[k].originCityName;
      let destination1 = importedRoutesV2[k].destinationCoordinates;
      let destinationCityName = importedRoutesV2[k].destinationCityName;
      let originAirportName = importedRoutesV2[k].originName;
      let destinationAirportName = importedRoutesV2[k].destinationName;

      let routeAirlines = [];
      for (let m = 0; m < importedRoutesV2[k].goflights.length; m++) {
        routeAirlines.push(importedRoutesV2[k].goflights[m].airline);
      }
      const routeCategories = routeCategoriesOf(importedRoutesV2[k]);

      // Dateline-crossing fix: shift one endpoint past 180° so the
      // great-circle arc draws as a single line rather than wrapping.
      if (origin1[0] - destination1[0] > 180) destination1[0] += 360;
      else if (origin1[0] - destination1[0] < -180) origin1[0] += 360;

      const route = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "LineString", coordinates: [origin1, destination1] },
          },
        ],
      };

      const lineDistance = turf.length(route.features[0]);
      const arc = [];
      const steps = 500;
      for (let i = 0; i < lineDistance; i += lineDistance / steps) {
        arc.push(turf.along(route.features[0], i).geometry.coordinates);
      }
      route.features[0].geometry.coordinates = arc;

      map.on("load", () => {
        map.addSource("route" + k, { type: "geojson", data: route });

        map.addLayer({
          id: "route" + k,
          source: "route" + k,
          type: "line",
          paint: { "line-width": 3, "line-color": "#007cbf", "line-opacity": 1 },
          metadata: {
            origin: originCityName,
            airline: routeAirlines,
            category: routeCategories,
            destination: destinationCityName,
            origin_airport: originAirportName,
            destination_airport: destinationAirportName,
          },
        });
        map.addLayer({
          id: "hoverroute" + k,
          source: "route" + k,
          type: "line",
          paint: { "line-width": 20, "line-color": "#007cbf", "line-opacity": 0.01 },
          metadata: {
            origin: originCityName,
            airline: routeAirlines,
            category: routeCategories,
            destination: destinationCityName,
            origin_airport: originAirportName,
            destination_airport: destinationAirportName,
          },
        });

        // Tooltip on hover/click
        function mouseEnterAndClick(e) {
          if (!e.features || !e.features.length) return;
          let tooltipContent = `<strong>${originAirportName} - ${destinationAirportName}</strong><br><div style="line-height: 1px;"></div>`;

          for (const item of importedRoutesV2[k].goflights) {
            let container = "";
            for (const day of item.daysOfWeek) {
              container += `<span class="dow">${day}   </span>`;
            }
            const timeLine =
              item.departureTimeLocal && item.arrivalTimeLocal
                ? `${item.departureTimeLocal} - ${item.arrivalTimeLocal}<br>`
                : ``;
            tooltipContent += `${item.airline} - ${item.flightNumber}<br>${timeLine}<div style="padding: 5px 0">${container}</div><div style="line-height: 4px;"></div>`;
          }
          if (importedRoutesV2[k].returnflights && importedRoutesV2[k].returnflights.length > 0) {
            tooltipContent += `<br><strong>${destinationAirportName} - ${originAirportName}</strong><br><div style="line-height: 1px;"></div>`;
            for (const item of importedRoutesV2[k].returnflights) {
              let container = "";
              for (const day of item.daysOfWeek) {
                container += `<span class="dow">${day}   </span>`;
              }
              const timeLine =
                item.departureTimeLocal && item.arrivalTimeLocal
                  ? `${item.departureTimeLocal} - ${item.arrivalTimeLocal}<br>`
                  : ``;
              tooltipContent += `${item.airline} - ${item.flightNumber}<br>${timeLine}<div style="padding: 5px 0">${container}</div><div style="line-height: 1px;"></div>`;
            }
          }
          lineTooltip.innerHTML = tooltipContent;
          lineTooltip.style.display = "block";
          lineTooltip.style.left = e.originalEvent.pageX + "px";
          lineTooltip.style.top = e.originalEvent.pageY + "px";
        }
        map.on("mouseenter", "hoverroute" + k, mouseEnterAndClick);
        map.on("click", "hoverroute" + k, mouseEnterAndClick);

        map.on("mouseenter", "hoverroute" + k, function () {
          const opacity = map.getPaintProperty("hoverroute" + k, "line-opacity");
          if (opacity > 0) {
            map.setPaintProperty("route" + k, "line-color", "#FF5733");
            map.setPaintProperty("route" + k, "line-width", 6);
            map.getCanvas().classList.add("hover-pointer");
          }
        });
        map.on("mouseleave", "hoverroute" + k, function () {
          map.setPaintProperty("route" + k, "line-color", "#007cbf");
          map.setPaintProperty("route" + k, "line-width", 3);
          map.getCanvas().classList.remove("hover-pointer");
          lineTooltip.style.display = "none";
        });
      });
    }

    // Category filter wiring (only present when hasCategoryFilter)
    if (cfg.hasCategoryFilter) {
      ["all", "passenger", "cargo"].forEach((c) => {
        const btn = document.getElementById(`filter-${c}`);
        if (btn) btn.addEventListener("click", () => applyCategoryFilter(c));
      });
    }

    // Build markers (deduped origin/destination airports)
    const allMarkersNames = [];
    const allMarkersObject = [];
    for (let i = 0; i < importedRoutesV2.length; i++) {
      const r = importedRoutesV2[i];
      [
        { name: r.originName, coordinates: r.originCoordinates, cityName: r.originCityName },
        { name: r.destinationName, coordinates: r.destinationCoordinates, cityName: r.destinationCityName },
      ].forEach((p) => {
        if (!allMarkersNames.includes(p.name)) {
          allMarkersNames.push(p.name);
          allMarkersObject.push(p);
        }
      });
    }

    function airlinesAtAirport(airportName) {
      const set = new Set();
      importedRoutesV2.forEach((r) => {
        if (r.originName === airportName || r.destinationName === airportName) {
          [...r.goflights, ...r.returnflights].forEach((f) => set.add(f.airline));
        }
      });
      return Array.from(set);
    }
    function categoriesAtAirport(airportName) {
      const set = new Set();
      importedRoutesV2.forEach((r) => {
        if (r.originName === airportName || r.destinationName === airportName) {
          routeCategoriesOf(r).forEach((c) => set.add(c));
        }
      });
      return Array.from(set);
    }

    map.on("load", () => {
      for (let j = 0; j < allMarkersObject.length; j++) {
        const markerElement = document.createElement("div");
        markerElement.className = "marker";

        const newMarker = new mapboxgl.Marker(markerElement)
          .setLngLat(allMarkersObject[j].coordinates)
          .addTo(map);

        // pipe-delimited so airline names containing commas don't break us
        newMarker.getElement().setAttribute(
          "data-airlines",
          airlinesAtAirport(allMarkersObject[j].name).join("|")
        );
        newMarker.getElement().setAttribute(
          "data-categories",
          categoriesAtAirport(allMarkersObject[j].name).join(",")
        );

        mapboxMarkers.push(newMarker);

        const elementToHover = document.getElementsByClassName("marker")[j];
        elementToHover.addEventListener("mouseenter", () => {
          const rect = elementToHover.getBoundingClientRect();
          tooltip.textContent =
            allMarkersObject[j].cityName + " (" + allMarkersObject[j].name + ")";
          tooltip.style.display = "block";
          const left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
        });
        elementToHover.addEventListener("mouseleave", () => {
          tooltip.style.display = "none";
        });
      }
    });
  })
  .catch((e) => console.error(`${cfg.label} aircraft map failed:`, e));
