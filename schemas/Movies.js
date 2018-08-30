var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var movieSchema = new Schema({
  budget: Number,
  genres: [{id: Number, name: String}],
  homepage: String,
  id: Number,
  keywords: [{id: Number, name: String, _id: false}],
  originalLanguage: String,
  originalTitle: String,
  overview: String,
  popularity: Number,
  productionCompanies: [{id: Number, name: String}],
  productionCountries: [{iso_3166_1: String, name: String}],
  releaseDate: Date,
  revenue: Number,
  runtime: Number,
  spoken_languages: [{iso_639_1: String, name: String}],
  status: String,
  tagline: String,
  title: String,
  voteAverage: Number,
  voteCount: Number
});

var Movie = mongoose.model('Movie', movieSchema, 'movies');
module.exports = Movie;
