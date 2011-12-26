// TestCloud
(function(){

    var TestCloud, Tracks, Track, Controls, TracksView, TrackView, Scrubber;

    window.TestCloud = TestCloud = {};

    var App = Backbone.View.extend({
        initialize: function(){

            var tracks = this.tracks = new Tracks();
            this.controls = new Controls({collection: tracks});
            this.scrubber = new Scrubber({collection: tracks});
            
            var list = ['5968824','4456728','291'];

            _.each(list, function(value, index){
                tracks.add(new Track({'id': value}));
                if(index == list.length - 1){
                  tracks.select(0);
                };
            });
        }, 
    });

    Track = Backbone.Model.extend({
        localStorage: new Store('tracks'),
        initialize: function(){
            // set a load limit first ???
            if(this.localStorage.find(this)){
                this.set(this.localStorage.find(this));
                new TrackView({model: this});
            } else {
                var self = this;
                SC.get('/tracks/' + self.id, function(data){
                    // set all the attributes locally
                    self.set(data);
                    self.save();
                    new TrackView({model: data});
                });
            }
            this.set({'selected' : false});
        },
        play: function(){
            //console.log('track play:', this);
            var stream = this.load();
            stream.play();
            this.set({'selected' : true});
        },
        pause: function(){
            //console.log('track pause:', this);
            this.stream.togglePause();
        },
        load: function(){
            var self = this;
            if(this.stream && this.stream.playState === 1){
                return this.stream;
            } else {
                return this.stream = SC.stream(this.id, {
                    onplay: function(){
                      self.trigger('play');
                      self.timer = setInterval(_.bind(self.updateTime, self), 500);  
                    },
                    onfinish: function(){
                        self.collection.select('next');
                        self.trigger('finish');
                        clearInterval(self.timer);
                        self.destruct();
                        console.log('destroying track');
                    },
                    onpause: function(){
                        self.trigger('pause');
                        clearInterval(self.timer);
                    },
                    onresume: function(){
                        self.trigger('resume');
                        self.timer = setInterval(_.bind(self.updateTime, self), 500);
                    }
                });   
            }
        },
        updateTime: function(){
            this.trigger('time');
        },
        destruct: function(){
            this.stream.destruct();
            this.set({'selected': false});
        }
    });

    Tracks = Backbone.Collection.extend({
        model: Track,
        initialize: function(){ 
            this.index = 0;
        },
        play: function(){
            this.currentTrack().play();
        },
        select: function(obj){
            var newIndex = 0;
            switch(obj){
                case 'previous':
                    newIndex = (this.index > 0) ? this.index - 1 : 0;
                break;
                case 'next':
                    newIndex = (this.index < this.length - 1) ? this.index + 1 : this.length - 1;
                break;
                default:
                    if(typeof obj == 'number' && (obj >= 0 && obj < this.length)) newIndex = obj;
                    console.log('track select', obj);
            };
            if(this.index !== newIndex){
                this.currentTrack().destruct();
                this.index = newIndex;
                this.currentTrack().play();
            }
        },
        currentTrack: function(){
            //return a track model obj
            return this.at(this.index);
        }
    });

    Controls = Backbone.View.extend({
        render: function(){
            $(this.el).append(this.template());
            return this;
        },
        events: {
            'click #previous': 'previous',
            'click #play': 'play',
            'click #next': 'next',
            'click #pause': 'pause'
        },
        play: function(){
            this.collection.currentTrack().play();
        },
        pause: function(){
            this.collection.currentTrack().pause();
        },
        previous: function(){
            this.collection.select('previous');
        },
        next: function(){
            this.collection.select('next');
        },
        template: Templates.Controls,
        el: '#controls',
        collection: Tracks,
        initialize: function(){
            var self = this;
            console.log(this);
            //this.collection.bind('pause', this.showPlay);
            this.collection.bind('play', function(){
                console.log('track play from controls');
            });
            this.collection.bind('pause', function(){
                console.log('track pause from controls');
            });
            this.collection.bind('resume', function(){
                console.log('track resume from controls');
            });
            this.collection.bind('finish', function(){
                console.log('track resume from controls');
            });
            this.collection.bind()
            this.render();
        }
    });

    Scrubber = Backbone.View.extend({
        initialize: function(){
           var self = this;
            this.collection.bind('play', function(){
                self.render(); 
                self.setScrubber(self.collection.currentTrack().stream);
            });
            this.collection.bind('pause', function(){
                self.pauseScrubber(self.collection.currentTrack().stream);
            });
            this.collection.bind('resume', function(){
                self.setScrubber(self.collection.currentTrack().stream);
            });
            this.collection.bind('time', function(){
                //self.changeScrubber(self.collection.currentTrack().stream);
            });
            this.collection.bind('finish', function(){
                console.log('track finish from scrubber');
            });
        },
        setScrubber: function(stream){
            var duration = this.collection.currentTrack().attributes.duration;
            var position = stream.position || 0;
            setTimeout(function(){
                $('#scrubber-knob').css({
                '-webkit-transform': 'translate3d(100%, 0px, 0)'
                ,'-webkit-transition-duration': (duration - position) / 1000 + 's'});
           }, 1);

        },
        pauseScrubber: function(stream){
            var duration = this.collection.currentTrack().attributes.duration;
            var position = stream.position;
            $('#scrubber-knob').css({
                '-webkit-transform': 'translate3d(' + (position/duration) * 100 + '%, 0px, 0)',
                '-webkit-transition-duration': '0s'});
        },
        collection: Tracks,
        el: '#scrubber',
        render: function(){
            var track = this.collection.currentTrack();
            console.log('scrubber render: ', track);
            $(this.el).html(this.template(track.toJSON()));
        },
        template: Templates.Scrubber
    });

    //created when a new track model is created
    TrackView = Backbone.View.extend({
        initialize: function(){
            //console.log(this.model);
            this.model.bind('change', this.render, this);
            var wrapper = document.createElement('div');
            wrapper.id = 'track-' + this.model.id;
            $('#tracks').append(wrapper);
            this.render();
        },
        template: Templates.TrackView,
        render: function(){
            //changes details of track, play icon
            console.log('track render');
            console.log('render', this.model.toJSON());
            $('#track-' + this.model.id).html(this.template(this.model.toJSON()));
            return this;   
        },
        update: function(){
            //receives a track object
            $('#track-' + this.id)[0].className = this.attributes.status;
        },
        model: Track
    });

    TestCloud.init = function(){
        
        console.log('init');
        var app = new App();
    };
})();

