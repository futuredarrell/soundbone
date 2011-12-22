// TestCloud
(function(){

    var TestCloud, Tracks, Track, tracks, track;

    var templates = {};
    templates.TracksView = _.template('<p><%= title %></p>');
    templates.TrackView = _.template('<p></p>');

    window.TestCloud = TestCloud = {};

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
    tracks = new Tracks();

    TracksView = Backbone.View.extend({
        render: function(){
            console.log(this.model.attributes);
            //change this
            $(this.el).append(this.template(this.model.attributes));
            return this;    
        },
        className: '',
        events: {
            
        },
        template: templates.TracksView,
        el: '#tracksView',
    });

    TrackView = Backbone.View.extend({
    
    });

    TestCloud.init = function(){
        
        console.log('init');

        tracks = new Tracks();

        //this current method of loading doesnt ensure order
        _.each(['4456728', '291', '5968824'], function(value){
            var t, v;
            t = new Track({'id': value});
            tracks.add(t);
            //wrong view right now
            v = new TracksView({model: t});
            t.bind('change', function(){
                v.render();
            })
        });
    };
})();

