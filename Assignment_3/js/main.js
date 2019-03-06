// N O T E S    F O R   P R O D U C T I O N //
//
// Delete all comments before deployment, as they may
// contain information that could compromise the
// application security


// Leaflet constants
const L_PREFER_CANVAS = false;
const L_NO_TOUCH = false;
const L_DISABLE_3D = false;

// URL of the Netlify-deployed AWS serverless functions
// It is a Node JS function that is used to
// interact with a PostgreSQL database in the cloud
var urlBack = "/.netlify/functions/pg_connect";
// Line below needed for local debugging. COMMENT IT OUT FOR PRODUCTION
//urlBack = "http://localhost:9000/pg_connect";
// Node JS function that is used to get the Mapbox token
// (thus hiding it (to a limited extent) from the front-end)
var url_mt = "/.netlify/functions/get_mapbox_token";
// Line below needed for local debugging. COMMENT IT OUT FOR PRODUCTION
//url_mt = "http://localhost:9000/get_mapbox_token";

// Connect to one of the AWS serverless functions
// and get the Mapbox token as soon as possible.
// https://www.mapbox.com/
getMT()


//
// INITIAL VARIABLE INSTANTIATION //
//
// Google maps tile layer (not actually used as per Google Maps license terms)
var googleMapsXYZ = 'http://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}';
// Leaflet map bounds (an option)
var bounds = null;
// Leaflet Map object
var main_map = null;
// Array that will store the feature IDs (unique identifiers in the DB), so
// that we can determine which features from the database are drawn on the map
// and which others (maybe entered by other users simultaneously) we may
// need to fetch from the DB.
var featureIdList = [];
// Leaflet layer group that will contain all the markers
var markerGroup = L.layerGroup();
// Actual Leaflet marker for the location being entered by the user
var marker = null;
// Array of markers in the map
var markersArray = [];
// Temporary marker (pending the actual submission or cancellation)
// It will be removed immediately after submitting or cancelling, and then
// fetch back from the database
var tempMarker = null;

// DOM container for the map
var main_map_container = null;
// DOM element: rotating icon displayed until the markers are
// fully obtained from the database
var loading_spinner = null;
// DOM element: 'Insert New Location' button
var insert_marker_btn = null;
// DOM element: container for the New Marker Form
var new_marker_form = null;
// DOM element: text input for the marker name
var form_marker_name_input = null;
// DOM element: text input for the marker text
var form_marker_text_input = null;
// DOM ELEMENT: button to submit a new marker
var submit_marker = null;
// ... and to cancel the input
var cancel_marker = null;


//
// TILESET PROVIDERS
// This are free map services that provide the 'map background'
// (streets-style, topographic-style, satellite imagery, etc.)
// Some of the most popular are Google Maps, Mapbox, Openstreet, Stamen Maps...

// Openstreet Map
var openStreet_Map_Provider = {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
        "attribution": "Map data © OpenStreetMap contributors",
        "detectRetina": false,
        "maxNativeZoom": 18,
        "maxZoom": 18,
        "minZoom": 0,
        "noWrap": false,
        "opacity": 1,
        "subdomains": "abc",
        "tms": false
    }
};

// Variable instantiation; its value will be provided by
// populateMapBox_Map_Providers(mt), once the Mapbox token is ready 
var mapBox_Map_Provider;

// Mapbox map styles: https://docs.mapbox.com/api/maps/#static
var mapbox_style = {
    "bm-mb-streets": "streets-v11",
    "bm-mb-outdoors": "outdoors-v11",
    "bm-mb-light": "light-v10",
    "bm-mb-dark": "dark-v10",
    "bm-mb-satellite": "satellite-v9",
    "bm-mb-hybrid": "satellite-streets-v11"
};

//
/// THE ACTION STARTS HERE //
//

// Wait until all DOM elements are ready, so that their
// invocation does not fail.
document.addEventListener("DOMContentLoaded", initMap);


// MAIN FUNCTION

