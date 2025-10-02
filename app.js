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

// Use connect method to connect to the server
MongoClient.connect(mongoUrl, {})
  .then((client) => {
    console.log("Connected to MongoDB");
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    async function fetchDataFromDb() {
      try {
        const result = await collection.find({}).toArray();
      } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
      }
    }
    fetchDataFromDb;

    // Set up an API endpoint to retrieve the data
    app.get("/api/data", async (req, res) => {
      console.log("endpoint called");
      try {
        const result = await collection.find({}).toArray();
        res.json(result);
      } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
      }
    });
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB", err);
  });

//////////////////////////////////////////////////////////////////////
// app starts here

app.get("/", function (req, res) {
  res.render("index", {
    // foundFlights: false,
    // foundDestinationsDestinationsOnlyTrf: [],
    mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN,
  });
});

app.post("/", function (req, res) {});

app.listen(process.env.PORT || 3000, function () {
  console.log("listening");
});
