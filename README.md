# finda380flights

Project to find a380 flights

## tech used

Python
Mongodb
Node
EJS

## what each file does

flightradarapi.py > cron-job to fetch a380s flying every hour
app.js > node app
buildRoutesJson > builds JSON with routes based on data from mongodb. Data is exported as JSON which has to be dragged into the public folder. Intention is to move this automatically to a cron job using MongoDB
