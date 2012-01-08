//http://docs.jquery.com/QUnit
SC.initialize({
		client_id: "ee8e164717cb8a3495919a9ee68e91fc"
});
$(document).ready(function(){

	test("SoundCloud Object", function() {
		ok(window.SC, "window.SC");
	});

	asyncTest("soundbone init", function(){
	    SC.whenStreamingReady(function(){
	      soundbone.init();
	      var app = soundbone.app;
	      ok(app, 'soundbone.app');
	      ok(app.router, 'soundbone router');
	      ok(app.router, 'soundbone router');
	      ok(app.transitionTo, 'soundbone transitions');
	      ok(app.currentScreen, 'soundbone current screen');
	      ok(app.createScreen, 'soundbone create screen');
	      
	      //has our tracks [5968824, 4456728, 291]
	      equal(app.tracks.length, 3, 'has our three tracks');
	      equal(app.tracks.models.length, 3, 'tracks are stored as models in the collection');
	      equal(app.tracks.models[0].get('id'), 5968824, 'first track in our array has id 5968824');

	      ok(app.tracks.select, 'tracks has select method');

	      start();
	    });
	});

});
