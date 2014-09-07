$(document).ready(function() {
    window.DEBUG = false;

    //override native alert function to use Phone Gap notification instead
    //call navigator.notification.alert directly to use other parameters (callback, title, buttonName)
    window.alert = function(message) {
        navigator.notification.alert(message, null, "Error");
    };
    
    //override native console functions to support all devices
    //and so we can easily turn them  on/off
    (function() {
        var method;
        var noop = function () {};
        var methods = [
          'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
          'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
          'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
          'timeStamp', 'trace', 'warn'
        ];
        var length = methods.length;
        var console = (window.console = window.console || {});
     
        while (length--) {
          method = methods[length];
     
          // stub all methods when in release mode
          // or stub only undefined methods.
          if (!window.DEBUG || !console[method]) {
            console[method] = noop;
          }
        }
    }());
});