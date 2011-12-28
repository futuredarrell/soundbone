// TestCloud
// When ready...
(function(){

    var TestCloud, Tracks, Track, Controls, TrackView, Scrubber, App;

    var activate = ('createTouch' in document) ? 'touchstart' : 'click';

    var hasTouch = ('createTouch' in document) ? true : false;

    window.TestCloud = TestCloud = {};

    var Screen = Backbone.View.extend({
        createModule: function(name){
          var module = document.createElement('div');
          module.id = name;
          this.screen.appendChild(module);
        },
        createScreen: function(){
            var screen = document.createElement('div');
            screen.className = 'screen';
            $('#container').append(screen);
            this.screen = screen;
            return screen;
        },
        initialize: function(){
            this.createScreen();
            this.render();
        }
    });

    var Home = Screen.extend({
        render: function(){
            this.createModule('tracks');
            var list = [5968824, 4456728, 291];
            var tracks = new Tracks();
            _.each(list, function(value, index){
                tracks.add(new Track({'id': value}));
                if(index == 0){
                    // autoplay
                    // tracks.select(list[0]);
                };
            });
        }
    });

    var TrackDetail = Screen.extend({
        render: function(){
            this.createModule('scrubber');
            console.log(this.model);
            this.model.play();
            this.scrubber = new Scrubber({model:this.model});
        },
        model: Track
    })

    App = Backbone.View.extend({
        initialize: function(){
            var home = new Home();
            this.currentScreen = home;
        },
        transitionTo: function(newScreen){
            console.log(newScreen, this.currentScreen);
            $('#container').css({'width' : '800px'});
            $('#container .screen').addClass('slide-left');
            this.currentScreen = newScreen;
        }
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
        /*updateTime: function(){
            this.trigger('time');
        },*/
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
            this.render();
        }
    });

    Scrubber = Backbone.View.extend({
        initialize: function(){            
            var self = this;
            this.model.bind('play', function(){
                self.render(); 
                self.setScrubber(self.model.stream);
            });
            this.model.bind('pause', function(){
                self.pauseScrubber(self.model.stream);
            });
            this.model.bind('resume', function(){
                self.setScrubber(self.model.stream);
            });
            this.model.bind('finish', function(){
                console.log('track finish from scrubber');
            });
        },
        setScrubber: function(stream){
            console.log('set scrubber!');
            var duration = this.model.attributes.duration;
            var position = stream.position || 0;
            //console.log(stream.bytesLoaded, stream.bytesTotal, stream.bytesTotal / stream.bytesLoaded)
            setTimeout(function(){
                $('#scrubber-knob').css({
                '-webkit-transform': 'translate3d(100%, 0px, 0)',
                '-webkit-transition-duration': (duration - position) / 1000 + 's'});
           }, 1);

        },
        pauseScrubber: function(stream){
            var duration = this.model.attributes.duration;
            var position = stream.position;
            $('#scrubber-knob').css({
                '-webkit-transform': 'translate3d(' + (position/duration) * 100 + '%, 0px, 0)',
                '-webkit-transition-duration': '0s'});
        },
        model: Track,
        el: '#scrubber',
        render: function(){
            var self = this;
            var track = this.model;
            console.log('scrubber render: ', track, this);
            $(this.el).html(self.template(track.toJSON()));
            $('#scrubber-control').bind(activate, function(e){
               e.preventDefault();
               self.pauseScrubber(self.model.stream);
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
                var duration = self.model.attributes.duration;
                
                //position * duration / width
                var newPos = Math.round((pos * duration) / width);
                self.model.stream.setPosition(newPos);
                self.setScrubber(self.model.stream);
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
               //console.log('something?');
               var trackDetail = new TrackDetail({model: self.model});
               App.transitionTo(trackDetail);
               //self.model.collection.select(self.model.id);
            });
            
            return this;   
        },
        model: Track
    });

    TestCloud.init = function(){
        console.log('init');
        window.App = App = new App();
        
    };
})();

