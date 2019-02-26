// Netlify CRUD Serverless Application
// Author: Jorge Monge
// Date: 2019 February 18

// Variable which will store the
// data coming from the database query.
var queryReturn;
// Variable which will store the database query
// passed from the front-end through a POST request
var dbQuery = null;

// Getting the Pool and Client objects
// from the 'pg' module
const { Pool } = require('pg');

// Hiding away these sensitive values inside environment variables,
// which will be provided while deploying the Netlify serverless app.
//const { DB_USER, DB_HOST, DB_DATABASE, DB_PASSWORD, DB_PORT } = process.env;

const DB_USER = 'biflpkhu';
const DB_HOST = 'baasu.db.elephantsql.com';
const DB_DATABASE = 'biflpkhu';
const DB_PASSWORD = 'hmkS-pad-WLwC-6weDRnFsFJweRkwk21';
const DB_PORT = 5432;

async function execute(dbQuery) {
    const pgPool = new Pool({
        user: DB_USER,
        host: DB_HOST,
        database: DB_DATABASE,
        password: DB_PASSWORD,
        port: DB_PORT
    });
    // This function receives a string corresponding to
    // a database query, and returns the result as a JSON
    var res = await pgPool.query(dbQuery);
    await pgPool.end();
    return res;
}

exports.handler = async function (event, context, callback) {
    // This function will answer to GET and POST requests.
    // It will normally be used with POST requests, where the client
    // will pass a database query to the back-end. This query will
    // be executed against the database, and the result passed to
    // the client (front-end)
    dbQuery = JSON.parse(event.body).dbQuery;
    var response = await execute(dbQuery);

        callback(null, {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": '*',
                "Access-Control-Allow-Headers": 'Origin, X-Requested-With, Content-Type, Accept'
            },
            body: JSON.stringify(response)
        }) // Returns JSON
};
