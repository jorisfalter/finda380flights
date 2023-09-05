//// This is the leaflet code
// var map = L.map("map").setView([51.505, -0.09], 13);

// L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
//   maxZoom: 19,
//   attribution:
//     '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
// }).addTo(map);

//// This is the mapbox code
mapboxgl.accessToken =
// from European Startups

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
