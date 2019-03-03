// TODO: When inserting a marker, first insert it in the DB,
// and get its DB id, and, only then, proceed to drawing it.

L_PREFER_CANVAS = false;
L_NO_TOUCH = false;
L_DISABLE_3D = false;

// URL of the back-end function
// It is a Node JS function that is used to
// interact with a PostgreSQL database in the cloud
var urlBack = "/.netlify/functions/pg_connect";
// For local debugging. Comment it out for Production
urlBack = "http://localhost:9000/pg_connect";

// Tiles from different providers
var openStreetXYZ = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
var googleMapsXYZ = 'http://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}';
var bounds = null;
var layerWidget = null;

// Leaflet Map object
var main_map = null;
// DOM container for the map
var main_map_container = null;
// rotating icon displayed until the markers are
// fully obtained from the database
var loading_spinner = null;
// 'Insert New Location' button
var insert_marker_btn = null;
// JSON-type file that will store the locations
var geoJSON = {};
// DOM element that pops up when a new location is entered
// Temporary marker (pending the actual submission or cancellation)
var tempMarker = null;
var new_marker_form = null;
// DOM element - text input for the marker name
var form_marker_name_input = null;
// DOM element - text input for the marker text
var form_marker_text_input = null;
// HTML button to submit a new marker
var submit_marker = null;
// ... and to cancel the input
var cancel_marker = null;
// Array that will store the feature IDs (unique identifiers in the DB), so
// that we can determine which features from the database are drawn on the map
// and which others we may need to fetch from the DB.
var featureIdList = [];
// Actual Leaflet marker for the location being entered by the user
var marker = null;
// Array of markers in the map
var markersArray = [];

// Pseudo-marker (not an actual instance of the Leaflet class),
// used to store point properties and send them to the database
var point = {};
// DOM element corresponding to the marker name input
var marker_name_input = null;
// DOM element corresponding to the marker text input
var marker_text_input = null;
// Leaflet layer group that will contain all the markers
var markerGroup = null

// Arrow function the, when invoked, will
// return an HTML block where the variables
// names (function arguments) will have been evaluated
var markerHtml = (marker_leaflet_id, marker_db_id, marker_name, marker_text, datetime_uploaded) => {
    return `<div class="w3-card-4 custom_popup_html">
            <header class="w3-container w3-blue">
            <h5>${marker_name}</h5>
            </header>
            <div class="w3-container">
            <p>${marker_text}</p>
            </div>
            <footer class="w3-container w3-blue">
            <p>Id.# ${marker_leaflet_id}</p>
            <div class="marker_popup_footer">
            <p>${datetime_uploaded} UTC</p>
            <!-- Note that the value of the id attribute value is dynamically generated
                 to match the marker Id. This will help to identify the element when
                 deleting markers -->
            <input id='{"marker_leaflet_id": "${marker_leaflet_id}", 
                        "marker_db_id": "${marker_db_id}"}' type="image" src="images/delete-png-icon-7.png" class="delete_marker"/>
            </div>
            </footer>
            </div>`
};


async function httpPerformRequest(url, httpMethod, httpBody) {
    // This function is supposed to make an HTTP request to the back-end
    // and receive a JSON response.
    return (await fetch(url, {
        method: httpMethod,
        //headers: {
            // Informs the server about the types of data that can be sent back
            //'Accept': "application/json"//,
        //},
        body: httpBody
    })).json();
}

function drawMarker(latitude, longitude) {
    // This function receives latitude and longitude values,
    // and draws a Leaflet marker on the map, but not a pop-up.
    // It returns the Leaflet marker.

    return L.marker([latitude, longitude]).addTo(markerGroup);
}

async function queryExecute(dbQuery, marker, featureIdList) {
    // This function connects to the database in the back-end,
    // and executes a SQL query.
    // Function arguments are a SQL query, a custom (not Leaflet)
    // marker, and, optionally, an array with the unique identifiers (database)
    // of the markers on the current map, so that they can be compared, if needed,
    // with the features in the database. 

    return await httpPerformRequest(urlBack,
        'POST',
        JSON.stringify({
            // The actual value of the "selectAllQuery" is stored in the
            // back-end for security.
            httpMessage: {dbQuery: dbQuery,
                          marker: marker,
                          featureIdList: featureIdList}
        })) // return ends
}; // queryExecute ends


