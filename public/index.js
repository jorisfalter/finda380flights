// import importedRoutes from "./routes.json" assert { type: "json" };
import importedRoutesV2 from "./routesV2.json" assert { type: "json" };
// import importedRoutesV2 from "./routesV2mock.json" assert { type: "json" };

//// This is the public Mapbox code
mapboxgl.accessToken =
  "pk.eyJ1Ijoiam9yaXNib3JpcyIsImEiOiJjbG1lam95ZWQxeXhjM2ZteGY2NDhqY2ltIn0.UnfVT_V85n8-D4IN7lxcnA";

//// local accessToken

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/jorisboris/clmdk27ll01bw01qx24l12bnw",
  center: [-96, 37.8],
  zoom: 1,
});

const lineTooltip = document.getElementById("lineTooltip");

////////////////////////////////////////////////////////////////////////////////////////////////
//// Drawing Lines

for (let k = 0; k < importedRoutesV2.length; k++) {
  let origin1 = importedRoutesV2[k].originCoordinates;

  let originCityName = importedRoutesV2[k].originCityName;

  let destination1 = importedRoutesV2[k].destinationCoordinates;

  let routeAirlines = [];
  for (let m = 0; m < importedRoutesV2[k].goflights.length; m++) {
    routeAirlines.push(importedRoutesV2[k].goflights[m].airline);
  }

  // mathematical hack to make sure both coordinates are positive when crossing the dateline
  function changeHemisphere1() {
    let originX = origin1[0];
    let destinationX = destination1[0];
    if (originX - destinationX > 180) {
      destination1[0] = destinationX + 360;
    } else if (originX - destinationX < -180) {
      origin1[0] = originX + 360;
    }
  }
  changeHemisphere1();

  // A simple line from origin to destination.
  const route = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        // properties: {
        //   // wondering if I can use this for the lines lighting up when hovering a marker
        //   origin: originCityName,
        //   airline: routeAirlines,
        // },
        geometry: {
          type: "LineString",
          coordinates: [origin1, destination1],
        },
      },
    ],
  };

  // Calculate the distance in kilometers between route start/end point.
  const lineDistance = turf.length(route.features[0]);

  const arc = [];

  // Number of steps to use in the arc and animation, more steps means
  // a smoother arc and animation, but too many steps will result in a
  // low frame rate
  const steps = 500;

  // Draw an arc between the `origin` & `destination` of the two points
  for (let i = 0; i < lineDistance; i += lineDistance / steps) {
    const segment = turf.along(route.features[0], i);
    arc.push(segment.geometry.coordinates);
  }

  // Update the route with calculated arc coordinates
  route.features[0].geometry.coordinates = arc;

  map.on("load", () => {
    // Add a source and layer displaying a point which will be animated in a circle.
    map.addSource("route" + k, {
      type: "geojson",
      data: route,
    });

    map.addLayer({
      id: "route" + k,
      source: "route" + k,
      type: "line",
      paint: {
        "line-width": 2,
        "line-color": "#007cbf",
      },
      metadata: {
        origin: originCityName,
        airline: routeAirlines,
      },
    });
  });

  ////////////////////////////////////////////////////////////////////////////////////////////////
  //// hovering a line

  // Add event listener to detect mouse movement over the line
  map.on("mousemove", "route" + k, (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ["route" + k],
    });

    if (features.length > 0) {
      const feature = features[0];
      // const coordinates = e.lngLat;

      //// create tooltipcontent
      // create origin - destination
      let tooltipContent = `<strong>${
        importedRoutesV2[k].originName +
        " - " +
        importedRoutesV2[k].destinationName
      }</strong><br>`;

      // add origin - destination info for each airline and flightnumber
      for (const item of importedRoutesV2[k].goflights) {
        tooltipContent += `${item.airline} - ${item.flightNumber}<br>${item.departureTimeLocal} - ${item.arrivalTimeLocal}<br>`;
      }

      // create origin - destination
      tooltipContent += `<br><strong>${
        importedRoutesV2[k].destinationName +
        " - " +
        importedRoutesV2[k].originName
      }</strong><br>`;

      // add destination - origin info for each airline and flightnumber
      for (const item of importedRoutesV2[k].returnflights) {
        tooltipContent += `${item.airline} - ${item.flightNumber}<br>${item.departureTimeLocal} - ${item.arrivalTimeLocal}<br>`;
      }

      // add it to the html
      lineTooltip.innerHTML = tooltipContent;

      // Position the tooltip at the mouse pointer's coordinates
      lineTooltip.style.display = "block";
      lineTooltip.style.left = e.originalEvent.pageX + "px";
      lineTooltip.style.top = e.originalEvent.pageY + "px";
    }
  });

  // Add an event listener for the "mouseenter" event
  map.on("mouseenter", "route" + k, function () {
    // Change the line's appearance when hovered over
    map.setPaintProperty("route" + k, "line-color", "#FF5733"); // Change line color to red, for example
    map.setPaintProperty("route" + k, "line-width", 4); // Increase line width on hover

    // Add the "hover-pointer" class to the map container
    map.getCanvas().classList.add("hover-pointer");
  });

  // Add an event listener for the "mouseleave" event
  map.on("mouseleave", "route" + k, function () {
    // Restore the line's original appearance when the mouse leaves
    map.setPaintProperty("route" + k, "line-color", "#007cbf"); // Restore original line color
    map.setPaintProperty("route" + k, "line-width", 2); // Restore original line width

    // Remove the "hover-pointer" class from the map container
    map.getCanvas().classList.remove("hover-pointer");

    // Hide the tooltip when leaving the line
    lineTooltip.style.display = "none";
  });
}

