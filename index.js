//// This is the leaflet code
// var map = L.map("map").setView([51.505, -0.09], 13);

// L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
//   maxZoom: 19,
//   attribution:
//     '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
// }).addTo(map);

//// This is the mapbox code
mapboxgl.accessToken =

const map = new mapboxgl.Map({
  container: "map",
  //   style: "mapbox://styles/mapbox/streets-v11",
  style: "mapbox://styles/jorisboris/clmdk27ll01bw01qx24l12bnw",
  center: [-96, 37.8],
  zoom: 2.7,
});

// Origin: Incheon, Dubai, // Destination: LAX, New York
// [[Incheon, Lax], [Dubai, JFK]]
const flightsCoordinates = [
  [
    [126.450898, 37.469221], // Incheon
    [-118.4085, 33.9416], // Lax
  ],
  [
    [55.3657, 25.2532], // Dubai
    [-73.7781, 40.6413], // JFK
  ],
];

let origin = flightsCoordinates[0][0];
// const origin = [126.450898, 37.469221];

let destination = flightsCoordinates[1][1];
// const destination = [-118.4085, 33.9416];

// mathematical hack to make sure both coordinates are positive when crossing the dateline
function changeHemisphere() {
  let originX = origin[0];
  let destinationX = destination[0];
  if (originX - destinationX > 180) {
    destination[0] = destinationX + 360;
  } else if (originX - destinationX < -180) {
    origin[0] = originX + 360;
  }
}

changeHemisphere();

// A simple line from origin to destination.
const route = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [origin, destination],
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
let counter = 0;

map.on("load", () => {
  // Add a source and layer displaying a point which will be animated in a circle.
  map.addSource("route", {
    type: "geojson",
    data: route,
  });

  map.addLayer({
    id: "route",
    source: "route",
    type: "line",
    paint: {
      "line-width": 2,
      "line-color": "#007cbf",
    },
  });
});

//// hovering a line
// Add an event listener for the "mouseenter" event
map.on("mouseenter", "route", function () {
  // Change the line's appearance when hovered over
  map.setPaintProperty("route", "line-color", "#FF5733"); // Change line color to red, for example
  map.setPaintProperty("route", "line-width", 4); // Increase line width on hover
});

// Add an event listener for the "mouseleave" event
map.on("mouseleave", "route", function () {
  // Restore the line's original appearance when the mouse leaves
  map.setPaintProperty("route", "line-color", "#007cbf"); // Restore original line color
  map.setPaintProperty("route", "line-width", 2); // Restore original line width
});

// Create a marker element with a custom icon
const markerElement = document.createElement("div");
markerElement.className = "marker";

const markerElement2 = document.createElement("div");
markerElement2.className = "marker";

// Add a marker
new mapboxgl.Marker(markerElement)
  .setLngLat(origin) // Set the marker's coordinates
  .addTo(map);

new mapboxgl.Marker(markerElement2)
  .setLngLat(destination) // Set the marker's coordinates
  .addTo(map);

// Get references to the element and the tooltip container
const elementToHover = document.getElementsByClassName("marker")[0];
const tooltip = document.getElementById("tooltip");

// Add event listener for mouse enter (hover) event
elementToHover.addEventListener("mouseenter", () => {
  // Get the position of the element relative to the viewport
  const rect = elementToHover.getBoundingClientRect();

  // Set the tooltip content
  tooltip.textContent = "This is a tooltip.";
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
