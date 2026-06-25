import os, pymongo, certifi, csv
from dotenv import load_dotenv
from collections import Counter
load_dotenv()
pw = os.getenv('MONGO_ATLAS_PASS')
c = pymongo.MongoClient(f"mongodb+srv://joris-a380:{pw}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority", tlsCAFile=certifi.where())
db = c['a380flightsDb']
# Find which flight-number prefixes resolve to the suspect names
suspects = ['Macair Airlines', 'British Mediterranean Airways']
# rebuild the same lookup buildRoutesJson uses
iata = {}
with open('airlines_openflights.dat', encoding='utf-8') as f:
    for row in csv.reader(f):
        if len(row) < 8: continue
        name, code, active = row[1].strip(), row[3].strip().upper(), row[7].strip()
        if len(code)==2 and code not in ('-','\\N','N/A') and name and name!='Unknown':
            if code not in iata or active=='Y':
                iata[code]=name
# which 2-letter codes map to suspects
for code,name in iata.items():
    if name in suspects:
        print(f"IATA {code} -> {name}")
# now sample real flight numbers per prefix from the 747 source
col = db['b747flightsCollection']
for code in [c for c,n in iata.items() if n in suspects]:
    fns = Counter(d.get('flightNumber','?') for d in col.find({'flightNumber':{'$regex':f'^{code}'}}).limit(2000))
    print(f"  {code} sample flights:", [k for k,_ in fns.most_common(6)])