function bindPopup(marker) {
    // Binds a popup event to the marker
    // that is passed as an argument
    marker.bindPopup(markerHtml(marker._leaflet_id,
                                marker.marker_id,
                                marker.marker_name,
                                marker.marker_text,
                                marker.when_uploaded), {closeButton: false});
    }


function drawMarkers(list_of_markers) {
    // This function accepts an array of markers (objects) as the
    // only parameter, and inserts them in the map

    list_of_markers.forEach(marker => {
        // Attempt to draw the markers ONLY if the have (valid) latitude and longitude values
        // If not, break for the iteration and continue with the other records.
        if (marker.marker_latitude < 0 || marker.marker_latitude >90 ||
            marker.marker_longitude < -180 || marker.marker_longitude > 180 ||
            marker.marker_latitude === null || marker.marker_longitude === null) {
                return;
            };
            
        var m = L.marker([marker.marker_latitude,
                        marker.marker_longitude],
                        {}).addTo(markerGroup);
        // Bind a popup event to the newly created marker
        m.bindPopup(markerHtml(m._leaflet_id, marker.marker_id, marker.marker_name,
            marker.marker_text,
            marker.when_uploaded), {closeButton: false});
        // Store the newly-drawn marker in an Array, for future retrieval
        markersArray.push(m);
        //console.log("*** MARKER DRAWN ***");
        //console.log(m);
        
        
    });
    console.log("*** DRAWING MARKERS FROM THE DATABASE ***");
    console.table(markersArray);
    return true;
};  



function deleteMarker(event, marker) {
    //console.log(event.target.id);
    httpPerformRequest(urlBack,
        'POST',
        JSON.stringify({
            httpMessage: {
                dbQuery: "deleteMarkerQuery",
                marker: marker
            } // httpMessage ends
        }) // POST body ends
        )  // httpPerformRequest ends
    .then(res => res.rowCount);
}

function getMarkersFromDB (dbQuery, marker, list_featureIds_on_map) {
    //
    // GET AND DRAW ALL THE MARKERS FROM THE DATABASE
    // 
    // TODO: Generalize this block so that it can be used to draw only the NEW markers
queryExecute(dbQuery, marker, list_featureIds_on_map)
.then((data) => {
                // Store the feature Ids (unique identifiers in the DB), so
                // that we can later determine which features are already drawn
                // on the map, and which other ones we need to fetch from the DB.
                console.log("Number of records retrieved: " + data.rowCount);
                data.rows.forEach(f => featureIdList.push(f.marker_id));
                console.log("*** LIST OF FEATURE IDs ***");
                console.log("(Feature's unique identifiers in the database)");
                console.log(featureIdList);
                return data.rows;})
// Drawing the markers after an artificial delay of 1 sec
// https://stackoverflow.com/questions/38956121/how-to-add-delay-to-promise-inside-then
.then(rows => new Promise(resolve => setTimeout(() => resolve(drawMarkers(rows)), 1000)))
// Once all markers have been drawn, hide the 'loading spinner'
.then((result) => loading_spinner.classList.replace("show", "hide"))

}



// Wait until all DOM elements are ready, so that their
// invocation does not fail.
document.addEventListener("DOMContentLoaded", initMap);


