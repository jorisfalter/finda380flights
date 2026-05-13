import os, pymongo, certifi, datetime
from dotenv import load_dotenv
load_dotenv()
c = pymongo.MongoClient(
    f"mongodb+srv://joris-a380:{os.getenv('MONGO_ATLAS_PASS')}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority",
    tlsCAFile=certifi.where(),
)
col = c['a380flightsDb']['a380flightsCollectionV2']
print('Total docs:', col.count_documents({}))
last = list(col.find({}).sort('loggingTime', -1).limit(5))
for d in last:
    print('Recent:', d.get('loggingTime'), d.get('flightNumber'), d.get('originIata'), '->', d.get('destinationIata'))
since = datetime.datetime.utcnow() - datetime.timedelta(days=30)
print('Inserted in last 30 days:', col.count_documents({'loggingTime': {'$gte': since}}))
routes_col = c['a380flightsDb']['a380routesCollection']
print('Routes collection docs:', routes_col.count_documents({}))
