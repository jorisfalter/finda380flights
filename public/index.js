// import importedRoutes from "./routes.json" assert { type: "json" };
// import importedRoutesV2 from "./routesV2.json" assert { type: "json" };
// import importedRoutesV2 from "./routesV2mock.json" assert { type: "json" };

//// This is the public Mapbox code
mapboxgl.accessToken =
  "pk.eyJ1Ijoiam9yaXNib3JpcyIsImEiOiJjbG1lam95ZWQxeXhjM2ZteGY2NDhqY2ltIn0.UnfVT_V85n8-D4IN7lxcnA";

//// local accessToken

const lineTooltip = document.getElementById("lineTooltip");

// this one is for the airline filters
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

// this is a list of markers
const mapboxMarkers = [];

// let dbData = [];

////////////////////////////////////////////////////////////////////////////////////////////////
// // Testing using db
// fetch("/api/data")
//   .then((response) => response.json())
//   .then((data) => {
//     console.log("here's the db data");
//     console.log(data);
//   })
//   .catch((error) => console.error("fetch error: ", error));

////////////////////////////////////////////////////////////////////////////////////////////////
// Fetch JSON data from the db
// fetch("routesV2.json")
fetch("/api/data")
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
      let originAirportName = importedRoutesV2[k].originName;
      let destinationAirportName = importedRoutesV2[k].destinationName;

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
            "line-width": 3,
            "line-color": "#007cbf",
            "line-opacity": 1,
          },
          metadata: {
            origin: originCityName,
            airline: routeAirlines,
            destination: destinationCityName,
            origin_airport: originAirportName,
            destination_airport: destinationAirportName,
          },
        });

        // adding a second layer which is wider which makes clicking easier:
        map.addLayer({
          id: "hoverroute" + k,
          source: "route" + k,
          type: "line",
          paint: {
            "line-width": 20,
            "line-color": "#007cbf",
            "line-opacity": 0.01,
          },
          metadata: {
            origin: originCityName,
            airline: routeAirlines,
            destination: destinationCityName,
            origin_airport: originAirportName,
            destination_airport: destinationAirportName,
          },
        });
      });

      ////////////////////////////////////////////////////////////////////////////////////////////////
      //// hovering a line

      // show the tooltip
      function mouseEnterAndClick(e) {
        // map.on("mousemove", "route" + k, (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["hoverroute" + k],
        });
        // console.log(features);

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
            // Iterate through the array and create <span> elements for DOW
            let container = "";
            for (const day of item.daysOfWeek) {
              const span = document.createElement("span");
              // span.className = "dow"; // Add the "dow" class to each <span> element
              // span.textContent = day; // Set the content of the <span> to the day of the week
              let newSubString =
                "<span class = 'dow' >" + day + "   " + "</span>";
              container += newSubString; // Append the <span> element to your container
            }

            tooltipContent += `${item.airline} - ${item.flightNumber}<br>${item.departureTimeLocal} - ${item.arrivalTimeLocal}<br><div style="padding: 5px 0">${container}</div>
            <div style="line-height: 4px;"></div>`;
          }

          // create origin - destination
          tooltipContent += `<br><strong>${
            importedRoutesV2[k].destinationName +
            " - " +
            importedRoutesV2[k].originName
          }</strong><br><div style="line-height: 1px;"></div>`;

          // add destination - origin info for each airline and flightnumber
          for (const item of importedRoutesV2[k].returnflights) {
            // Iterate through the array and create <span> elements for DOW
            let container = "";
            for (const day of item.daysOfWeek) {
              const span = document.createElement("span");
              // span.className = "dow"; // Add the "dow" class to each <span> element
              // span.textContent = day; // Set the content of the <span> to the day of the week
              let newSubString =
                "<span class = 'dow' >" + day + "   " + "</span>";
              container += newSubString; // Append the <span> element to your container
            }
            tooltipContent += `${item.airline} - ${item.flightNumber}<br>${item.departureTimeLocal} - ${item.arrivalTimeLocal}<br><div style="padding: 5px 0">${container}</div><div style="line-height: 1px;"></div>`;
          }

          // add it to the html
          lineTooltip.innerHTML = tooltipContent;

          // Position the tooltip at the mouse pointer's coordinates
          lineTooltip.style.display = "block";
          lineTooltip.style.left = e.originalEvent.pageX + "px";
          lineTooltip.style.top = e.originalEvent.pageY + "px";
        }
      }
      // );

      // this is to launch the tooltip function above. For mobile view it also launches on click
      map.on("mouseenter", "hoverroute" + k, (e) => {
        mouseEnterAndClick(e);
      });
      map.on("click", "hoverroute" + k, (e) => {
        mouseEnterAndClick(e);
        // console.log("click");
      });

      // Change the color and the mouse appearance
      map.on("mouseenter", "hoverroute" + k, function () {
        const layerId = "hoverroute" + k;
        const opacity = map.getPaintProperty(layerId, "line-opacity");
        // console.log(opacity);

        // Only apply styling and cursor change when line is visible (opacity > 0)
        if (opacity > 0) {
          // Change the line's appearance when hovered over
          map.setPaintProperty("route" + k, "line-color", "#FF5733"); // Change line color to red, for example
          map.setPaintProperty("route" + k, "line-width", 6); // Increase line width on hover

          // Add the "hover-pointer" class to the map container - this changes the mouse appearance
          map.getCanvas().classList.add("hover-pointer");
        }
      });

      // Add an event listener for the "mouseleave" event
      map.on("mouseleave", "hoverroute" + k, function () {
        // Restore the line's original appearance when the mouse leaves
        map.setPaintProperty("route" + k, "line-color", "#007cbf"); // Restore original line color
        map.setPaintProperty("route" + k, "line-width", 3); // Restore original line width

        // Remove the "hover-pointer" class from the map container
        map.getCanvas().classList.remove("hover-pointer");

        // Hide the tooltip when leaving the line
        lineTooltip.style.display = "none";
      });
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //// Airline Filters

    // this is a function to change line opacity
    function toggleLayers(selectedAirlines) {
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
        // take the layers starting with "route..."
        if (layer.type === "line" && layer.id.substring(0, 5) == "hover") {
          // console.log(map.getLayer(layer.id).metadata.airline);
          // Get the airlines associated with the layer
          const airlineArray =
            // map.getPaintProperty(layer.id, "line-opacity") !== 0
            // ?
            map.getLayer(layer.id).metadata.airline;
          // : null;
          for (let n = 0; n < airlineArray.length; n++) {
            if (selectedAirlines.includes(airlineArray[n])) {
              map.setPaintProperty(layer.id, "line-opacity", 0.01);
              n = airlineArray.length;
            } else {
              map.setPaintProperty(layer.id, "line-opacity", 0);
            }
          }
        }
      });
    }

    function toggleMarkers() {
      // add and remove the markers
      mapboxMarkers.forEach((marker) => {
        // Get the popup content and split it into an array of airlines
        // console.log("togglemarker:" + marker._popup);
        // Object.entries(marker._popup).forEach(([key, value]) => {
        //   console.log(key + ": " + value);
        // });

        // const markerAirlinesFull = marker._popup._content.innerHTML;
        // console.log(marker._popup._content.innerHTML);
        // console.log(marker._popup._content.innerText);

        // console.log(marker._element.dataset.airlines);
        const markerAirlinesFull = marker._element.dataset.airlines;
        // airlineElements = marker.getAttribute("data-airlines");

        // Create a temporary div element to parse the HTML
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = markerAirlinesFull;

        // Get all <p> elements within the div
        const airlineElements = tempDiv.querySelectorAll("p");

        // Extract airline names into an array
        const markerAirlines = Array.from(airlineElements).map(
          (p) => p.textContent
        );

        // console.log(markerAirlines);

        // Check if there's an intersection between marker's airlines and selected airlines
        const intersection = markerAirlines.filter((airline) =>
          selectedAirlines.includes(airline)
        );

        if (intersection.length > 0) {
          // Show the marker
          marker.addTo(map);
        } else {
          // Hide the marker
          marker.remove();
        }
      });
    }

    // Function to add and remove airline from the array
    function toggleAirline(airlineId) {
      // imageElement
      const imageElement = document.getElementById(airlineId);
      // Define an object that maps airline IDs to airline names
      const airlineIdToName = {
        koreanAir: "Korean Air",
        emirates: "Emirates",
        britishAirways: "British Airways",
        etihad: "Etihad Airways",
        qatar: "Qatar Airways",
        ana: "All Nippon Airways",
        asiana: "Asiana Airlines",
        lufthansa: "Lufthansa",
        singaporeAirlines: "Singapore Airlines",
        qantas: "Qantas Airways",
      };

      // Get the airline name based on the airline ID
      const airlineName = airlineIdToName[airlineId];

      // Check if the image is already selected
      const index = selectedAirlines.indexOf(airlineName);

      // console.log(index);
      // console.log(selectedAirlines);

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
      toggleMarkers();
    }

    // Define an array of airline IDs
    const airlineIds = [
      "koreanAir",
      "emirates",
      "britishAirways",
      "etihad",
      "qatar",
      "ana",
      "asiana",
      "lufthansa",
      "singaporeAirlines",
      "qantas",
    ];

    // Loop through the airline IDs and add event listeners
    airlineIds.forEach((airlineId) => {
      document
        .getElementById(airlineId)
        .addEventListener("click", () => toggleAirline(airlineId));
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
    // console.log(allMarkersObject);

    // Function to extract unique airlines based on city name
    // note: this doesn't use cityName but airportName!
    function extractAirlinesByCity(airportName) {
      const uniqueAirlines = new Set(); // Use a Set to store unique airlines

      // Loop through the routesArray
      importedRoutesV2.forEach((route) => {
        if (
          route.originName === airportName ||
          route.destinationName === airportName
        ) {
          // Iterate through "goflights" and "returnflights" to collect airlines
          [...route.goflights, ...route.returnflights].forEach((flight) => {
            uniqueAirlines.add(flight.airline); // Add airline to the Set
          });
        }
      });

      return Array.from(uniqueAirlines); // Convert Set to an array and return
    }

    // create markers
    map.on("load", () => {
      for (let j = 0; j < allMarkersObject.length; j++) {
        // Create a marker element
        const markerElement = document.createElement("div");
        markerElement.className = "marker";

        // Extract airlines for the current city
        const markerAirlines = extractAirlinesByCity(allMarkersObject[j].name);

        // console.log("markerAirlines");
        // console.log(markerAirlines);

        const airlineListHTML = markerAirlines
          .map((airline) => `<p>${airline}</p>`)
          .join("");

        // Add a marker
        const newMarker = new mapboxgl.Marker(markerElement)
          .setLngLat(allMarkersObject[j].coordinates) // Set the marker's coordinates
          // .setPopup(new mapboxgl.Popup().setHTML(airlineListHTML)) // Set the airline names as popup content
          .addTo(map);

        newMarker.getElement().setAttribute("data-airlines", airlineListHTML);

        // console.log("newMarker:" + newMarker._popup);
        // Object.entries(newMarker._popup._marker._popup).forEach(
        //   ([key, value]) => {
        //     console.log("_popup.: " + key + ": " + value);
        //   }
        // );
        // Add the marker to the mapboxMarkers array
        mapboxMarkers.push(newMarker);

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
            allMarkersObject[j].cityName +
            " (" +
            allMarkersObject[j].name +
            ")";
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
    });

    // console.log(importedRoutesV2);
  })
  .catch((error) => {
    console.error("Error loading JSON data:", error);
  });
