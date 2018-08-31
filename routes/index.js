var express = require('express');
var router = express.Router();
var db = require('../utils/mongo');
const csv = require('csvtojson');
var Movie = require('../schemas/Movies');
var Credit = require('../schemas/Credits');
var async = require('async');
var _ = require('lodash/core');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/**
 * API Endpoint to insert movie details into the movies collection
 * Type : POST
 * return:
 *  Sucess: JSON Object instance saved in Mongo
 *  Failure : Error Response
 */
router.post('/insert/movie', function(req, res, next) {
  var movieObj = extractMovie(req.body);
  return Movie.create(movieObj)
    .then(data => {
      console.log('Movie inserted successfully');
      return res.json(data);
    })
    .catch(err => {
      console.log(err);
      return res.json({ error: err });
    });
});

/**
 * API Endpoint to fetch the cast information
 * ans the associated generes in which they have worked.
 * Type : GET
 * QueryParams :
 *  moviename : Name of the movie
 * return :
 *  Success : [
      {
        "actor_name": <actor_1>,
        "movies_per_genre": [
          {
            "genre": <actor_1_genre_1>, // genre_1 for actor_1
            "number of movies": <count_1>
          },
          {
            "genre": <actor_1_genre_2>, // genre_2 for actor_1
            "number of movies": <count_2>
          },
          .
          .
          .
          {
            "genre": <actor_1_genre_n>, // genre_n for actor_1
            "number of movies": <count_n>
          }
        ]
      },
    ]
  * Faliure : Error Object
 */
router.get('/castinfo', (req, res, next) => {
  var movieName = req.query.moviename;
  Credit.aggregate([
    {
      $match: { title: movieName }
    }
  ]).then(data => {
    var respArr = [];
    async.each(
      data[0].Cast,
      (element, callback) => {
        var name = element.name;
        var ActorGenre = {};
        Credit.aggregate([
          {
            $match: {
              'Cast.name': name
            }
          },
          {
            $lookup: {
              from: 'movies',
              localField: 'title',
              foreignField: 'title',
              as: 'movie_look'
            }
          },
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: [{ $arrayElemAt: ['$movie_look', 0] }, '$$ROOT']
              }
            }
          },
          { $unwind: '$genres' },
          {
            $group: {
              _id: '$genres.name',
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: 0,
              Genre: '$_id',
              Count: '$count'
            }
          }
        ])
          .then(data => {
            ActorGenre.actorname = name;
            ActorGenre.genres = data;
            respArr.push(ActorGenre);
            callback(null, ActorGenre);
          })
          .catch(err => callback(err));
      },
      err => {
        if (err) {
          res.status(500).json(err);
        } else {
          res.status(200).send(respArr);
        }
      }
    );
  });
});

// Enpoint to inflate credit data from CSV into the MongoDB
// https://stackoverflow.com/questions/44622394/import-csv-data-as-array-in-mongodb-using-mongoimport
router.get('/popCredit', (req, res, next) => {
  const csvFilePath = 'credits.csv';
  csv()
    .fromFile(csvFilePath)
    .then(jsonObj => {
      var creditArr = [];
      _(jsonObj).forEach(element => {
        var obj = extractCredit(element);
        creditArr.push(obj);
      });
      Credit.insertMany(creditArr).catch(err => console.log(err));
    });
  res.json({ status: 'Received' });
});

// Parsing JSON Object according to desired schema for Credit
const extractCredit = element => {
  var obj = {};
  obj.movieId = parseInt(element.movie_id);
  obj.title = element.title;
  obj.Cast = JSON.parse(element.cast);
  obj.Crew = JSON.parse(element.crew);
  return obj;
};

/**
 * API Endpoint to get similiar movies information
 * and limit the information to N Records and sort the information
 * in descending order of their count.
 * Type : GET
 * Query Params:
 *  moviename : Name of the movie
 *  limitCount : Count of the results
 * return:
 *  Success: [
        {
          "movie_names" : [<movie_1>,<movie_2>],
          "Number of keywords matched" : <count_1>
        },
        {
          "movie_names" : [<movie_3>],
          "Number of keywords matched" : <count_2>
        },
        .
        .
        .
        {
          "movie_name" : [<movie_N>],
          "Number of keywords matched" : <count_N>
        }
      ]
  * Failuer : Error Object
 */