function initMap() {

    /* This is the main function.
       It draws a Leaflet map, and add the necessary event listeners
       for some DOM elements */

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

    // Add to the map an empty layer group.
    markerGroup = L.layerGroup().addTo(main_map);

    // Add an event listener on the map.
    main_map.addEventListener("click", mapClicked);

    main_map_container = document.getElementById("main_map");
    loading_spinner = document.getElementById("loading_spinner");
    insert_marker_btn = document.getElementById("insert_marker");
    new_marker_form = document.getElementById("new_marker_container");
    submit_marker = document.getElementById("submit_marker");
    cancel_marker = document.getElementById("cancel_marker");
    form_marker_name_input = document.getElementById("marker_name_input");
    form_marker_text_input = document.getElementById("marker_text_input");
    
    //
    // *** DELETION OF MARKERS ***
    // https://gomakethings.com/why-event-delegation-is-a-better-way-to-listen-for-events-in-vanilla-js/
    //
    document.addEventListener('click', function (event) {

        // If user clicks on the 'Delete' icon in the marker popup...
        if (event.target.matches(".delete_marker")) {
            // First, delete the feature from the database
            marker = {marker_id: JSON.parse(event.target.id).marker_db_id};
            //deleteMarker(event, marker);
            queryExecute("deleteMarkerQuery", marker, []);
            //console.log("Number of markers deleted in the database: " +
            //            deleteMarker(event, marker));

            // Remove the feature from the web map
            markersArray.forEach(m => {
                if (m._leaflet_id.toString() === JSON.parse(event.target.id).marker_leaflet_id) {
                    main_map.removeLayer(m);
                }
                });
        }
        else if (event.target.matches("#insert_marker")) {
            prepInsertMarker(event);
        }
        // Add a click event listener for the submit button in the new-marker form
        else if (event.target.matches("#submit_marker")) {
            submitMarker(event);
        // Add a click event listener for the cancel submission button in the new-marker form
        } else if (event.target.matches("#cancel_marker")) {
            cancelMarker(event);
        }
    }, false);
    
    getMarkersFromDB("selectAllQuery", {}, []);


    // Tile layer definition
    // Variable definition below is enough to create the map.
    var tile_layer = L.tileLayer(
        openStreetXYZ, {
            "attribution": "Map data © OpenStreetMap contributors",
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
    // This function is invoked every time the user left-clicks on the map.
    // It captures (and returns) the geographical coordinates of the point,
    // and handles some UI actions (buttons disabled, forms
    // displaying, cursor type changed, etc.)
    // It also draws a Leaflet marker (temporary, since it is
    // pending its actual submission or cancellation)
      
    if (main_map_container.classList.contains("crosshair_enabled")) {
        // Display the new-marker form.
        new_marker_form.classList.replace("hide", "show");
        // Change the cursor icon back to the icon of a hand
        main_map_container.classList.toggle("crosshair_enabled");
        // Disable the 'Insert New Location' button
        insert_marker_btn.disabled = true;

        // Invoke the function to draw a temporary marker
        // (users will need to populate the new-marker form and click on
        // the form submit button in order to make it a permanent marker).
        // The temporary marker drawn is stored in 'tempMarker', thus being
        // accessible for its eventual cancellation.
        tempMarker = drawMarker(event.latlng.lat, event.latlng.lng);
    }    
    // Return the geographical coordinates of the position clicked
    console.log("Map clicked!");
    console.log("featureIdList NOW: " + featureIdList);
    console.log(event.latlng.lat.toFixed(5) + " " + event.latlng.lng.toFixed(5));
    return event.latlng;
}


function submitMarker() {
    /* This function retrieves the information entered
       for the location by the user, and creates a pop-up element binded
       to the marker.
       
       If the user submits the form, the marker is first DELETED from the web map,
       then the marker data is saved to the database, and then it is read back from the
       database and re-drawn on the map. This way we store the marker with its database unique
       identifier, which will allow us to delete it without having to refresh the page.

       If the user cancels the form, the marker is simply deleted from the web map.

       Regarding the UI, it re-enables the 'Insert New Location' button and
       hides the form */
       
    // Get the marker information entered by the user through the form
    // Handle the case when the user does not introduce anything at all
    marker_name = form_marker_name_input.value || "[Name not entered]";
    marker_text = form_marker_text_input.value || "[Text not entered]";

    // Store the newly-input marker into the back-end database, by
    // invoking the sendMarkerDatabase function
    point = {
        marker_id: null,
        marker_name: marker_name,
        marker_text: marker_text,
        // Remember that 'tempMarker' is the temporary marker
        // upon the 'click' event that also opened the form.
        marker_latitude: tempMarker._latlng.lat,
        marker_longitude: tempMarker._latlng.lng
    };

    cancelMarker()

    // Store the just-submitted marker in the database
    // The SQL query, besides inserting the new feature,
    // returns back the new features in the database (i.e. the
    // feature just inserted plus any feature inserted by other
    // users)
    queryExecute("insertMarkerQuery", point, [])
    .then(res => {
        console.log("Feature IDs List before getting the new back: ");
        console.log(featureIdList);
        getMarkersFromDB ("selectNewQuery", {}, featureIdList)
    })
    
    

    /*queryExecute("insertMarkerQuery", point, featureIdList)
    .then((res) => {
        console.log("Number of records added: " + res.rowCount);
        console.log("NEW FEATURES: ");
        console.log(res);
    });*/

    // Now bind a marker

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
    main_map.removeLayer(tempMarker);
    // Hide the form to introduce marker details
    new_marker_form.classList.replace("show", "hide");
    // Re-enable the 'Insert New Location' button
    insert_marker_btn.disabled = false;
}

function prepInsertMarker() {
    // Prepare the DOM for the insertion of new marker,
    main_map_container.classList.toggle("crosshair_enabled");
}
