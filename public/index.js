import importedRoutes from "./routes.json" assert { type: "json" };

//// This is the mapbox code
mapboxgl.accessToken = "";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/jorisboris/clmdk27ll01bw01qx24l12bnw",
  center: [-96, 37.8],
  zoom: 1,
});

////////////////////////////////////////////////////////////////////////////////////////////////
//// Drawing Lines

// IK HEB DE DUBBELE ER NOG NIET UITGEHAALD

for (let k = 0; k < importedRoutes.length; k++) {
  let origin1 = importedRoutes[k].originCoordinates;

  let originCityName = importedRoutes[k].originCityName;

  let destination1 = importedRoutes[k].destinationCoordinates;

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
        properties: {
          // wondering if I can use this for the lines lighting up when hovering a marker
          origin: originCityName,
        },
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

  // // Calculate the great-circle arc between origin and destination
  // const arc = turf.greatCircle(origin, destination, { steps }).geometry
  //   .coordinates;

  // Update the route with calculated arc coordinates
  route.features[0].geometry.coordinates = arc;

  // Used to increment the value of the point measurement against the route.
  // let counter = 0;

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
    });
  });

  ////////////////////////////////////////////////////////////////////////////////////////////////
  //// hovering a line
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
  });
}

////////////////////////////////////////////////////////////////////////////////////////////////
//// Creating the location marker

//// making an array of all destinations and origins:
const allMarkersNames = [];
const allMarkersObject = [];

for (let i = 0; i < importedRoutes.length; i++) {
  if (!allMarkersNames.includes(importedRoutes[i].originName)) {
    allMarkersNames.push(importedRoutes[i].originName);
    allMarkersObject.push({
      name: importedRoutes[i].originName,
      coordinates: importedRoutes[i].originCoordinates,
      cityName: importedRoutes[i].originCityName,
    });
  }

  if (!allMarkersNames.includes(importedRoutes[i].destinationName)) {
    allMarkersNames.push(importedRoutes[i].destinationName);
    allMarkersObject.push({
      name: importedRoutes[i].destinationName,
      coordinates: importedRoutes[i].destinationCoordinates,
      cityName: importedRoutes[i].destinationCityName,
    });
  }
}
console.log(allMarkersNames);
console.log(allMarkersObject);

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
