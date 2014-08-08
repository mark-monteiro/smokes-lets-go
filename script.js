$(document).ready(function() {
	var finished;
	
	$('button').click(function() {
		startLoader();
		getlocation(findSmokes);
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
				callback(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
			};

			// onError Callback receives a PositionError object
			//
			function onError(error) {
				alert('Where in the fuck are you?! An error occured while determining your location:\n' +
					  'code: '    + error.code    + '\n' +
					  'message: ' + error.message + '\n');
			}

			navigator.geolocation.getCurrentPosition(onSuccess, onError);
		}
	
	function findSmokes(position) {
		var map;
		var service;
		var infoWindow;
		
		map = new google.maps.Map(document.getElementById('map'), {
			center: position,
			zoom: 15
		});

		var request = {
			location: position,
			radius: '500',
			openNow: true,
			types: ['convenience_store']
		};

		infowindow = new google.maps.InfoWindow();
		service = new google.maps.places.PlacesService(map);
		service.nearbySearch(request, callback);

		function callback(results, status) {
			if (status == google.maps.places.PlacesServiceStatus.OK) {
				$.each(results, function(index, place) {
					createMarker(place);
				});
			}
			else {
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
