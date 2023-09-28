// import importedRoutes from "./routes.json" assert { type: "json" };
// import importedRoutesV2 from "./routesV2.json" assert { type: "json" };
// import importedRoutesV2 from "./routesV2mock.json" assert { type: "json" };

//// This is the public Mapbox code
mapboxgl.accessToken =
  "pk.eyJ1Ijoiam9yaXNib3JpcyIsImEiOiJjbG1lam95ZWQxeXhjM2ZteGY2NDhqY2ltIn0.UnfVT_V85n8-D4IN7lxcnA";

//// local accessToken

const lineTooltip = document.getElementById("lineTooltip");

const selectedAirlines = [
  "Singapore Airlines",
  "Asiana Airlines",
  "Qantas Airways",
  "Korean Air",
  "Qatar Airways",
  "Emirates",
  "Etihad Airways",
  "British Airways",
  "All Nippon Airways",
  "Lufthansa",
];

////////////////////////////////////////////////////////////////////////////////////////////////
//// Drawing Lines

// Fetch JSON data from a file
fetch("routesV2.json")
  .then((response) => response.json())
  .then((importedRoutesV2) => {
    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/jorisboris/clmdk27ll01bw01qx24l12bnw",
      center: [-96, 37.8],
      zoom: 1,
    });

    for (let k = 0; k < importedRoutesV2.length; k++) {
      let origin1 = importedRoutesV2[k].originCoordinates;

      let originCityName = importedRoutesV2[k].originCityName;

      let destination1 = importedRoutesV2[k].destinationCoordinates;

      let destinationCityName = importedRoutesV2[k].destinationCityName;

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
            "line-opacity": 1,
          },
          metadata: {
            origin: originCityName,
            airline: routeAirlines,
            destination: destinationCityName,
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

        // Filter out features with line-opacity equal to 0
        const visibleFeatures = features.filter((feature) => {
          const layerId = feature.layer.id;
          const opacity = map.getPaintProperty(layerId, "line-opacity");
          return opacity > 0;
        });

        if (visibleFeatures.length > 0) {
          // const feature = visibleFeatures[0];
          // const coordinates = e.lngLat;

          //// create tooltipcontent
          // create origin - destination
          let tooltipContent = `<strong>${
            importedRoutesV2[k].originName +
            " - " +
            importedRoutesV2[k].destinationName
          }</strong><br><div style="line-height: 1px;"></div>`;

          // add origin - destination info for each airline and flightnumber
          for (const item of importedRoutesV2[k].goflights) {
            tooltipContent += `${item.airline} - ${item.flightNumber}<br>${item.departureTimeLocal} - ${item.arrivalTimeLocal}<br><div style="line-height: 1px;"></div>`;
          }

          // create origin - destination
          tooltipContent += `<br><strong>${
            importedRoutesV2[k].destinationName +
            " - " +
            importedRoutesV2[k].originName
          }</strong><br><div style="line-height: 1px;"></div>`;

          // add destination - origin info for each airline and flightnumber
          for (const item of importedRoutesV2[k].returnflights) {
            tooltipContent += `${item.airline} - ${item.flightNumber}<br>${item.departureTimeLocal} - ${item.arrivalTimeLocal}<br><div style="line-height: 1px;"></div>`;
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
        const layerId = "route" + k;
        const opacity = map.getPaintProperty(layerId, "line-opacity");
        console.log(opacity);

        // Only apply styling and cursor change when line is visible (opacity > 0)
        if (opacity > 0) {
          // Change the line's appearance when hovered over
          map.setPaintProperty("route" + k, "line-color", "#FF5733"); // Change line color to red, for example
          map.setPaintProperty("route" + k, "line-width", 4); // Increase line width on hover

          // Add the "hover-pointer" class to the map container
          map.getCanvas().classList.add("hover-pointer");
        }
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

    // need to wait until all styles are loaded > I think this can be removed
    // map.on("style.load", () => {
    function toggleLayers(selectedAirlines) {
      // console.log(map.getStyle());

      map.getStyle().layers.forEach((layer) => {
        // take the layers starting with "route..."
        if (layer.type === "line" && layer.id.substring(0, 5) == "route") {
          // console.log(map.getLayer(layer.id).metadata.airline);
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

    // // Assuming you have a reference to your map element with id "map"
    // const mapElement = document.getElementById("map");

    // // Add a click event listener to the map element
    // mapElement.addEventListener("click", () => {
    //   // Example user input (you can replace this with your actual user input handling)
    //   const selectedAirlines = ["Korean Air", "British Airways"];

    //   // Call the toggleLayers function with the selected airlines
    //   toggleLayers(selectedAirlines);
    // });

    // Function to toggle airline selection
    function toggleAirline(airlineId) {
      const imageElement = document.getElementById(airlineId);
      let airlineName = "";

      if (airlineId === "koreanAir") {
        airlineName = "Korean Air";
      }
      if (airlineId === "emirates") {
        airlineName = "Emirates";
      }
      if (airlineId === "britishAirways") {
        airlineName = "British Airways";
      }
      if (airlineId === "etihad") {
        airlineName = "Etihad Airways";
      }
      if (airlineId === "qatar") {
        airlineName = "Qatar Airways";
      }
      if (airlineId === "ana") {
        airlineName = "All Nippon Airways";
      }
      if (airlineId === "asiana") {
        airlineName = "Asiana Airlines";
      }
      if (airlineId === "lufthansa") {
        airlineName = "Lufthansa";
      }
      if (airlineId === "singaporeAirlines") {
        airlineName = "Singapore Airlines";
      }
      if (airlineId === "qantas") {
        airlineName = "Qantas Airways";
      }

      // Check if the image is already selected
      const index = selectedAirlines.indexOf(airlineName);

      console.log(index);
      console.log(selectedAirlines);

      if (index === -1) {
        // Image not selected, add it to the array
        selectedAirlines.push(airlineName);
        imageElement.classList.remove("unselected"); // Add a CSS class for styling
      } else {
        // Image already selected, remove it from the array
        selectedAirlines.splice(index, 1);
        imageElement.classList.add("unselected"); // Remove the CSS class
      }

      // Call your function here, passing selectedImages as needed
      toggleLayers(selectedAirlines);
    }

    // Event listeners for image clicks
    document
      .getElementById("koreanAir")
      .addEventListener("click", () => toggleAirline("koreanAir"));
    document
      .getElementById("emirates")
      .addEventListener("click", () => toggleAirline("emirates"));
    document
      .getElementById("britishAirways")
      .addEventListener("click", () => toggleAirline("britishAirways"));
    document
      .getElementById("etihad")
      .addEventListener("click", () => toggleAirline("etihad"));
    document
      .getElementById("qatar")
      .addEventListener("click", () => toggleAirline("qatar"));
    document
      .getElementById("ana")
      .addEventListener("click", () => toggleAirline("ana"));
    document
      .getElementById("asiana")
      .addEventListener("click", () => toggleAirline("asiana"));
    document
      .getElementById("lufthansa")
      .addEventListener("click", () => toggleAirline("lufthansa"));
    document
      .getElementById("singaporeAirlines")
      .addEventListener("click", () => toggleAirline("singaporeAirlines"));
    document
      .getElementById("qantas")
      .addEventListener("click", () => toggleAirline("qantas"));

    // Wait for the map to be idle
    // I think this keeps loading, so I need another event
    // map.on("idle", () => {});
    // });

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
    console.log(allMarkersObject);

    // create markers
    for (let j = 0; j < allMarkersObject.length; j++) {
      // Create a marker element with a custom icon
      const markerElement = document.createElement("div");
      markerElement.className = "marker";

      // first we need to find all airlines belonging to a specific marker
      // we can use the name of the city, search the name of the city in routesV2, and then extract the airlines
      // then we need to add the airlines as metadata using setpopup
      // then we need to remve the irrelevant markers using mapboxMarkers.forEach(marker => {...

      // Add a marker
      new mapboxgl.Marker(markerElement)
        .setLngLat(allMarkersObject[j].coordinates) // Set the marker's coordinates
        // .setPopup(new mapboxgl.Popup().setHTML(allMarkersObject[j].airline)) // Add airline metadata to the popup
        .addTo(map);

      ////////////////////////////////////////////////////////////////////////////////////////////////
      // Add tooltip and hover effect to marker

      // Get references to the element and the tooltip container
      const elementToHover = document.getElementsByClassName("marker")[j];

      const tooltip = document.getElementById("tooltip");

      // Add event listener for mouse enter (hover) event for a marker
      elementToHover.addEventListener("mouseenter", () => {
        // TODO
        // first tries at code to make all the lines light up when you hover over a marker
        // it should make the lines from that marker light up
        // it should also make the other lines gray
        // console.log(allMarkersObject[j].cityName);

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

    console.log(importedRoutesV2);
  })
  .catch((error) => {
    console.error("Error loading JSON data:", error);
  });
