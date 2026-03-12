~/.../shared/chatapp $ ls -R
.:
README.md      frontend      start.bat
data_handling  realtime_msg  start.sh

./data_handling:
__init__.py  config.py         run.py   utils
app          requirements.txt  schemas

./data_handling/app:
__init__.py  events.py      rooms.py
auth.py      messages.py    uploads.py
dev.py       middleware.py  users.py

./data_handling/schemas:
__init__.py  types.py

./data_handling/utils:
__init__.py      ids.py         store.py
audit.py         ip_ledger.py   time.py
auth_helpers.py  json_store.py  user_fs.py
backup.py        shard.py

./frontend:
index.html    public  vite.config.js
package.json  src

./frontend/public:

./frontend/src:
App.jsx  features  lib       pages   ui
app      hooks     main.jsx  styles

./frontend/src/app:

./frontend/src/features:
auth  channels  chat  presence  profile

./frontend/src/features/auth:

./frontend/src/features/channels:

./frontend/src/features/chat:

./frontend/src/features/presence:

./frontend/src/features/profile:

./frontend/src/hooks:

./frontend/src/lib:
api.js  socket.js  store.js

./frontend/src/pages:

./frontend/src/styles:
main.css

./frontend/src/ui:

./realtime_msg:
package.json  src

./realtime_msg/src:
config.js  middleware  server.js  sockets  utils

./realtime_msg/src/middleware:
auth.js

./realtime_msg/src/sockets:
handlers.js  presence.js

./realtime_msg/src/utils:
dataApi.js
~/.../shared/chatapp $