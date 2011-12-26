var fs = require('fs');

// loop through dirs finding all views
fs.readdir(process.cwd(), function(err, files){
	if (err) throw err;
	var closureStart = '(function(){window.Templates = {};';
	var closureEnd = '})()';
	var templates = '';
	var counter = 0;
	files.forEach(function(el, index, array){
		counter++;
		if(el.indexOf('.jst') !== -1){
			fs.readFile(el, 'utf8', function(err, data){
				if (err) throw err;
				//the string that goes in the function
				var name = el.split('.')[0];
				data = data.replace(/[\r\t\n]/g, "");
				data = data.replace(/'/g, '\'');
				data = 'Templates.' + name + ' = ' + '_.template(\'' + data + '\');';
				templates += data;
				if(counter == array.length){
					var output = closureStart + templates + closureEnd; 
					fs.writeFile('output.js', output, function(err){
						if (err) throw err;
						console.log('js file saved');
					});
				}
			});
		}
	});
});