require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public")); // udemy class 248 15 minutes

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

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
