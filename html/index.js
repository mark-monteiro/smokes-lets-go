$(document).ready(function() {
	var loadAnimator;
	var initialized = false;
	var currentPosition;
	var map;
	var service;
	var directionsDisplay;
	var directionsService;
	var locationWatcher;
	var locationMarker;
	var startMarker;
	var infoWindow;
	var startPosition;
	
	
	//start initializing right away
	initialize();
	
	//on button click, start loader and perform search
	$('button').click(function() {
		startLoader();
		findSmokes();
	});
	
	//initialize the page
	function initialize() {
		function initLocation(callback) {
			
			var onSuccess = function(position) {
				
				var firstCall = currentPosition === undefined;
				
				console.log("Got location: (" + position.coords.latitude +"," + position.coords.longitude +")");
				currentPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude );
				

				//execute callback function on the first location update only
				if(firstCall && initialized === false) {
					callback(currentPosition);
					startPosition = currentPosition;
					
				}
				else if(initialized === true) {
					//update marker position
					locationMarker.setPosition(currentPosition) ;

					
					// declares East west distance, North south distance and earth's radius
					var distanceEw ;
					var dcistanceNs ;
					var distanceInit ;
					var ER = 6371 ;
					
					distanceEw = (currentPosition.lng() - startPosition.lng()) * Math.cos(startPosition.lat()) ;
					dcistanceNs = (currentPosition.lat() - startPosition.lat()) ;
					distanceInit = Math.sqrt(distanceEw * distanceEw + dcistanceNs * dcistanceNs) * ER ;
					// check if location is greater than 5 km and re-search
					if (distanceInit >= 5 ) {
						findSmokes() ;
					}
				}
			};

			function onError(error) {
				console.log("Error determining location:\n" + 
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

			//start watching the user's current location
			locationWatcher = navigator.geolocation.watchPosition(onSuccess, onError);
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
				zoomControl: false,
			});
			
			//initialize places service
			service = new google.maps.places.PlacesService(map);
			
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
			
			//create a marker for the current location
			locationMarker = new google.maps.Marker({
				map: map,
				position: position,
				icon: 'images/youarehere-2.png',
				clickable: false,
				optimized: false
			});
			
			//set flag
			initialized = true;
		};
		
		//initialize location tracking then continue other initialization
		initLocation(finishInit);
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
			padding.text(Array(length + 1).join('\xA0'));	//add padding to the front of the loader to keep it centered
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
			location: currentPosition,
			radius: searchRadius.toString(),
			/*openNow: true,*/
			types: ['convenience_store', 'gas_station']
		};
		service.nearbySearch(request, searchCallback);
		
		function searchCallback(results, status) {
			//if the search returned at least 3 results
			if (status == google.maps.places.PlacesServiceStatus.OK && results.length >= 3 ) {
				console.log("Found " + results.length + " places with smokes:");
				displayResults(results);
			}
			//if search returned less than three results
			else if(status == google.maps.places.PlacesServiceStatus.ZERO_RESULTS || results.length < 3) {
				//don't search farther than 32km
				if(searchRadius > 32000) {
					console.log("No smokes within 32000m of current location");
					alert("This is fucked! There's nowhere to get smokes anywhere near you!");
					return;
				}
				
				//double the search radius and try again
				searchRadius *= 2;
				request.radius = searchRadius.toString();
				console.log("Expanding search radius to " + request.radius + " meters");
				service.nearbySearch(request, searchCallback);
			}
			else {
				console.log("Error querying the the Google Map API:\n" + status);
				alert("Sorry, something fucked up! Try again later.");
			}
		}
	}
	
	function displayResults(results) {
		//TODO: order results by distance and limit to maximum 10 results
		var bounds = new google.maps.LatLngBounds(currentPosition, currentPosition);
		
		$.each(results, function(index, place) {
			//create a marker for this location and expand the map to show it
			var loc = place.geometry.location;
			console.log("  - " + place.name + " (" + loc.lat() + "," + loc.lng() + ")");
			bounds.extend(loc);
			map.fitBounds(bounds);
			createMarker(place, false /*index === 0*/);
		});
		
		//show the map and stop the loader
		$("#result-wrapper").hide().removeClass('hide').fadeIn('slow', function() {
			window.clearInterval(loadAnimator);
			//TODO: callback function here?
		});
		
		//creates a marker on the map for a smokes location
		//with an associated info window and optionally opens it
		function createMarker(place, open) {
			var loc = place.geometry.location;
			var marker = new google.maps.Marker({
				map: map,
				position: loc,
				icon: 'images/smoking-icon.png',
				animation: google.maps.Animation.DROP
			});
			
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
				//TODO: move to init (make calcroute get location from the infoWindow)
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
			origin:currentPosition,
			destination:infoWindow.getAnchor().position,
			travelMode: google.maps.TravelMode.DRIVING
		};
		
		directionsService.route(request, function(result, status) {
			if (status == google.maps.DirectionsStatus.OK) {
				//close the old start marker, if any
				if(startMarker !== undefined) {
					startMarker.setMap(null);
				}
				
				//create a new marker for the start location
				startMarker = new google.maps.Marker({
					map: map,
					position: request.origin,
					icon: 'images/start.png'
				});
				
				//change the icon for current position
				locationMarker.setIcon({
					anchor: new google.maps.Point(10, 10),
					url: 'images/marker-current-location.gif'
				});
				
				//display the route on the map
				directionsDisplay.setDirections(result);
			}
			else {
				//TODO: handle this (see: https://developers.google.com/maps/documentation/javascript/reference#DirectionsStatus)
			}
		});
	}
});