/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var app = {
    //local variables
    initialized: false,
    loadAnimator: null,
    checkDistance: true,
    
    //google.maps API objects
    map: null,
    placesService: null,
    directionsDisplay: null,
    directionsService: null,
    infoWindow: null,
    displayBounds: null,
    
    //Locations and Markers
    locationWatcher: null,
    startPosition: null,
    startMarker: null,
    currentPosition: null,
    currentMarker: null,
    smokesMarkers: [],

    // Application Constructor
    initialize: function() {
        console.log('app initializing');
        this.bindEvents();
    },

    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },

    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        console.log('deviceready event fired');
        app.startup();
    },
    
    startup: function() {
        //start initialization
        this.initMap();

        //on button click, start loader and perform search
        $('button').click(function() {
            app.startLoader();
            app.findSmokes();
        });
    },

    initMap: function() {
        //initialize location tracking then continue other initialization
        console.debug("Starting initialization...");
        initLocationService(finishInit);
        
        function initLocationService(callback) {
            //start watching the user's current location
            app.locationWatcher = navigator.geolocation.watchPosition(onSuccess, onError);
            
            offset = 0;
            function onSuccess(position) {
                position.coords.latitude += offset;
                position.coords.longitude += offset;
                offset += 0.05;
            
                console.info("Got location: (" + position.coords.latitude +"," + position.coords.longitude +")");
                var firstCall = app.currentPosition === null;
                app.currentPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude );

                if(firstCall && app.initialized === false) {
                    //execute callback function on the first location update only
                    callback(app.currentPosition);
                    app.startPosition = app.currentPosition;
                }
                else if(app.initialized === true && app.currentMarker !== null) {
                    //update marker position
                    app.currentMarker.setPosition(app.currentPosition);

                    //TODO: only search if user is outside the original search bounds
                    if (app.checkDistance && app.calcDistance(app.currentPosition, app.startPosition) >= 5 ) {
                        // user has moved 5km from start position; ask if they want to search again
                        navigator.notification.confirm(
                            "We have detected that you've moved away from the original smokes. Want to search again?",
                            function(result) {
                                if(result === 1) {
                                    //update the start position to be the current position
                                    //and perform a new search
                                    app.startPosition = app.currentPosition;
                                    app.startMarker.setPosition(app.startPosition);
                                    app.findSmokes();
                                }
                                else {
                                    //never ask again
                                    app.checkDistance = false;
                                }
                            },
                            "Confirm",
                            "Fuck Yeah!,Fuck No!");
                    }
                }
            };

            function onError(error) {
                console.error("Error determining location:\n" + 
                    'code: '    + error.code    + '\n' +
                    'message: ' + error.message + '\n');
                
                var posIntialized = app.currentPosition === null;
                var errorWord = posIntialized ? "determining" : "updating";
                
                if (error.code == error.PERMISSION_DENIED) {
                    alert("HORSECOCK, we can't find you smokes unless you give this app permission to use your location. Fuck sakes.");
                }
                else if (error.code == error.POSITION_UNAVAILABLE) {
                    alert('WHAT in the FUCK?! (An error occurred while ' + errorWord + ' your location)');
                }
                else {
                    alert('Where in the fuck are you?! (An error occurred while ' + errorWord + ' your location)');
                }
                
                //stop the location updater
                navigator.geolocation.clearWatch(app.locationWatcher);
                app.locationWatcher = null;
            }
        };
        
        function finishInit(position) {
            //create the map
            app.map = new google.maps.Map(document.getElementById('map-canvas'), {
                center: position,
                zoom: 10,
                panControl: false,
                rotateControl: false,
                scaleControl: false,
                streetViewControl: false,
                zoomControl: false
            });
            
            //initialize places service
            app.placesService = new google.maps.places.PlacesService(app.map);
            
            //initialize direction services
            app.directionsService = new google.maps.DirectionsService();
            app.directionsDisplay = new google.maps.DirectionsRenderer({
                markerOptions: {
                    visible: false
                }
            });
            app.directionsDisplay.setMap(app.map);
            
            //create info window
            app.infoWindow = new google.maps.InfoWindow();
            
            //create a marker for the start location
            app.startMarker = new google.maps.Marker({
                map: app.map,
                position: position,
                icon: 'img/youarehere-2.png',
                clickable: false,
                draggable: true,
                zIndex: 3
            });
            
            google.maps.event.addListener(app.startMarker, 'dragend', function(mouseEvent) {
                console.info("Moved start position to " + mouseEvent.latLng.toString());
                
                if(app.currentMarker !== null) {
                    //start position moved; look up new directions
                    var destination = app.directionsDisplay.getDirections().routes[0].overview_path.slice(-1)[0];
                    app.calcRoute(destination);
                }
                else if(!app.displayBounds.contains(mouseEvent.latLng)) {
                    //start location moved outside result bounds; perform new search
                    app.findSmokes();
                }
            })
            
            //set flag
            app.initialized = true;
            console.debug("Finished initialization.");
        };
    },

    //starts the loading animation
    startLoader: function() {
        //start animating the ellipses
        var ellipses = $('#loader span.ellipses');
        var padding = $('#loader span.padding');
        app.loadAnimator = window.setInterval(animateLoader, 1000);
        
        //hide the button and show the loader
        $('#layout button').fadeOut(function() {
            $('#loader').fadeIn('fast');
        });
        
        //increments the number of ellipses dots in the loader
        function animateLoader() {
            var length = (ellipses.text().length + 1) % 5;
            ellipses.text(Array(length + 1).join("."));
            padding.text(Array(length + 1).join('\xA0'));    //add padding to the front of the loader to keep it centred
        }
    },

    //performs search
    findSmokes: function() {
        //wait for initialization to complete
        if ( !app.initialized ) {
            setTimeout(app.findSmokes, 250);
            return;
        }
        
        //perform search
        var searchRadius = 250;
        var request = {
            location: app.startMarker.getPosition(),
            radius: searchRadius.toString(),
            types: ['convenience_store', 'gas_station']
        };
        app.placesService.nearbySearch(request, searchCallback);
        
        function searchCallback(results, status) {
            //if the search returned at least 3 results
            if (status == google.maps.places.PlacesServiceStatus.OK && results.length >= 3 ) {
                console.info("Found " + results.length + " places with smokes:");
                app.displayResults(results);
            }
            //if search returned less than three results
            else if(status == google.maps.places.PlacesServiceStatus.ZERO_RESULTS || results.length < 3) {
                //don't search farther than 32km
                if(searchRadius > 32000) {
                    console.info("No smokes within 32000m of current location");
                    alert("This is fucked! There's nowhere to get smokes anywhere near you!");
                    return;
                }
                
                //double the search radius and try again
                searchRadius *= 2;
                request.radius = searchRadius.toString();
                console.log("Expanding search radius to " + request.radius + " meters");
                app.placesService.nearbySearch(request, searchCallback);
            }
            else {
                console.error("Error querying the the Google Map API:\n" + status);
                alert("Sorry, something fucked up! Try again later.");
            }
        }
    },

    displayResults: function(results) {
        //TODO: order results by distance and limit to maximum 10 results
        //TODO: detect the first results in a better way
        var firstResults = $("#result-wrapper").hasClass('off-screen');
        var existingLocations = app.smokesMarkers.map(function(marker) { return marker.getPosition(); });
        app.displayBounds = new google.maps.LatLngBounds(app.startMarker.getPosition());
        
        console.group();
        $.each(results, function(index, place) {
            var loc = place.geometry.location;
            var isNewLoc = $.grep(existingLocations, function(existing) { return existing.lat() === loc.lat() && existing.lng() === loc.lng()}).length === 0;
            
            //include this location in the display bounds
            app.displayBounds.extend(loc);
            console.info("  - " + place.name + " " + loc.toString());
            
            if(isNewLoc) {
                //create a marker for this location and expand the map to show it
                app.map.fitBounds(app.displayBounds);
                createMarker(place, false /*index === 0*/);
            }
        });
        console.groupEnd();
        
        //TODO: remove old markers outside a certain radius?
        
        //show the map and stop the loader
        if(firstResults) {
            $("#result-wrapper").hide().removeClass('off-screen').fadeIn('slow', function() {
                window.clearInterval(app.loadAnimator);
                //TODO: callback function here?
            });
        }
        
        //creates a marker on the map for a smokes location
        //with an associated info window and optionally opens it
        function createMarker(place, open) {
            var loc = place.geometry.location;
            var marker = new google.maps.Marker({
                map: app.map,
                position: loc,
                icon: 'img/smoking-icon.png',
                animation: google.maps.Animation.DROP,
                zIndex:2
            });
            app.smokesMarkers.push(marker);
            
            if(open === true) {
                setInfoWindow(place, marker);
            }
            
            //create new window on marker click
            google.maps.event.addListener(marker, 'click', function() {
                setInfoWindow(place, this);
            });
            
            //set the content for the info window with the associated place and open it
            function setInfoWindow(place, marker) {
                //clone a new element for window content and set the place name
                var content = $("#place-info").clone().removeAttr('id');
                content.find('.name').text(place.name);
                
                //set address if available
                if(typeof place.formatted_address === 'undefined') {
                    content.find('.address').remove();
                }
                else {
                    content.find('.address').text(place.formatted_address);
                }
                
                //set phone number if available
                if(typeof place.formatted_phone_number === 'undefined') {
                    content.find('.phone').remove();
                }
                else {
                    content.find('.phone').prop('href', 'tel:' + place.formatted_phone_number).text(place.formatted_phone_number);
                }
                
                //set directions button action
                content.find('button').click(function() {
                    app.calcRoute(place.geometry.location);
                    app.infoWindow.close();
                });
                
                //set the window content and open it
                app.infoWindow.setContent(content[0]);
                app.infoWindow.open(app.map, marker);
            }
        }
    },

    //gets the route to the specified location and displays it on the map
    calcRoute: function(destination) {
        var request = {
            origin: app.startMarker.getPosition(),
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING
        };
        console.info("Calculating directions from " + request.origin + " to " + request.destination);
        
        app.directionsService.route(request, function(result, status) {
            if (status === google.maps.DirectionsStatus.OK) {
                //create marker for the updating current location
                if(app.currentMarker == null) {
                    app.currentMarker = new google.maps.Marker({
                        map: app.map,
                        position: app.currentPosition,
                        optimized: false,
                        icon: {
                            anchor: new google.maps.Point(10, 10),
                            url: 'img/marker-current-location.gif'
                        },
                        zIndex: 1
                    });
                    console.info("Created current position marker at" + app.currentPosition.toString());
                }
                
                //change the icon for start position
                app.startMarker.setIcon('img/start.png');
                
                //display the route on the map
                app.directionsDisplay.setDirections(result);
                console.info("Successfully displayed route");
            }
            else if(status === google.maps.DirectionsStatus.ZERO_RESULTS) {
                console.error("Error: No direction results found");
                alert("Frozen mixed vegetable cocks!! Google couldn't figure out how to get there!");
            }
            else {
                console.error("Error determining route: " + status);
                alert("Fuck off with the errors! Sorry, something fucked up while finding directions. Try again later.");
            }
        });
    },

    //utility function to calculate the distance (in km)
    //between two instances of google.maps.LatLng objects
    calcDistance: function(pos1, pos2) {
        var EARTH_RADIUS = 6371 ;
        var distanceEw = (pos1.lng() - pos2.lng()) * Math.cos(app.startPosition.lat()) ;
        var dcistanceNs = (pos1.lat() - pos2.lat()) ;
        return Math.sqrt(distanceEw * distanceEw + dcistanceNs * dcistanceNs) * EARTH_RADIUS ;
    }
};

$(document).ready(function() { app.startup(); });
