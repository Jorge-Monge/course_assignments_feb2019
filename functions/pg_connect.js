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

// SQL query for fetching names and texts of all markers
const selectAllQuery = `SELECT gid,
                             poi_name,
                             poi_text,
                             poi_lat,
                             poi_lon,
                             CONCAT(datetime_uploaded::date,
                                ' | ',
                                DATE_TRUNC('SECONDS', datetime_uploaded)::time) AS datetime_uploaded
                      FROM json_ict442`;
const sqlQueries = {
    "selectAllQuery": `SELECT gid,
                            poi_name,
                            poi_text,
                            poi_lat,
                            poi_lon,
                            CONCAT(datetime_uploaded::date,
                            ' | ',
                            DATE_TRUNC('SECONDS', datetime_uploaded)::time) AS datetime_uploaded
                            FROM json_ict442`
};

// SQL query for inserting a marker in the database
function generateInsertQuery(poi_name, poi_text, poi_lat, poi_lon) {
    // This function accepts the new marker values, and returns the appropriate
    // SQL string to be executed against the database 
    return `INSERT INTO json_ict442 (poi_name, poi_text, poi_lat, poi_lon, datetime_uploaded)
            VALUES ('${poi_name}', '${poi_text}', ${poi_lat}, ${poi_lon}, (SELECT NOW()))`;
};

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

    // Will get the name of the SQL Query (string)
    // We need to get the query value from sqlQueries object defined
    // at the beginning of this file
    dbQuery = sqlQueries[JSON.parse(event.body).dbQuery];
    
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
