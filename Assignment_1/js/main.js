// Wait until all DOM elements are ready, so that their
// invocation does not fail.
document.addEventListener("DOMContentLoaded", ready);

var startValue; // Start number for the count up/down
var endValue; // End number for the count up/down
var runItBtn; // Button to execute the counter
var clearBtn; // Button the clear the form and the results
var increment; // Number added/substracted to the start number
var warningPanel; // DOM element that displays a warning message
var numContainer; // DOM element that will group together all the result numbers
var allNavbarLinks; // Anchor elements in the navigation bar
var allNavbarTargets; // Targets of the anchor elements in the navigation bar
var pageFooter; // HTML footer
var counterResult; // Array of digits, result of the calculation.


function ready() {

    numContainer = document.getElementById("numContainer");
    allNavbarLinks = document.getElementsByClassName("page_link");
    allNavbarTargets = document.getElementsByClassName("page");
    pageFooter = document.getElementsByTagName("footer")[0];
    warningPanel = document.getElementById("wrong_input_panel");
    runItBtn = document.getElementById("counterSubmitId");
    clearBtn = document.getElementById("counterClearId");

    // Event listener for the window scroll event.
    // The 'scrollControl' function hides/show the 'To to Top' button.
    window.addEventListener("scroll", scrollControl);

    // Execute main 'countUpDown' function upon clicking on the corresponding button
    runItBtn.addEventListener("click", countUpDown);
    // Upon clicking on the corresponding button, clean the form of previously entered values,
    // as well as the DOM from previous results.
    clearBtn.addEventListener("click", clearForm);

    // Function that will handle the displaying of the appropriate page
    // when a page-link in the navbar is clicked.
    for (elem of allNavbarLinks) {
        elem.addEventListener("click", (event) => {
            managePage(event);
        });
    }
} // 'ready' function ends.


function countUpDown() {
    // Check if we already have rows with number and,
    // if we do, remove them:
    cleanNumContainer();
    
    // Empty the array containing previous results, if any
    counterResult = [];

    startValue = parseFloat(document.getElementById("startValueId").value);
    endValue = parseFloat(document.getElementById("endValueId").value);
    increment = parseFloat(document.getElementById("incrementValueId").value);

    // Validate the input values. If they are wrong, display a warning.
    // The validation is done by invoking the 'validateInput' function.
    if (!validateInput()) {
        // the validateFunction has determined that the
        // input values are not correct. Let's display an error message
        manageModal(warningPanel);
    } else { // Input values appear correct
        // if sequence is in descending order:
        if (startValue < endValue) {
            for (var c = startValue; c <= endValue; c += increment) {
                counterResult.push(Math.round(c * 100) / 100)
            }
        } // startValue < endValue ends
        else if (startValue > endValue) {
            for (var c = startValue; c >= endValue; c += increment) {
                counterResult.push(Math.round(c * 100) / 100)
            }
        } // startValue > endValue ends 
        // Numbers are now stored in the 'counterResult' array
        // Now they will be added to the DOM
        for (r of counterResult) {
            var numbElem = document.createElement("p");
            var numbValue = document.createTextNode(r);
            numbElem.appendChild(numbValue);
            numbElem.className = "numberRow";
            numContainer.appendChild(numbElem);
        }
    } // Input values are correct ends
} //countUpDown function ends


function managePage(event) {
    // This function manages the displaying/hiding of the
    // corresponding pages when page links are clicked on the navbar.

    // The clicked navbar element's ID is obtained, and the page
    // with the corresponding class is displayed.
    var targetArticle = document.getElementsByClassName(event.target.id)[0];
    // Hide all articles (except the target)
    for (article of allNavbarTargets) {
        if (article.classList.contains("show") &&
            article !== targetArticle) {
            article.classList.replace("show", "hide");
        }
    }
    // Display the appropriate page
    if (targetArticle.classList.contains("hide")) {
        targetArticle.classList.replace("hide", "show");
    }
    // If the target page needs a dynamic footer, handle it.
    if (targetArticle.classList.contains("dynamic_footer")) {
        assignDynamicClass(pageFooter);
    } else if (targetArticle.classList.contains("static_footer")) {
        assignStaticClass(pageFooter);
    }
}


function assignDynamicClass(domElement) {
    // This function is passed a DOM element, from which
    // the 'static' class, if found, is replaced with
    // the 'dynamic' class.
    if (domElement.classList.contains("static")) {
        domElement.classList.replace("static", "dynamic");
    }
}

function assignStaticClass(domElement) {
    // This function is passed a DOM element, from which
    // the 'dynamic' class, if found, is replaced with
    // the 'static' class.
    if (domElement.classList.contains("dynamic")) {
        domElement.classList.replace("dynamic", "static");
    }
}


function validateInput() {
    // This function checks that the values entered in 
    // the input boxes make mathematical sense.
    // Input must be either:
    // startValue < endValue and increment > 0 OR
    // startValue > endValue and increment < 0
    // All other inputs will return FALSE
    return ((startValue < endValue && increment > 0) ||
        startValue > endValue && increment < 0) ? true : false;
}


function clearForm() {
    // Check if we already have rows with number and,
    // if we do, remove them:
    cleanNumContainer();
    // Null the input boxes
    document.getElementById("startValueId").value = null;
    document.getElementById("endValueId").value = null;
    document.getElementById("incrementValueId").value = null;
}

function cleanNumContainer() {
    // if the countUp function has run at least once, the
    // DOM element 'numContainer' will have child nodes over
    // which we can iterate and remove.

    // Getting the number of children BEFORE we start to remove them.
    var numChildren = numContainer.childNodes.length
    for (var i = 0; i < numChildren; i++) {
        numContainer.removeChild(numContainer.childNodes[0]);
    }
}


function manageModal(modalDomElem) {
    event.stopPropagation();
    // This function is passed the modal DOM element, and
    // will handle its opening and closing.

    // Display the modal window
    modalDomElem.classList.replace("hide", "show");

    // Add an event listener to hide the modal window if the document
    // is clicked outside the modal window itself.
    document.addEventListener("click", function () {
        if (!event.target.parentNode.parentNode.classList.contains("w3-modal-content") &&
            !event.target.parentNode.classList.contains("w3-modal-content")) {
            modalDomElem.classList.replace("show", "hide");
        }
    }) // eventListener ends
    return false;
} // manageModal function ends


function scrollControl() {
    // This function is invoked every time the page is scrolled up or down.
    // It shows or hides the 'Go to Top' button depending on the distance to
    // the top of the page.
    var goTopBtn = document.getElementsByClassName("go_top-jm")[0];
    if (document.documentElement.scrollTop > 20) {
        goTopBtn.classList.replace("hide", "show");
    } else {
        goTopBtn.classList.replace("show", "hide");
    }
}
