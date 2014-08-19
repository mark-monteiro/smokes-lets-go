$(document).ready(function() {
	//local variables
	var initialized = false;
	var loadAnimator;
	var checkDistance = true;
	
	//google.maps API objects
	var map;
	var placesService;
	var directionsDisplay;
	var directionsService;
	var infoWindow;
	var displayBounds;
	
	//Locations and Markers
	var locationWatcher;
	var startPosition;
	var startMarker;
	var currentPosition;
	var currentMarker;
	var smokesMarkers = [];
	
	//start initialization
	initialize();
	
	//on button click, start loader and perform search
	$('button').click(function() {
		startLoader();
		findSmokes();
	});
	
	function initialize() {
		//initialize location tracking then continue other initialization
		initLocationService(finishInit);
		
		function initLocationService(callback) {
			//start watching the user's current location
			locationWatcher = navigator.geolocation.watchPosition(onSuccess, onError);
			
			offset = 0;
			function onSuccess(position) {
				position.coords.latitude += offset;
				position.coords.longitude += offset;
				offset += 0.05;
			
				console.info("Got location: (" + position.coords.latitude +"," + position.coords.longitude +")");
				var firstCall = currentPosition === undefined;
				currentPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude );

				if(firstCall && initialized === false) {
					//execute callback function on the first location update only
					callback(currentPosition);
					startPosition = currentPosition;
				}
				else if(initialized === true && currentMarker !== undefined) {
					//update marker position
					currentMarker.setPosition(currentPosition);

					//TODO: only search if user is outside the original search bounds
					if (checkDistance && calcDistance(currentPosition, startPosition) >= 5 ) {
						// user has moved 5km from start position; ask if they want to search again
						navigator.notification.confirm(
							"We have detected that you've moved away from the original smokes. Want to search again?",
							function(result) {
								if(result === 1) {
									//update the start position to be the current position
									//and perform a new search
									startPosition = currentPosition;
									startMarker.setPosition(startPosition);
									findSmokes();
								}
								else {
									//never ask again
									checkDistance = false;
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
				
				var posIntialized = currentPosition === undefined
				var errorWord = posIntialized ? "determining" : "updating";
				
				if (error.code == error.PERMISSION_DENIED) {
					alert("HORSECOCK, we can't find you smokes unless you give this app permission to use your location. Fuck sakes.");
				}
				else if (error.code == error.POSITION_UNAVAILABLE) {
					alert('WHAT in the FUCK?! (An error occured while ' + errorWord + ' your location)');
				}
				else {
					alert('Where in the fuck are you?! (An error occured while ' + errorWord + ' your location)');
				}
				
				//stop the location updater
				navigator.geolocation.clearWatch(locationWatcher);
				locationWatcher = undefined;
			}
		}
		
		function finishInit(position) {
			//create the map
			map = new google.maps.Map(document.getElementById('map-canvas'), {
				center: position,
				zoom: 10,
				panControl: false,
				rotateControl: false,
				scaleControl: false,
				streetViewControl: false,
				zoomControl: false
			});
			
			//initialize places service
			placesService = new google.maps.places.PlacesService(map);
			
			//initialize direction services
			directionsService = new google.maps.DirectionsService();
			directionsDisplay = new google.maps.DirectionsRenderer({
				markerOptions: {
					visible: false
				}
			});
			directionsDisplay.setMap(map);
			
			//create info window
			infoWindow = new google.maps.InfoWindow();
			google.maps.event.addListener(infoWindow, 'domready', function(){
				//remove close button when opened
				$(".gm-style-iw")
					.css("left", function() {
						return ($(this).parent().width() - $(this).width()) / 2;
					})
					.next("div").remove();
			});
			
			//create a marker for the start location
			startMarker = new google.maps.Marker({
				map: map,
				position: position,
				icon: 'images/youarehere-2.png',
				clickable: false,
				draggable: true,
				zIndex: 3
			});
			
			google.maps.event.addListener(startMarker, 'dragend', function(mouseEvent) {
				console.info("Moved start position to " + mouseEvent.latLng.toString());
				
				if(currentMarker !== undefined) {
					//start position moved; look up new directions
					var destination = directionsDisplay.getDirections().routes[0].overview_path.slice(-1)[0];
					calcRoute(destination);
				}
				else if(!displayBounds.contains(mouseEvent.latLng)) {
					//start location moved outside result bounds; perform new search
					findSmokes();
				}
			})
			
			//set flag
			initialized = true;
		};
	}
	
	//starts the loading animation
	function startLoader() {
		//start animating the ellipses
		var ellipses = $('#loader span.ellipses');
		var padding = $('#loader span.padding');
		loadAnimator = window.setInterval(animateLoader, 1000);
		
		//hide the button and show the loader
		$('#layout button').fadeOut(function() {
			$('#loader').fadeIn('fast');
		});
		
		//increments the number of ellipses dots in the loader
		function animateLoader() {
			var length = (ellipses.text().length + 1) % 5;
			ellipses.text(Array(length + 1).join("."));
			padding.text(Array(length + 1).join('\xA0'));	//add padding to the front of the loader to keep it centred
		}
	}
	
	//performs search
	function findSmokes() {
		//wait for initialization to complete
		if ( !initialized ) {
			setTimeout(findSmokes, 250);
			return;
		}
		
		//perform search
		var searchRadius = 250;
		var request = {
			location: startMarker.getPosition(),
			radius: searchRadius.toString(),
			/*openNow: true,*/
			types: ['convenience_store', 'gas_station']
		};
		placesService.nearbySearch(request, searchCallback);
		
		function searchCallback(results, status) {
			//if the search returned at least 3 results
			if (status == google.maps.places.PlacesServiceStatus.OK && results.length >= 3 ) {
				console.info("Found " + results.length + " places with smokes:");
				displayResults(results);
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
				placesService.nearbySearch(request, searchCallback);
			}
			else {
				console.error("Error querying the the Google Map API:\n" + status);
				alert("Sorry, something fucked up! Try again later.");
			}
		}
	}
	
	function displayResults(results) {
		//TODO: order results by distance and limit to maximum 10 results
		//TODO: detect the first results in a better way
		var firstResults = $("#result-wrapper").hasClass('hide');
		var existingLocations = smokesMarkers.map(function(marker) { return marker.getPosition(); });
		displayBounds = new google.maps.LatLngBounds(startMarker.getPosition());
		
		console.group();
		$.each(results, function(index, place) {
			var loc = place.geometry.location;
			var isNewLoc = $.grep(existingLocations, function(existing) { return existing.lat() === loc.lat() && existing.lng() === loc.lng()}).length === 0;
			
			//include this location in the display bounds
			displayBounds.extend(loc);
			console.info("  - " + place.name + " " + loc.toString());
			
			if(isNewLoc) {
				//create a marker for this location and expand the map to show it
				map.fitBounds(displayBounds);
				createMarker(place, false /*index === 0*/);
			}
		});
		console.groupEnd();
		
		//TODO: remove old markers outside a certain radius?
		
		//show the map and stop the loader
		if(firstResults) {
			$("#result-wrapper").hide().removeClass('hide').fadeIn('slow', function() {
				window.clearInterval(loadAnimator);
				//TODO: callback function here?
			});
		}
		
		//creates a marker on the map for a smokes location
		//with an associated info window and optionally opens it
		function createMarker(place, open) {
			var loc = place.geometry.location;
			var marker = new google.maps.Marker({
				map: map,
				position: loc,
				icon: 'images/smoking-icon.png',
				animation: google.maps.Animation.DROP,
				zIndex:2
			});
			smokesMarkers.push(marker);
			
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
					calcRoute(place.geometry.location);
					infoWindow.close();
				});
				
				//set the window content and open it
				infoWindow.setContent(content[0]);
				infoWindow.open(map, marker);
			}
		}
	}
	
	//gets the route to the specified location and displays it on the map
	function calcRoute(destination) {
		var request = {
			origin:startMarker.getPosition(),
			destination:destination,
			travelMode: google.maps.TravelMode.DRIVING
		};
		console.info("Calculating directions from " + request.origin + " to " + request.destination);
		
		directionsService.route(request, function(result, status) {
			if (status === google.maps.DirectionsStatus.OK) {
				//create marker for the updating current location
				if(currentMarker == undefined) {
					currentMarker = new google.maps.Marker({
						map: map,
						position: currentPosition,
						optimized: false,
						icon: {
							anchor: new google.maps.Point(10, 10),
							url: 'images/marker-current-location.gif'
						},
						zIndex: 1
					});
					console.info("Created current position marker at" + currentPosition.toString());
				}
				
				//change the icon for start position
				startMarker.setIcon('images/start.png');
				
				//display the route on the map
				directionsDisplay.setDirections(result);
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
	}
	
	//utility function to calculate the distance (in km)
	//between two instances of google.maps.LatLng objects
	function calcDistance(pos1, pos2) {
		var EARTH_RADIUS = 6371 ;
		var distanceEw = (pos1.lng() - pos2.lng()) * Math.cos(startPosition.lat()) ;
		var dcistanceNs = (pos1.lat() - pos2.lat()) ;
		return Math.sqrt(distanceEw * distanceEw + dcistanceNs * dcistanceNs) * EARTH_RADIUS ;
	}
});