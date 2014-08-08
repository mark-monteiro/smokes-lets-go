$(document).ready(function() {
	var finished;
	
	$('button').click(function() {
		startLoader();
		getLocation(findSmokes);
	});
	
	function startLoader() {
		//start animating the ellipses
		var ellipses = $('#loader span.ellipses');
		var padding = $('#loader span.padding');
		finished = window.setInterval(animateLoader, 1000);
		
		//hide the button and show the loader
		$('button').fadeOut(function() {
			$('#loader').fadeIn('fast');
		});
		
		//increments the number of ellipses dots in the loader
		function animateLoader() {
			var length = (ellipses.text().length + 1) % 5;
			ellipses.text(Array(length + 1).join("."));
			padding.text(Array(length + 1).join('\xA0'));	//add padding to the front of the loader to keep it centered
		}
	}
	
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
				alert('Where in the fuck are you?! (An error occured while determining your location)');
			}

			navigator.geolocation.getCurrentPosition(onSuccess, onError);
		}
	
	function findSmokes(position) {
		var map;
		var service;
		var infoWindow;
		
		map = new google.maps.Map(document.getElementById('map-canvas'), {
			center: position,
			zoom: 15
		});

		var request = {
			location: position,
			radius: '250',
			openNow: true,
			types: ['convenience_store']
		};

		infowindow = new google.maps.InfoWindow();
		service = new google.maps.places.PlacesService(map);
		service.nearbySearch(request, searchCallback);

		function searchCallback(results, status) {
			if (status == google.maps.places.PlacesServiceStatus.OK) {
				console.log("Found " + results.length + " places with smokes");
				
				//create a marker for each location and expand the map to show all points
				var bounds = new google.maps.LatLngBounds(position, position);
				$.each(results, function(index, place) {
					createMarker(place);
					bounds.extend(place.geometry.location);
				});
				map.fitBounds(bounds);
				
				$("#map-canvas").hide().removeClass('hide').fadeIn();
			}
			else if(status == google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
				//expand search radius and try again
				var newRadius = parseInt(request.radius) * 2;
				
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
		
		function createMarker(place) {
			var placeLoc = place.geometry.location;
			var marker = new google.maps.Marker({
				map: map,
				position: place.geometry.location
			});

			google.maps.event.addListener(marker, 'click', function() {
				infowindow.setContent(place.name);
				infowindow.open(map, this);
			});
		}

	}
});