function initMap() {

    main_map_container = document.getElementById("main_map");
    loading_spinner = document.getElementById("loading_spinner");
    insert_marker_btn = document.getElementById("insert_marker");
    change_basemap_btn = document.getElementById("change_basemap");
    basemap_options_btns = document.getElementsByClassName("basemap_option");
    new_marker_form = document.getElementById("new_marker_container");
    submit_marker = document.getElementById("submit_marker");
    cancel_marker = document.getElementById("cancel_marker");
    form_marker_name_input = document.getElementById("marker_name_input");
    form_marker_text_input = document.getElementById("marker_text_input");

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

    //
    // EVENT LISTENERS
    //

    // NOTE that the event is not attached to a DOM element,
    // but to the Leaflet map object
    main_map.addEventListener("click", mapClicked);


    // *** EVENT DELEGATION ***
    // https://gomakethings.com/why-event-delegation-is-a-better-way-to-listen-for-events-in-vanilla-js/

    document.addEventListener('click', function (event) {

        // COLLAPSE BASEMAP OPTION BUTTONS IF EXPANDED AND
        // CLICK EVENT OUTSIDE THEM
        if (event.target.matches("#main_map")) {
            Array.prototype.forEach.call(
                basemap_options_btns,
                function (b) {
                    if (!b.classList.contains("hide")) {
                        toggleVisibilityBasemapOptionBtns(basemap_options_btns);
                    }
                });
        }

        // DELETE MARKERS
        else if (event.target.matches(".delete_marker")) {
            // Identify the marker
            marker = {
                marker_id: JSON.parse(event.target.id).marker_db_id
            };
            // Remove it from the database
            queryExecute("deleteMarkerQuery", marker, []);
            // Remove it from the front-end
            markersArray.forEach(m => {
                if (m._leaflet_id.toString() === JSON.parse(event.target.id).marker_leaflet_id) {
                    main_map.removeLayer(m);
                }
            }) 
        } // Delete markers ends

        // CHANGE BASEMAP
        else if (event.target.matches("#change_basemap")) {
            toggleVisibilityBasemapOptionBtns(basemap_options_btns);    
        } // Change basemap ends

        // BASEMAP OPTION SELECTED   
        else if (event.target.matches(".basemap_option")) {
            // Reset the style of all the option buttons
            Array.prototype.forEach.call(
                basemap_options_btns,
                function (b) {
                    b.classList.remove("option_selected");
                });

            // Get the basemap .url and .options properties
            var new_basemap = changeBaseMap(event.target.classList, event.target.id);
            // And redraw the basemap
            draw_basemap(new_basemap.url, new_basemap.options);
            // And change the style of the button
            // corresponding to the option selected
            document.getElementById(event.target.id).classList.toggle("option_selected");
            // And collapse the dropdown menu
            toggleVisibilityBasemapOptionBtns(basemap_options_btns);
        } // Basemap option ends

        // INSERT MARKER BUTTON CLICKED
        else if (event.target.matches("#insert_marker")) {
            prepInsertMarker(event);
        }

        // SUBMIT MARKER BUTTON CLICKED
        else if (event.target.matches("#submit_marker")) {
            submitMarker(event);
            // Add a click event listener for the cancel submission button in the new-marker form
        }
        
        // CANCEL MARKER SUBMISSION BUTTON CLICKED
        else if (event.target.matches("#cancel_marker")) {
            cancelMarker(event);
        }
    }, false); // Event listeners on the whole map object ends

    //
    // DRAW THE BASEMAP
    //
    draw_basemap(openStreet_Map_Provider.url, openStreet_Map_Provider.options);
    //
    // GET THE MARKERS FROM THE DATABASE, AND DRAW THEM (when fetching ends)
    getMarkersFromDB("selectAllQuery", {}, []);

} // 'initMap' function ends


//
// FUNCTION DEFINITIONS
//

//
// (ANCILLARY) PERFORM ASYNCHRONOUS HTTP REQUEST USING THE FETCH API
//

async function httpPerformRequest(url, httpMethod, httpBody) {
    // This function is supposed to make an HTTP request to the back-end
    // and receive a JSON response.
    return (await fetch(url, {
        method: httpMethod,
        headers: {
            // Informs the server about the types of data that can be sent back
            'Accept': "application/json" //,
        },
        body: httpBody
    })).json();
}


//
// (ANCILLARY) PERFORM AN ASYNCHRONOUS QUERY TO THE DATABASE
//

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
            httpMessage: {
                dbQuery: dbQuery,
                marker: marker,
                featureIdList: featureIdList
            }
        })) // return ends
}; // queryExecute ends


//
// GET TOKEN FROM MAPBOX
//

async function getMT() {
    return await httpPerformRequest(url_mt,
        'POST',
        JSON.stringify({
            // The actual value of the "selectAllQuery" is stored in the
            // back-end for security.
            httpMessage: {
                msg: "Give me that!"
            }
        })
    ) // httpPerformRequest ends
        .then(data => populateMapBox_Map_Providers(data.mt))
    //.then(o => console.log(o))
}


