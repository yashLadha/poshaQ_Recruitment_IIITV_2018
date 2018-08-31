// Credit Schema
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var creditSchema = new Schema({
  movieId: Number,
  title: String,
  Cast: [{cast_id: Number, character: String, credit_id: String, gender: Number, id: Number, name: String, order: Number}],
  Crew: [{credit_id: String, department: String, gender: Number, id: Number, job: String, name: String}]
});

var Credit = mongoose.model('Credit', creditSchema, 'credits');
module.exports = Credit;
