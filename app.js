require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient;
const app = express();

app.set("view engine", "ejs");

// Cache-busting token for static assets. Prefer Heroku's git commit hash so
// it changes exactly when we deploy; fall back to process start time so it
// still rolls over on local restart.
const ASSET_VERSION = (process.env.HEROKU_SLUG_COMMIT || process.env.SOURCE_VERSION || Date.now().toString()).substring(0, 12);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public")); // udemy class 248 15 minutes

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

////////////////////////////////////////////////////////////////////////
// Setup Mongoclient
const mongoUrl =
  "mongodb+srv://joris-a380:" +
  process.env.MONGO_ATLAS_PASS +
  "@cluster0.1gi6i3v.mongodb.net/a380flightsDB";

const dbName = "a380flightsDb";
const collectionName = "a380routesCollection";

// Per-aircraft route collections. Keep this in sync with aircraft_config.py
// on the Python side — that file is the source of truth for the ingest
// pipeline; this map is just what the web layer reads.
const aircraftCollections = {
  a380: "a380routesCollection",
  b747: "b747routesCollection",
};

MongoClient.connect(mongoUrl, {})
  .then((client) => {
    console.log("Connected to MongoDB");
    const db = client.db(dbName);

    function getRouteCollection(aircraftKey) {
      const name = aircraftCollections[aircraftKey];
      if (!name) throw new Error(`unknown aircraft ${aircraftKey}`);
      return db.collection(name);
    }

    async function serveRoutes(aircraftKey, res) {
      try {
        const result = await getRouteCollection(aircraftKey).find({}).toArray();
        res.json(result);
      } catch (err) {
        console.error(`/api/${aircraftKey}/data failed`, err);
        res.status(500).send("Internal Server Error");
      }
    }

    // Legacy endpoint — frontend still hits this. Treat as A380.
    app.get("/api/data", (req, res) => serveRoutes("a380", res));

    // New per-aircraft endpoints.
    app.get("/api/a380/data", (req, res) => serveRoutes("a380", res));
    app.get("/api/b747/data", (req, res) => serveRoutes("b747", res));

    // Per-airline last-seen status (for the greyed-out "parked fleet" UI).
    async function serveAirlineStatus(aircraftKey, res) {
      try {
        const result = await db
          .collection(aircraftKey + "airlineStatus")
          .find({})
          .toArray();
        res.json(result);
      } catch (err) {
        console.error(`/api/${aircraftKey}/airline-status failed`, err);
        res.status(500).send("Internal Server Error");
      }
    }
    app.get("/api/a380/airline-status", (req, res) => serveAirlineStatus("a380", res));
    app.get("/api/b747/airline-status", (req, res) => serveAirlineStatus("b747", res));
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB", err);
  });

//////////////////////////////////////////////////////////////////////
// app starts here

app.get("/", function (req, res) {
  res.render("index", {
    mapboxAccessToken: process.env.MAPBOX_KEY,
    assetVersion: ASSET_VERSION,
    navLinks: NAV_LINKS,
    currentPath: "/",
  });
});

// Generic per-aircraft route. The aircraft.ejs view is data-driven —
// adding a new aircraft is just: aircraft_config.py entry + the route
// below + 3 Heroku Scheduler entries (FR24, adsb.lol, buildRoutes).
const AIRCRAFT_PAGES = {
  "/747":  { key: "b747", label: "747",  hasCategoryFilter: true,  airlinesJsonUrl: "/airlines_747.json" },
  "/a340": { key: "a340", label: "A340", hasCategoryFilter: false },
  "/a350": { key: "a350", label: "A350", hasCategoryFilter: false },
  "/787":  { key: "b787", label: "787",  hasCategoryFilter: false },
  "/757":  { key: "b757", label: "757",  hasCategoryFilter: true,  airlinesJsonUrl: "/airlines_757.json" },
  "/767":  { key: "b767", label: "767",  hasCategoryFilter: true,  airlinesJsonUrl: "/airlines_767.json" },
};

// Cross-page nav: every aircraft map links to every other one.
const NAV_LINKS = [
  { path: "/",     label: "A380" },
  { path: "/747",  label: "747"  },
  { path: "/787",  label: "787"  },
  { path: "/a350", label: "A350" },
  { path: "/a340", label: "A340" },
  { path: "/757",  label: "757"  },
  { path: "/767",  label: "767"  },
];

Object.entries(AIRCRAFT_PAGES).forEach(([path, conf]) => {
  app.get(path, (req, res) => {
    res.render("aircraft", {
      aircraftKey: conf.key,
      aircraftLabel: conf.label,
      apiUrl: `/api/${conf.key}/data`,
      airlineStatusUrl: `/api/${conf.key}/airline-status`,
      airlinesJsonUrl: conf.airlinesJsonUrl || null,
      hasCategoryFilter: !!conf.hasCategoryFilter,
      canonicalPath: path,
      mapboxAccessToken: process.env.MAPBOX_KEY,
      assetVersion: ASSET_VERSION,
      navLinks: NAV_LINKS,
      currentPath: path,
    });
  });
});

app.post("/", function (req, res) {});

app.listen(process.env.PORT || 3000, function () {
  console.log("listening");
});
