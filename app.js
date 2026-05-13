require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient;
const app = express();

app.set("view engine", "ejs");

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
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB", err);
  });

//////////////////////////////////////////////////////////////////////
// app starts here

app.get("/", function (req, res) {
  res.render("index", {
    mapboxAccessToken: process.env.MAPBOX_KEY,
  });
});

app.get("/747", function (req, res) {
  res.render("747", {
    mapboxAccessToken: process.env.MAPBOX_KEY,
  });
});

app.post("/", function (req, res) {});

app.listen(process.env.PORT || 3000, function () {
  console.log("listening");
});
