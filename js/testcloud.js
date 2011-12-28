// TestCloud
(function(){

    var TestCloud, Tracks, Track, Controls, TrackView, Scrubber;

    var activate = ('createTouch' in document) ? 'touchstart' : 'click';

    var hasTouch = ('createTouch' in document) ? true : false;

    console.log(activate);

    window.TestCloud = TestCloud = {};

    var App = Backbone.View.extend({
        initialize: function(){

            var tracks = this.tracks = new Tracks();
            this.controls = new Controls({collection: tracks});
            this.scrubber = new Scrubber({collection: tracks});
            
            var list = [5968824, 4456728, 291];

            _.each(list, function(value, index){
                tracks.add(new Track({'id': value}));
                if(index == 0){
                    // autoplay
                    // tracks.select(list[0]);
                };
            });
        }, 
    });

    Track = Backbone.Model.extend({
        localStorage: new Store('tracks'),
        initialize: function(){
            // set a load limit first ???
            this.set({'selected' : false});
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
        },
        play: function(){
            console.log('track play:', this, this.collection.currentTrack);
            this.collection.currentTrack.destruct();
            this.collection.currentTrack = this;
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
                        //self.trigger('play');
                        //self.timer = setInterval(_.bind(self.updateTime, self), 1000); 
                        this.onposition(10, function(){
                            console.log('stream reached 10');
                            self.trigger('play');
                        }); 
                    },
                    onfinish: function(){
                        self.collection.select('next');
                        self.trigger('finish');
                        //clearInterval(self.timer);
                        self.destruct();
                        console.log('destroying track');
                    },
                    onpause: function(){
                        self.trigger('pause');
                        //clearInterval(self.timer);
                    },
                    onresume: function(){
                        self.trigger('resume');
                        //self.timer = setInterval(_.bind(self.updateTime, self), 1000);
                    }
                });   
            }
        },
        updateTime: function(){
            this.trigger('time');
        },
        destruct: function(){
            //if(self.timer) clearInterval(self.timer);
            if(this.stream) {
                this.stream.destruct();
            } else {
                console.log('no stream to destruct!');
            }
            this.set({'selected': false});
        }
    });

    Tracks = Backbone.Collection.extend({
        model: Track,
        initialize: function(){
            this.bind('add', function(obj){
                if(this.models.length == 1){
                    //console.log('set first', obj);
                    this.currentTrack = obj; 
                }
            })
        },
        select: function(obj){
            var index;
            if(typeof obj === 'number'){
                _.each(this.models, function(item, index, array){
                    //quick turn into a number
                    if(+item.id == obj){
                        item.play();
                    }
                });
            };
            if(obj === 'next'){
                console.log('next')
                index = this.models.indexOf(this.currentTrack);
                if(index > -1 && index <= this.models.length - 2){
                    index += 1;
                    this.models[index].play();
                }
            }; 
            if(obj === 'previous'){
                console.log('previous')
                index = this.models.indexOf(this.currentTrack);
                if(index > 0){
                    index -= 1;
                    this.models[index].play();
                }
            };
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
            this.collection.currentTrack.play();
        },
        pause: function(){
            this.collection.currentTrack.pause();
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
            this.render();
        }
    });

    Scrubber = Backbone.View.extend({
        initialize: function(){
            var self = this;
            this.collection.bind('play', function(){
                self.render(); 
                self.setScrubber(self.collection.currentTrack.stream);
            });
            this.collection.bind('pause', function(){
                self.pauseScrubber(self.collection.currentTrack.stream);
            });
            this.collection.bind('resume', function(){
                self.setScrubber(self.collection.currentTrack.stream);
            });
            this.collection.bind('finish', function(){
                console.log('track finish from scrubber');
            });
            this.collection.bind('time', function(){
                console.log('time update');
                self.pauseScrubber(self.collection.currentTrack.stream);
                self.setScrubber(self.collection.currentTrack.stream);
            })
        },
        setScrubber: function(stream){
            console.log('set scrubber!');
            var duration = this.collection.currentTrack.attributes.duration;
            var position = stream.position || 0;
            console.log(stream.bytesLoaded, stream.bytesTotal, stream.bytesTotal / stream.bytesLoaded)
            setTimeout(function(){
                $('#scrubber-knob').css({
                '-webkit-transform': 'translate3d(100%, 0px, 0)',
                '-webkit-transition-duration': (duration - position) / 1000 + 's'});
           }, 1);

        },
        pauseScrubber: function(stream){
            var duration = this.collection.currentTrack.attributes.duration;
            var position = stream.position;
            $('#scrubber-knob').css({
                '-webkit-transform': 'translate3d(' + (position/duration) * 100 + '%, 0px, 0)',
                '-webkit-transition-duration': '0s'});
        },
        collection: Tracks,
        el: '#scrubber',
        render: function(){
            var self = this;
            var track = this.collection.currentTrack;
            console.log('scrubber render: ', track, this);
            $(this.el).html(self.template(track.toJSON()));
            $('#scrubber-control').bind(activate, function(e){
               e.preventDefault();
               self.pauseScrubber(self.collection.currentTrack.stream);
            });
            $('#scrubber-control').bind('touchmove', function(e){
               e.preventDefault();
               $('#scrubber-knob').css({
                   '-webkit-transform': 'translate3d(' + e.touches[0].screenX + 'px,0,0)'
               });
            });
            $('#scrubber-control').bind('touchend', function(e){
                // touchend has changedtouches on iphone
                // on android it may be different and we'll have to use touches like normal

                e.preventDefault();
                $('#scrubber-knob').css({
                   '-webkit-transform': 'translate3d(' + e.changedTouches[0].screenX + 'px,0,0)'
                });

                var pos = e.changedTouches[0].screenX;
                var width = window.innerWidth;
                var duration = self.collection.currentTrack.attributes.duration;
                
                //position * duration / width
                var newPos = Math.round((pos * duration) / width);
                self.collection.currentTrack.stream.setPosition(newPos);
                self.setScrubber(self.collection.currentTrack.stream);
            });
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
            wrapper.className = 'track';
            $('#tracks').append(wrapper);
            this.render();
        },
        template: Templates.TrackView,
        render: function(){
            var self = this;
            var el = $('#track-' + this.model.id);
            //changes details of track, play icon
            el.html(this.template(this.model.toJSON()));

            if(this.model.get('selected')){
                el.addClass('selected');
            } else {
                el.removeClass('selected');
            }
                        
            el.bind((hasTouch) ? 'touchstart' : 'click', function(){
               console.log('something?');
               self.model.collection.select(self.model.id);
            });
            
            return this;   
        },
        model: Track
    });

    TestCloud.init = function(){
        console.log('init');
        var app = new App();
    };
})();

