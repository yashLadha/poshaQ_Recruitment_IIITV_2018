var express = require('express');
var router = express.Router();
var db = require('../utils/mongo');
const csv = require('csvtojson');
var Movie = require('../schemas/Movies');
var Credit = require('../schemas/Credits');
var async = require('async');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

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
            console.log(ActorGenre);
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

router.get('/popCredit', (req, res, next) => {
  const csvFilePath = 'credits.csv';
  csv()
    .fromFile(csvFilePath)
    .then(jsonObj => {
      var creditArr = [];
      jsonObj.forEach(element => {
        var obj = extractCredit(element);
        creditArr.push(obj);
      });
      Credit.insertMany(creditArr).catch(err => console.log(err));
    });
  res.json({ status: 'Received' });
});

const extractCredit = element => {
  var obj = {};
  obj.movieId = parseInt(element.movie_id);
  obj.title = element.title;
  obj.Cast = JSON.parse(element.cast);
  obj.Crew = JSON.parse(element.crew);
  return obj;
};

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

router.get('/profit', (req, res, next) => {
  var year = parseInt(req.query.year);
  var start = new Date(year, 1, 1);
  var end = new Date(year+1, 1, 1)
  Movie.find({'releaseDate': {'$gte': start, '$lt': end}})
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

router.get('/populate', function(req, res, next) {
  const csvFilePath = 'movies.csv';
  csv()
    .fromFile(csvFilePath)
    .then(jsonObj => {
      var movieArr = [];
      jsonObj.forEach(element => {
        var obj = extractMovie(element);
        Movie.create(obj).catch(err => {
          console.log(err);
        });
      });
    });
  res.json({ status: 'Received' });
});

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
