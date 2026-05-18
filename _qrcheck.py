import os, pymongo, certifi, datetime
from dotenv import load_dotenv
load_dotenv()
c = pymongo.MongoClient(
    f"mongodb+srv://joris-a380:{os.getenv('MONGO_ATLAS_PASS')}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority",
    tlsCAFile=certifi.where())
col = c['a380flightsDb']['a380flightsCollectionV2']
now = datetime.datetime.utcnow()
for d in [30, 60, 90, 180, 365]:
    since = now - datetime.timedelta(days=d)
    qr = col.count_documents({'loggingTime': {'$gte': since}, 'flightNumber': {'$regex': '^QR'}})
    total = col.count_documents({'loggingTime': {'$gte': since}})
    print(f'Last {d:3d}d: {qr:5d} QR flights / {total} total')
last_qr = list(col.find({'flightNumber': {'$regex': '^QR'}}).sort('loggingTime', -1).limit(3))
for x in last_qr:
    print('  recent QR:', x.get('loggingTime'), x.get('flightNumber'), x.get('originIata'), '->', x.get('destinationIata'))
