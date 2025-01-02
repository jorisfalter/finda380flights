# finda380flights

Project to find a380 flights

## tech used

Python
Mongodb
Node
EJS

## how to start

Node app.js

The flightradarapi cronjob runs every hour to find all flights with a380s at that specific time
The buildRoutesJson runs every day to filter out the specific routes based on the flights from last 7 days

## what each file does

flightradarapi.py > cron-job to fetch a380s flying every hour: python3 flightradarapi.py runs every hour
app.js > node app
buildRoutesJson > builds JSON with routes based on data from mongodb: python3 buildRoutesJson.py runs daily. Run this one after adding an airport.

## adding airports

Manually add coordinates to airports.json (I think)
