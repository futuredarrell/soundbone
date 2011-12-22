// TestCloud
(function(){

    var TestCloud, Tracks, Track, track;

    window.TestCloud = TestCloud = {};

    TestCloud.init = function(){
        
        console.log('init');

        Track = Backbone.Model.extend({
            initialize: function(){
              var _self = this;
              SC.get('/tracks/' + _self.id, function(data){
                // set all the attributes locally
                _self.set(data);
              });
            },
            play: function(){
                console.log('track play:', this); 
                var stream = (this.has('stream')) ? this.get('stream') : this.load();
                stream.play();
            },
            pause: function(){
                console.log('track pause:', this); 
                if(this.has('stream')) this.get('stream').togglePause();
            },
            load: function(callback){
                console.log('track load:', this); 
                var stream = SC.stream(this.id);
                this.set({'stream' : stream});
                return stream;
            }
        });

        Tracks = Backbone.Collection.extend({
            model: Track
        });

        var tracks = new Tracks();

        _.each(['4456728', '291', '5968824'], function(el, index, list){
            tracks.add(new Track({'id' : el}));
        });

        var hey = tracks.at(0);
        hey.play();
    };
})();

