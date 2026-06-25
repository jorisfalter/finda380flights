import os, pymongo, certifi
from dotenv import load_dotenv
from collections import Counter
load_dotenv()
pw = os.getenv('MONGO_ATLAS_PASS')
c = pymongo.MongoClient(f"mongodb+srv://joris-a380:{pw}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority", tlsCAFile=certifi.where())
db = c['a380flightsDb']
for coll in ['b747flightsCollection','b787flightsCollection','a350flightsCollection','b767flightsCollection']:
    rms = list(db[coll].find({'$or':[{'originIata':'RMS'},{'destinationIata':'RMS'}]}))
    if not rms: continue
    print(f"{coll}: {len(rms)} flights touching RMS")
    fn = Counter(d.get('flightNumber','?') for d in rms)
    for k,v in fn.most_common(12):
        print(f"   {k}: {v}")