// 
// GET AND DRAW ALL (OR SOME OF) THE MARKERS FROM THE DATABASE
//

function getMarkersFromDB(dbQuery, marker, list_featureIds_on_map) {

    queryExecute(dbQuery, marker, list_featureIds_on_map)
        .then((data) => {
            console.log("Number of records retrieved: " + data.rowCount);

            // Store the feature Ids (unique identifiers in the DB), so
            // that we can later determine which features are already drawn
            // on the map, and which other ones we need to fetch from the DB.
            data.rows.forEach(f => featureIdList.push(f.marker_id));
            /*console.log("*** LIST OF FEATURE IDs ***\n" +
                "(Feature's unique identifiers in the database)");
            console.table(featureIdList);*/
            return data.rows;
        })
        // Drawing the markers after an artificial delay of 1 sec
        // https://stackoverflow.com/questions/38956121/how-to-add-delay-to-promise-inside-then
        .then(rows => new Promise(resolve => setTimeout(() => resolve(drawMarkers(rows)), 1000)))
        // Once all markers have been drawn, hide the 'loading spinner'
        .then((result) => loading_spinner.classList.replace("show", "hide"))

}


//
// DRAW A SINGLE MARKER ON THE FRONT-END. NO POPUP BINDING
//
function drawMarker(latitude, longitude) {
    // This function receives latitude and longitude values,
    // and draws a Leaflet marker on the map, but not a pop-up.
    // It returns the Leaflet marker.

    return L.marker([latitude, longitude]).addTo(markerGroup);
}


//
// DRAW MARKERS ON THE FRONT-END
//

function drawMarkers(list_of_markers) {
    // This function accepts an array of markers (objects) as the
    // only parameter, and inserts them in the map

    list_of_markers.forEach(marker => {
        // Attempt to draw the markers ONLY if the have (valid) latitude and longitude values
        // If not, break for the iteration and continue with the other records.
        if (marker.marker_latitude < 0 || marker.marker_latitude > 90 ||
            marker.marker_longitude < -180 || marker.marker_longitude > 180 ||
            marker.marker_latitude === null || marker.marker_longitude === null) {
            return;
        };

        var m = L.marker([marker.marker_latitude,
        marker.marker_longitude], {}).addTo(markerGroup);
        // Bind a popup event to the newly created marker
        m.bindPopup(markerHtml(m._leaflet_id, marker.marker_id, marker.marker_name,
            marker.marker_text,
            marker.when_uploaded), {
                closeButton: false
            });
        // Store the newly-drawn marker in an Array, for future retrieval
        // (for instance, when we want to delete a marker, we will need to
        // iterate through this Array)
        markersArray.push(m);

    }); // Iteration on 'list_of_markers' ends

    // Console out the database features as read from it.
    // Note that the column names are obfuscated (they don't match the DB column names,
    // for security reasons)
    console.log("*** DRAWING MARKERS FROM THE DATABASE ***");
    console.table(list_of_markers);

    return markersArray; // We don't need to return 'markersArray' but it might come in handy.
};


//
// DELETE MARKER
//

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
    ) // httpPerformRequest ends
        .then(res => res.rowCount);
}


//
// CREATE MARKER POPUP'S HTML
//