router.get('/similiar', (req, res, next) => {
  var movieName = req.query.moviename;
  var limitCount = parseInt(req.query.limitCount);
  Movie.find({ title: movieName }).then(data => {
    Movie.aggregate([
      {
        $match: {
          title: { $ne: movieName }
        }
      },
      {
        $project: {
          name: '$title',
          count: {
            $size: {
              $setIntersection: ['$keywords', data[0].keywords]
            }
          }
        }
      },
      {
        $group: {
          _id: '$count',
          movie_names: { $push: '$name' }
        }
      },
      {
        $project: {
          _id: 0,
          'Number of keywords matched': '$_id',
          movie_names: '$movie_names'
        }
      },
      { $sort: { _id: -1 } },
      { $limit: limitCount }
    ])
      .then(data => {
        res.send(data);
      })
      .catch(err => {
        console.log(err);
      });
  });
});

/**
 * API Endpoint to calculate profit of production companies
 * in a given year.
 * Type : GET
 * Query Params;
 *  year : Year for computing the profit
 * return:
 *  Success : {
      "<name of production_company_1>" : <profit_1>,
      "<name of production_company_2>" : <profit_2>,
      .
      .
      .
      "<name of production_company_n>" : <profit_n>
    }
  * Failure : Error Object
 */
router.get('/profit', (req, res, next) => {
  var year = parseInt(req.query.year);
  var start = new Date(year, 1, 1);
  var end = new Date(year + 1, 1, 1);
  // Filter the movies based on release date
  Movie.find({ releaseDate: { $gte: start, $lt: end } })
    .distinct('productionCompanies.name')
    .then(data => {
      var profitArr = [];
      async.each(
        data,
        (element, callback) => {
          var prodName = element;
          Movie.aggregate([
            {
              $match: {
                'productionCompanies.name': prodName
              }
            },
            {
              $group: {
                _id: prodName,
                distRevenue: {
                  $sum: {
                    $divide: ['$revenue', { $size: '$productionCompanies' }]
                  }
                },
                distBudget: {
                  $sum: {
                    $divide: ['$budget', { $size: '$productionCompanies' }]
                  }
                }
              }
            },
            {
              $addFields: {
                profit: {
                  $subtract: ['$distRevenue', '$distBudget']
                }
              }
            },
            {
              $project: {
                _id: 0,
                profit: '$profit'
              }
            }
          ])
            .then(data => {
              console.log(data);
              var sampleObj = {};
              sampleObj[element] = data[0].profit;
              profitArr.push(sampleObj);
              callback(null, sampleObj);
            })
            .catch(err => {
              callback(err);
            });
        },
        err => {
          if (err) {
            console.log(err);
            res.status(500).send(err);
          } else {
            res.status(200).send(profitArr);
          }
        }
      );
    });
});

// Populate the movie data into the Mongo DB from CSV file
// https://stackoverflow.com/questions/44622394/import-csv-data-as-array-in-mongodb-using-mongoimport
router.get('/populate', function(req, res, next) {
  const csvFilePath = 'movies.csv';
  csv()
    .fromFile(csvFilePath)
    .then(jsonObj => {
      _(jsonObj).forEach(element => {
        var obj = extractMovie(element);
        Movie.create(obj).catch(err => {
          console.log(err);
        });
      });
    });
  res.json({ status: 'Received' });
});

// Parses the JSON into a valid Movie Schema Object
const extractMovie = element => {
  var obj = {};
  obj.budget = parseInt(element.budget);
  obj.homepage = element.homepage;
  obj.id = parseInt(element.id);
  obj.originalLanguage = element.original_language;
  obj.title = element.title;
  obj.overview = element.overview;
  obj.popularity = element.popularity;
  obj.revenue = parseInt(element.revenue);
  obj.releaseDate = new Date(element.release_date);
  obj.runtime = element.runtime;
  obj.status = element.status;
  obj.tagline = element.tagline;
  obj.title = element.title;
  obj.voteAverage = parseFloat(element.vote_average);
  obj.voteCount = parseInt(element.vote_count);
  obj.genres = JSON.parse(element.genres);
  obj.keywords = JSON.parse(element.keywords);
  obj.productionCompanies = JSON.parse(element.production_companies);
  obj.productionCountries = JSON.parse(element.production_countries);
  obj.spokenLanguages = JSON.parse(element.spoken_languages);
  return obj;
};
module.exports = router;
