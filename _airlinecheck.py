import os, pymongo, certifi
from dotenv import load_dotenv
from collections import Counter
load_dotenv()
pw = os.getenv('MONGO_ATLAS_PASS')
c = pymongo.MongoClient(f"mongodb+srv://joris-a380:{pw}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority", tlsCAFile=certifi.where())
db = c['a380flightsDb']
for coll in ['b747routesCollection','b787routesCollection']:
    routes = list(db[coll].find({}))
    names = Counter()
    empty_both = 0
    for r in routes:
        flights = (r.get('goflights') or []) + (r.get('returnflights') or [])
        if not flights:
            empty_both += 1
        for f in flights:
            names[f.get('airline','?')] += 1
    print(f"{coll}: {len(routes)} routes, {empty_both} with NO airline info left")
    print(f"  distinct airline names in tooltips: {len(names)}")
    for k,v in names.most_common(12):
        print(f"    {k}: {v}")
    print()
