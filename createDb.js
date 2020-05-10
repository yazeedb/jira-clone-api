const fs = require('fs');

const db = {
  users: [],
};

fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
