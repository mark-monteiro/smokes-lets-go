$(document).ready(function() {
	var finished;
	
	$('button').click(function() {
		startLoader();
		getLocation(findSmokes);
	});
	
	//start the loading animation
	function startLoader() {
		//start animating the ellipses
		var ellipses = $('#loader span.ellipses');
		var padding = $('#loader span.padding');
		finished = window.setInterval(animateLoader, 1000);
		
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
	
	//get the initial location
	function getLocation(callback) {
		// onSuccess Callback
		//   This method accepts a `Position` object, which contains
		//   the current GPS coordinates
		//
		var onSuccess = function(position) {
			console.log("Got location: (" + position.coords.latitude + "," + position.coords.longitude + ")");
			callback(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
		};

		// onError Callback receives a PositionError object
		//
		function onError(error) {
			console.log("Error determining location:\n" + 
				'code: '    + error.code    + '\n' +
				'message: ' + error.message + '\n');
				
			if (error.code == error.PERMISSION_DENIED) {
				alert("Hey there stupidyhead, we can't find you smokes unless you give this app permission to use your location. Fuck sakes.");
			}
			else if (error.code == error.POSITION_UNAVAILABLE) {
				//TODO: provide search to select location
				alert('Where in the fuck are you?! (An error occured while determining your location)');
			}
			else {
				alert('Where in the fuck are you?! (An error occured while determining your location)');
			}
		}

		navigator.geolocation.getCurrentPosition(onSuccess, onError);
	}
	
	function findSmokes(position) {
		var map;
		var service;
		var directionsDisplay;
		var directionsService;
		var infoWindow;
		
		map = new google.maps.Map(document.getElementById('map-canvas'), {
			center: position,
			zoom: 10,
			panControl: false,
			rotateControl: false,
			scaleControl: false,
			streetViewControl: false,
			zoomControl: false,
		});

		//create info window
		infowindow = new google.maps.InfoWindow();
		google.maps.event.addListener(infowindow, 'domready', function(){
			//remove close button when opened
			$(".gm-style-iw")
				.css("left", function() {
					return ($(this).parent().width() - $(this).width()) / 2;
				})
				.next("div").remove();
		});
		
		//initialize places service and perform search
		var request = {
			location: position,
			radius: '250',
			/*openNow: true,*/
			types: ['convenience_store']
		};
		service = new google.maps.places.PlacesService(map);
		service.nearbySearch(request, searchCallback);

		//initialize direction services
		directionsService = new google.maps.DirectionsService();
		directionsDisplay = new google.maps.DirectionsRenderer({
			markerOptions: {
				visible: false
			}
		});
		directionsDisplay.setMap(map);
		
		//search callback function
		function searchCallback(results, status) {
			if (status == google.maps.places.PlacesServiceStatus.OK) {
				console.log("Found " + results.length + " places with smokes");
				
				//create a marker for the current location
				var currLoc = new google.maps.Marker({
					map: map,
					position: position,
					icon: 'images/youarehere-2.png',
					clickable: false
				});
				
				//create a marker for each location and expand the map to show all points
				var bounds = new google.maps.LatLngBounds(position, position);
				$.each(results, function(index, place) {
					createMarker(place, false /*index === 0*/);
					bounds.extend(place.geometry.location);
				});
				map.fitBounds(bounds);
				
				$("#result-wrapper").hide().removeClass('hide').fadeIn('slow');
			}
			else if(status == google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
				//expand search radius and try again
				var newRadius = parseInt(request.radius) * 2;
				
				//don't search farther than 32km
				if(newRadius > 32000) {
					alert("This is fucked! There's nowhere to get smokes anywhere near you!");
					return;
				}
				
				console.log("Expanding search radius to " + newRadius + " meters");
				request.radius = newRadius.toString();
				service.nearbySearch(request, searchCallback);
			}
			else {
				console.log("Error querying the the Google Map API:\n" + status);
				alert("Sorry, something fucked up! Try again later.");
			}
		}
		
		//creates a marker on the map for a smokes location
		//with an associated info window and optionally opens it
		function createMarker(place, open) {
			var placeLoc = place.geometry.location;
			var marker = new google.maps.Marker({
				map: map,
				position: place.geometry.location,
				icon: 'images/smoking-icon.png'
			});
			
			if(open === true) {
				setInfoWindow(place, marker);
			}
			
			//create new window on marker click
			google.maps.event.addListener(marker, 'click', function() {
				setInfoWindow(place, this);
			});
		}
		
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
			
			//set directions link
			content.find('button').click(function() {
				calcRoute(place.geometry.location);
				infowindow.close();
			});
			
			//set the window content and open it
			infowindow.setContent(content[0]);
			infowindow.open(map, marker);
		}
	
		//gets the route to the specified location and displays it on the map
		function calcRoute(destination) {
			var request = {
				origin:position,
				destination:destination,
				travelMode: google.maps.TravelMode.DRIVING
			};
			
			directionsService.route(request, function(result, status) {
				if (status == google.maps.DirectionsStatus.OK) {
				  directionsDisplay.setDirections(result);
				}
				else {
					//TODO: handle (https://developers.google.com/maps/documentation/javascript/reference#DirectionsStatus)
				}
			});
		}
		
		function positionUpdated(position) {
			
		}
	}
});