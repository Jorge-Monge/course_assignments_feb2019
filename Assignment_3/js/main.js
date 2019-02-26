L_PREFER_CANVAS = false;
L_NO_TOUCH = false;
L_DISABLE_3D = false;

// URL of the back-end function
// It is a Node JS function that is used to
// interact with a PostgreSQL database in the cloud
var urlBack = "/.netlify/functions/pg_connect";
// For local debugging. Comment it out for Production
urlBack = "http://localhost:9000/pg_connect";

// SQL query for fetching names and texts of all markers
var selectAllQuery = `SELECT gid,
                             poi_name,
                             poi_text,
                             poi_lat,
                             poi_lon,
                             CONCAT(datetime_uploaded::date,
                                ' | ',
                                DATE_TRUNC('SECONDS', datetime_uploaded)::time) AS datetime_uploaded
                      FROM json_ict442`;

// SQL query for inserting a marker in the database
function generateInsertQuery(poi_name, poi_text, poi_lat, poi_lon) {
    // This function accepts the new marker values, and returns the appropriate
    // SQL string to be executed against the database
    return `INSERT INTO json_ict442 (poi_name, poi_text, poi_lat, poi_lon, datetime_uploaded)
            VALUES ('${poi_name}', '${poi_text}', ${poi_lat}, ${poi_lon}, (SELECT NOW()))`;
};

// Tiles from different providers
var openStreetXYZ = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
var googleMapsXYZ = 'http://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}';
var bounds = null;
var layerWidget = null;

// Leaflet Map object
var main_map = null;
// DOM container for the map
var main_map_container = null;
// 'Insert New Location' button
var insert_marker_btn = null;
// JSON-type file that will store the locations
var geoJSON = {};
// DOM element that pops up when a new location is entered
var new_marker_form = null;
// HTML button to submit a new marker
var submit_marker = null;
// ... and to cancel the input
var cancel_marker = null;
// Actual Leaflet marker for the location being entered by the user
var marker = null;
// Pseudo-marker (not an actual instance of the Leaflet class),
// used to store point properties and send them to the database
var point = {};
// DOM element corresponding to the marker name input
var marker_name_input = null;
// DOM element corresponding to the marker text input
var marker_text_input = null;
// Marker name and text entered by the user
//var marker_name = null;
//var marker_text = null

// Arrow function the, when invoked, will
// return an HTML block where the variables
// names (function arguments) will have been evaluated
var markerHtml = (marker_id, marker_name, marker_text, datetime_uploaded) => {
    return `<div class="w3-card-4 custom_popup_html">
            <header class="w3-container w3-blue">
            <h5>${marker_name}</h5>
            </header>
            <div class="w3-container">
            <p>${marker_text}</p>
            </div>
            <footer class="w3-container w3-blue">
            <p>Id.# ${marker_id}</p>
            <div class="marker_popup_footer">
            <p>${datetime_uploaded} UTC</p>
            <input type="image" src="images/delete-png-icon-7.png" class="delete_marker"/>
            </div>
            </footer>
            </div>`
};


async function httpPerformRequest(url, httpMethod, httpBody) {
    return (await fetch(url, {
        method: httpMethod,
        //headers: {
            // Informs the server about the types of data that can be sent back
            //'Accept': "application/json"//,
        //},
        body: httpBody
    })).json();
}


async function getMarkers() {
    // This function connects to the database in the back-end,
    // obtains all the markers and stores them in the 'rows' object.

    return await httpPerformRequest(urlBack,
        'POST',
        JSON.stringify({
            dbQuery: selectAllQuery
        }))
};

function drawMarkers(markersArray) {
    // This function accepts an array of markers (objects) as the
    // only parameter, and inserts them in the map

    markersArray.forEach(marker => {
        // Attempt to draw the markers ONLY if the have (valid) latitude and longitude values
        // If not, break for the iteration and continue with the other records.
        if (marker.poi_lat < 0 || marker.poi_lat >90 ||
            marker.poi_lon < -180 || marker.poi_lon > 180 ||
            marker.poi_lat === null || marker.poi_lon === null) {
                return;
            };
            
        var m = L.marker([marker.poi_lat, marker.poi_lon]).addTo(main_map);
        // Bind a popup event to the newly created marker
        m.bindPopup(markerHtml(marker.gid, marker.poi_name, marker.poi_text, marker.datetime_uploaded));
    });
    console.log("*** DRAWING MARKERS FROM THE DATABASE ***");
    console.table(markersArray);
};

function sendMarkerDatabase(marker) {
    // This function accepts an object (a marker) as the only
    // argument, and stores it in the database
    var insertQuery = generateInsertQuery(marker.poi_name,
        marker.poi_text,
        marker.poi_lat,
        marker.poi_lon);
    console.log("insertQuery: " + insertQuery);
    httpPerformRequest(urlBack,
            'POST',
            JSON.stringify({
                dbQuery: insertQuery
            }))
        .then((res) => {
            console.log("Number of records added: " + res.rowCount);
        });

};