// Function that creates the Marker's popup by
// populating a HTML block with the marker object's properties.
function markerHtml(marker_leaflet_id, marker_db_id, marker_name, marker_text, datetime_uploaded) {
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


//
// CREATES A POPUP AND BIND IT TO THE MARKER
//

function bindPopup(marker) {
    // Binds a popup event to the marker
    // that is passed as an argument
    marker.bindPopup(markerHtml(marker._leaflet_id,
        marker.marker_id,
        marker.marker_name,
        marker.marker_text,
        marker.when_uploaded), {
            closeButton: false
        });
}


//
// GETS A NEW BASEMAP READY
//

function changeBaseMap(DOMClassList, basemap_id) {
    // This function gets a DOM element's ID, and
    // returns the appropriate Map_Provider
    if (DOMClassList.contains("Openstreet")) {
        var bm_provider = "Openstreet";
    }
    else if (DOMClassList.contains("Mapbox")) {
        var bm_provider = "Mapbox";
    }

    var basemaps_dict = {
        "Openstreet": {
            url: openStreet_Map_Provider.url,
            options: openStreet_Map_Provider.options
        },
        "Mapbox": {
            url: mapBox_Map_Provider.url.replace("${mapbox_style}", mapbox_style[basemap_id]),
            options: mapBox_Map_Provider.options
        },

    };

    // Returns an object, with keys: url && options
    return basemaps_dict[bm_provider];
}


//
// PREPARE MAPBOX URLs BY INSERTING THE MAPBOX TOKEN
//
function populateMapBox_Map_Providers(mt) {
    // This function will be invoked once the Mapbox token has been obtained
    // from the server. It creates the Mapbox Leaflet layers, almost ready to be
    // inserted on the map (still we need to define the mapbox stiles (variable 'mapbox_style'))
    mapBox_Map_Provider = {
        url: "https://api.mapbox.com/styles/v1/mapbox/${mapbox_style}/tiles/{z}/{x}/{y}?access_token=${mt}".replace("${mt}", mt),
        options: {
            attribution: "© <a href='https://apps.mapbox.com/feedback/'>Mapbox</a> © <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
            tileSize: 512,
            opacity: 1,
            zoomOffset: -1,
        }
    }; // mapBox_Map_Provider ends
    return mapBox_Map_Provider;
}


//
// GET MAPBOX BASEMAP READY FOR INSERTION
//

function mapboxStyles(DOMid) {
    // This function get DOM element's IDs regarding the Mapbox map styles, and return an
    // object with the appropriate Mapbox tiles url and map options
    return {
        url: mapBox_Map_Provider.url.replace("${mapbox_style}", mapbox_style.mb_streets),
        options: mapBox_Map_Provider.options
    }
}


//
// CREATE A LEAFLET TILE LAYER
//

function createTileLayer(map_provider, options) {
    // This function accepts the URL of a map provider,
    // plus the appropriate options for the Leaflet.tileLayer object
    // and returns a Leaflet.tileLayer object that can then
    // be added to the Leaflet map

    return L.tileLayer(map_provider, options);
}


//
// REMOVE OLD BASEMAP. DRAW NEW ONE
//

function draw_basemap(url, options) {

    main_map.eachLayer((layer) => main_map.removeLayer(layer));

    createTileLayer(url, options).addTo(main_map);
    markerGroup.addTo(main_map);
}


//
// DISPLAYS/HIDES THE BASEMAP OPTIONS BUTTONS
//

function toggleVisibilityBasemapOptionBtns(htmlCollection) {
    // This function is designed to receive a HTMLCollection,
    // and toggle the 'hide' class of its elements.

    // https://stackoverflow.com/questions/3871547/js-iterating-over-result-of-getelementsbyclassname-using-array-foreach/37941811
    Array.prototype.forEach.call(
        htmlCollection,
        function (b) {
            b.classList.toggle("hide");
        });
}


//
// CHANGE CURSOR IN PREPARATION FOR THE INSERTION OF NEW MARKER
//

function prepInsertMarker() {
    // Prepare the DOM for the insertion of new marker,
    main_map_container.classList.toggle("crosshair_enabled");
}


//
// DRAWS A TEMPORARY MARKER ON 'INSERT NEW LOCATION'
//

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
        // Disable the 'Change Basemap' button
        change_basemap_btn.disabled = true;

        // Invoke the function to draw a temporary marker
        // (users will need to populate the new-marker form and click on
        // the form submit button in order to make it a permanent marker).
        // The temporary marker drawn is stored in 'tempMarker', thus being
        // accessible for its eventual cancellation.
        tempMarker = drawMarker(event.latlng.lat, event.latlng.lng);
    }
    // Return the geographical coordinates of the position clicked
    console.log(`Latitude: ${event.latlng.lat.toFixed(5)}\nLongitude: ${event.latlng.lng.toFixed(5)}\n`);
    return event.latlng;
}


//
// SUBMITS A MARKER TO THE DATABASE
// DELETES THE MARKER FROM THE FRONT-END
// GETS NEW MARKERS FROM THE BACK-END
// DRAW NEW MARKERS IN THE FRONT-END
//

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
    var point = {
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
            getMarkersFromDB("selectNewQuery", {}, featureIdList)
        })

    // Hide the form to introduce marker details
    new_marker_form.classList.replace("show", "hide");
    // Empty the form so it looks good when re-opened
    document.getElementById("marker_name_input").value = "";
    document.getElementById("marker_text_input").value = "";
    insert_marker_btn.disabled = false;
    change_basemap_btn.disabled = false;
}


// 
// CANCEL MARKER SUBMISSIONS
//

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

//
// *** END ***
//


