## Poshaq Recruitment Task

Implemented four API Endpoints

* `/insert/movie` for Inserting Movie into the Mongo database. (POST Request)
* `/castinfo?moviename=<moviename>` for getting the cast information and the associated genres in which they have worked. (GET Request)
* `/similiar?moviename=<moviename>&limitcount=<limitcount>` for getting the movie matching with the similiar keywords in different movies (GET Request)
* `/profit?year=<year>` for getting profit generated in a given year by production companies (GET Request)

## Author
Yash Ladha


### Resources used
* For removing callback hell - [Best Practices to avoid Callback Hell](https://blog.risingstack.com/node-js-async-best-practices-avoiding-callback-hell-node-js-at-scale/)
* For Mongo Queries : [Mongo Documentation](https://docs.mongodb.com/)
* Express Bootstraped Project : [Express Generator](https://expressjs.com/en/starter/generator.html)