// Wait until all DOM elements are ready, so that their
// invocation does not fail.
document.addEventListener("DOMContentLoaded", initMap);


function initMap() {

    /* This is the main function.
       It draws a Leaflet map, and add the necessary event listeners
       for some DOM elements */

    main_map_container = document.getElementById("main_map");
    insert_marker_btn = document.getElementById("insert_marker");
    new_marker_form = document.getElementById("new_marker_container");
    //submit_marker = document.getElementById("submit_marker");
    //cancel_marker = document.getElementById("cancel_marker");
    // https://gomakethings.com/why-event-delegation-is-a-better-way-to-listen-for-events-in-vanilla-js/
    document.addEventListener('click', function (event) {
        if (event.target.matches(".delete_marker")) {
            console.log("DELETING THE MARKER!!");
        }
        // Event listeners for the buttons in the new-marker-data form
        else if (event.target.matches("#submit_marker")) {
            submitMarker(event);
        } else if (event.target.matches("#cancel_marker")) {
            cancelMarker(event);
        }
    }, false);

    // Get the markers from the database
    getMarkers().then((data) => {
        return data.rows;
    }).then((rows) => {
        drawMarkers(rows);
    });


    // Change the cursor type when the 'Insert New Location' button is clicked
    insert_marker_btn.addEventListener("click", prepInsertMarker);

    // Map definition
    main_map = L.map(
        'main_map', {
            center: [51.112942, -114.111327],
            zoom: 14,
            maxBounds: bounds,
            layers: [],
            worldCopyJump: false,
            crs: L.CRS.EPSG3857, // Coordinate system: Web Mercator
            zoomControl: true,
        });

    // Add an event listener on the map.
    main_map.addEventListener("click", mapClicked);

    // Tile layer definition
    // Variable definition below is enough to create the map.
    var tile_layer = L.tileLayer(
        openStreetXYZ, {
            "attribution": "Google Maps",
            "detectRetina": false,
            "maxNativeZoom": 18,
            "maxZoom": 18,
            "minZoom": 0,
            "noWrap": false,
            "opacity": 1,
            "subdomains": "abc",
            "tms": false
        }).addTo(main_map);

    var layer_control = {
        base_layers: {
            "OpenStreetMap": tile_layer,
        },
        overlays: {}
    };
} // 'initMap' function ends


function mapClicked(event) {
    // This function inserts a new Leaflet marker in the map.
    // Besides, it handles some DOM actions (buttons disabled, forms
    // displaying, cursor type changed, etc.)

    // Add a new marker on the position clicked, but only if the
    // 'Insert New Location' button has been clicked first.
    if (main_map_container.classList.contains("crosshair_enabled")) {
        marker = new L.marker(event.latlng).addTo(main_map);
        // Console out the Latitude and Longitude of the position
        console.log(marker._latlng.lat + " " + marker._latlng.lng);
        // Display the form for introducing location data
        new_marker_form.classList.replace("hide", "show");
        // Change the cursor icon back to the icon of a hand
        main_map_container.classList.toggle("crosshair_enabled");
        // Disable the 'Insert New Location' button
        insert_marker_btn.disabled = true;
    }
}


function submitMarker() {
    /* This function retrieves the information entered
       for the location, and creates a pop-up element binded
       to the marker.
       Also, it re-enables the 'Insert New Location' button and
       hides the form 
       
       TODO: Consolidate the marker location and data and store it
       in a database in a cloud server */

    // Get the marker information entered by the user through the form
    marker_name = document.getElementById("marker_name_input").value;
    marker_text = document.getElementById("marker_text_input").value;
    var dt = new Date();
    var utcDate = dt.toUTCString();
    // Bind a popup event to the newly created marker
    marker.bindPopup(markerHtml("N/A", marker_name, marker_text, utcDate)).openPopup();

    // Now, store the newly-input marker into the back-end database, by
    // invoking the sendMarkerDatabase function
    point = {
        poi_name: marker_name,
        poi_text: marker_text,
        poi_lat: marker._latlng.lat,
        poi_lon: marker._latlng.lng
    };

    sendMarkerDatabase(point);

    // Hide the form to introduce marker details
    new_marker_form.classList.replace("show", "hide");
    // Empty the form so it looks good when re-opened
    document.getElementById("marker_name_input").value = "";
    document.getElementById("marker_text_input").value = "";
    insert_marker_btn.disabled = false;
}


function cancelMarker() {
    /* This function removes the just-inserted marker.
       Also, it re-enables the 'Insert New Location' button and
       hides the form */

    // Remove the marker just drawn
    main_map.removeLayer(marker);
    // Hide the form to introduce marker details
    new_marker_form.classList.replace("show", "hide");
    // Re-enable the 'Insert New Location' button
    insert_marker_btn.disabled = false;
}

function prepInsertMarker() {
    // Prepare the DOM for the insertion of new marker,
    main_map_container.classList.toggle("crosshair_enabled");
}
