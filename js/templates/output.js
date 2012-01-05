(function(){window.Templates = {};Templates.Controls = _.template('<div class="track-time"><h3><span class="track-current">00:00</span>&nbsp;/&nbsp;<span class="track-duration">00:00</span></h3></div><div class="track-playback"><div id="previous" class="control">prev</div><div id="play" class="control">play</div><div id="next" class="control">next</div></div>');Templates.Scrubber = _.template('<div class="scrubber-knob"><div class="scrubber-control"></div></div><img src="<%= waveform_url %>" width="100%" height="50" /> ');Templates.TrackMeta = _.template('<div class="meta-title"><p><%= title %></p></div><div class="meta-creator"><p><span><%= user.username %></span></p></div><div class="meta-image"><img width="200" height="200" src="<%= artwork_url %>" /></div><!-- <div><img src="<%= user.avatar_url %>" width="50" height="50" /></div> --><div class="meta-comments"><h3>Comments: <%= comment_count %></h3></div><!-- <div class="meta-created"><p>Created: <%= created_at %></p></div><div class="meta-desc"><p><%= description %></p></div> -->');})()