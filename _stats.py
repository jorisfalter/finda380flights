import os, pymongo, certifi
from dotenv import load_dotenv
load_dotenv()
c = pymongo.MongoClient(
    f"mongodb+srv://joris-a380:{os.getenv('MONGO_ATLAS_PASS')}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority",
    tlsCAFile=certifi.where(),
)
col = c['a380flightsDb']['a380flightsCollectionV2']
oldest = list(col.find({}).sort('loggingTime', 1).limit(1))
newest_pre_today = list(col.find({}).sort('loggingTime', -1).limit(1))
print('Oldest record:', oldest[0]['loggingTime'] if oldest else 'none')
print('Newest record:', newest_pre_today[0]['loggingTime'] if newest_pre_today else 'none')
print('Total:', col.count_documents({}))
import datetime
now = datetime.datetime.utcnow()
for d in [7, 14, 30, 60, 90, 180, 365, 730]:
    since = now - datetime.timedelta(days=d)
    routes_in_window = col.distinct('originIata', {'loggingTime': {'$gte': since}})
    print(f'Last {d:3d}d: {col.count_documents({"loggingTime": {"$gte": since}}):>8} docs, {len(routes_in_window):>4} unique origin airports')