////////////////////////////////////////////////////////////////////////////////////////////////
//// Airline Filters

// need to wait until all styles are loaded
map.on("style.load", () => {
  function toggleLayers(selectedAirlines) {
    // console.log(map.getStyle());

    map.getStyle().layers.forEach((layer) => {
      // take the layers starting with "route..."
      if (layer.type === "line" && layer.id.substring(0, 5) == "route") {
        console.log(map.getLayer(layer.id).metadata.airline);
        // Get the airlines associated with the layer
        const airlineArray =
          // map.getPaintProperty(layer.id, "line-opacity") !== 0
          // ?
          map.getLayer(layer.id).metadata.airline;
        // : null;
        for (let n = 0; n < airlineArray.length; n++) {
          if (selectedAirlines.includes(airlineArray[n])) {
            map.setPaintProperty(layer.id, "line-opacity", 1);
            n = airlineArray.length;
          } else {
            map.setPaintProperty(layer.id, "line-opacity", 0);
          }
        }
      }
    });
  }

  // Assuming you have a reference to your map element with id "map"
  const mapElement = document.getElementById("map");

  // Add a click event listener to the map element
  mapElement.addEventListener("click", () => {
    // Example user input (you can replace this with your actual user input handling)
    const selectedAirlines = ["Korean Air", "British Airways"];

    // Call the toggleLayers function with the selected airlines
    toggleLayers(selectedAirlines);
  });

  // Wait for the map to be idle
  // I think this keeps loading, so I need another event
  // map.on("idle", () => {});
});

////////////////////////////////////////////////////////////////////////////////////////////////
//// Creating the location marker

//// making an array of all destinations and origins:
const allMarkersNames = [];
const allMarkersObject = [];

for (let i = 0; i < importedRoutesV2.length; i++) {
  if (!allMarkersNames.includes(importedRoutesV2[i].originName)) {
    allMarkersNames.push(importedRoutesV2[i].originName);
    allMarkersObject.push({
      name: importedRoutesV2[i].originName,
      coordinates: importedRoutesV2[i].originCoordinates,
      cityName: importedRoutesV2[i].originCityName,
    });
  }

  if (!allMarkersNames.includes(importedRoutesV2[i].destinationName)) {
    allMarkersNames.push(importedRoutesV2[i].destinationName);
    allMarkersObject.push({
      name: importedRoutesV2[i].destinationName,
      coordinates: importedRoutesV2[i].destinationCoordinates,
      cityName: importedRoutesV2[i].destinationCityName,
    });
  }
}

// create markers
for (let j = 0; j < allMarkersObject.length; j++) {
  // Create a marker element with a custom icon
  const markerElement = document.createElement("div");
  markerElement.className = "marker";

  // Add a marker
  new mapboxgl.Marker(markerElement)
    .setLngLat(allMarkersObject[j].coordinates) // Set the marker's coordinates
    .addTo(map);

  ////////////////////////////////////////////////////////////////////////////////////////////////
  // Add tooltip and hover effect to marker

  // Get references to the element and the tooltip container
  const elementToHover = document.getElementsByClassName("marker")[j];

  const tooltip = document.getElementById("tooltip");

  // Add event listener for mouse enter (hover) event for a marker
  elementToHover.addEventListener("mouseenter", () => {
    // first tries at code to make all the lines light up when you hover over a marker
    // it should make the lines from that marker light up
    // it should also make the other lines gray
    console.log(allMarkersObject[j].cityName);

    //// tooltip
    // Get the position of the element relative to the viewport
    const rect = elementToHover.getBoundingClientRect();

    // Set the tooltip content
    tooltip.textContent =
      allMarkersObject[j].cityName + " (" + allMarkersObject[j].name + ")";
    tooltip.style.display = "block";

    // Calculate the left position for the tooltip to center it above the element
    const tooltipWidth = tooltip.offsetWidth;
    const elementWidth = rect.width;
    const leftPosition = rect.left + elementWidth / 2 - tooltipWidth / 2;

    // Position the tooltip above the element
    const margin = 10;
    const tooltipTop = rect.top - tooltip.offsetHeight - margin;

    // Set the tooltip position
    tooltip.style.top = `${tooltipTop}px`;
    tooltip.style.left = `${leftPosition}px`;
  });

  // Add event listener for mouse leave (hover out) event
  elementToHover.addEventListener("mouseleave", () => {
    // Hide the tooltip
    tooltip.style.display = "none";
  });
}
