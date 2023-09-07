//// This is the leaflet code
// var map = L.map("map").setView([51.505, -0.09], 13);

// L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
//   maxZoom: 19,
//   attribution:
//     '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
// }).addTo(map);

//// This is the mapbox code

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v11",
  center: [-96, 37.8],
  zoom: 2.7,
});

// San Francisco
const origin = [-122.414, 37.776];

// Washington DC
const destination = [-77.032, 38.913];

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
console.log(elementToHover);
const tooltip = document.getElementById("tooltip");
console.log(tooltip);
console.log(elementToHover.getBoundingClientRect().top);
console.log(elementToHover.offsetHeight);
console.log(elementToHover.offsetLeft);

// Add event listener for mouse enter (hover) event
elementToHover.addEventListener("mouseenter", () => {
  // Get the position of the element relative to the viewport
  const rect = elementToHover.getBoundingClientRect();

  // Set the tooltip content and position
  tooltip.textContent = "This is a tooltip.";
  tooltip.style.display = "block";
  tooltip.style.bottom = `${
    rect.bottom + rect.height + rect.height + rect.height / 2
  }px`;
  tooltip.style.left = `${rect.left}px`;
});

// Add event listener for mouse leave (hover out) event
elementToHover.addEventListener("mouseleave", () => {
  // Hide the tooltip
  tooltip.style.display = "none";
});
