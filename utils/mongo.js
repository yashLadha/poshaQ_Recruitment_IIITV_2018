const mongoose = require('mongoose');

mongoose.connect(
  'mongodb://localhost/poshaq',
  { useNewUrlParser: true }
);
const db = mongoose.connection;

module.exports = db;
