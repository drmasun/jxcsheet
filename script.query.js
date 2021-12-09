//var pending = false;
var headers = $('th');
var rABS = typeof FileReader !== "undefined" && typeof FileReader.prototype !== "undefined" && typeof FileReader.prototype.readAsBinaryString !== "undefined";
var columns = ['Name', 'Date', 'Meet', 'Time', 'Course', 'Grade', '1st Mile', '2nd Mile', '3rd Mile'];
var fuse, runnerdata, datashown = [];
var prefrences = {
	includeScore: true,
	shouldSort: true,
	threshold: 0.2,
	keys: ['Name']
}

const filters = [
	$('#name'),
	$('#eventdate'),
	$('#meet'),
	$('#racetime'),
	$('#course'),
	$('#grade')
];

var filesheet = function(path, cb) {
	var xhr = new XMLHttpRequest();
	xhr.open("GET", path);
	xhr.responseType = "blob";
	xhr.addEventListener('load', function() {
		xhr.response.lastModifiedDate = new Date();
		xhr.response.name = "sheet.xlsx";
		cb(xhr.response);
	});
	xhr.send();
};

var construct = function(data, score) {
	var row = $('<tr></tr>').attr({ 'score': score, 'rownum': data['__rowNum__'] });
	var name = $('<td></td>').addClass('name').text(data['Name']);
	var day = $('<td></td>').addClass('date').text(data['Date']);
	var meet = $('<td></td>').addClass('meet').text(data['Meet']);
	var race = $('<td></td>').addClass('time').text(data['Time']);
	var course = $('<td></td>').addClass('course').text(data['Course']);
	var grade = $('<td></td>').addClass('grade').text(data['Grade']);
	var mile1 = $('<td></td>').addClass('mile1').text(data['1st Mile']);
	var mile2 = $('<td></td>').addClass('mile2').text(data['2nd Mile']);
	var mile3 = $('<td></td>').addClass('mile3').text(data['3rd Mile']);
	return row.append(name, day, meet, race, course, grade, mile1, mile2, mile3);
}

function round(value, decimals) { return Number(Math.round(`${value}e${decimals}`)+`e-${decimals}`) }
function fixdata(data) {
	var l = 0, w = 10240;
	var o = "";
	for (; l < data.byteLength / w; ++l)
		o += String.fromCharCode.apply(null, new Uint8Array(data.slice(l * w, l * w + w)));
	o += String.fromCharCode.apply(null, new Uint8Array(data.slice(l * w)));
	return o;
}

function process_wb(wb) {
	runnerdata = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false });
	//pending = false;
	return runnerdata;
}

function filterload(look, empty) {
	for (var d = 0; d < look.length; d += 1) {
		var elmnts = $(`#${look[d]}s`).children('option');
		for (var e = 0; 0 < elmnts.length; e += 1)
			elmnts.first().remove();
	}
	
	var indexes = Array(look.length).fill(0);
	var info = Array(look.length).fill(null).map(() => Array());
	var categories = $('tr').first().children('td');
	for (var y = 0; y < look.length; y += 1)
		for (; indexes[y] < categories.length && categories.eq(indexes[y]).text().toLowerCase() != look[y].toLowerCase(); indexes[y] += 1)
			continue;
	
	var loopnum = (empty) ? runnerdata.length : $('tr').length;
	for (var w = 0; w < look.length; w += 1)
		for (var i = 1; i < loopnum; i += 1) {
			var temp = runnerdata[(empty) ? i : (Number.parseInt($('tr').eq(i).attr('rownum'), 10) - 1)][_.capitalize(look[w])];
			if (info[w].includes(temp) || (!empty && $('tr').eq(i).css('display') == "none")) continue;
			info[w].push(temp);
		}
		
	for (var a = 0; a < info.length; a += 1)
		for (var b = 0; b < info[a].length; b += 1)
			$(`#${look[a]}s`).append($('<option></option>').val(info[a][b]));
}

var sortdata = function(data, sortby, ascending) {
	var obj = JSON.parse(JSON.stringify(data));
	obj.sort((a, b) => {
		if (sortby == 'Date') {
			a['Date'] = new moment(a['Date']);
			b['Date'] = new moment(b['Date']);
		}
		
		if (a[sortby] < b[sortby]) return (ascending) ? -1 : 1
		else if (a[sortby] == b[sortby]) return 0
		else return (ascending) ? 1 : -1
	});
	
	if (sortby == 'Date')
		for (var y = 0; y < obj.length; y += 1)
			obj[y]['Date'] = obj[y]['Date'].format('M/D/YY');
	return obj;
}

function sorttable(el, ascending) {
	var category = $(el).text();
	while (1 < $('tr').length)
		$('tr').eq(1).remove();
	for (var x of sortdata(datashown, category, ascending))
		$('tbody').append(construct(x));
}

function afterload(rows) {
	console.log('Done!');
	$('input').attr('disabled', false);
	
	fuse = new Fuse(rows, {
		includeScore: true,
		threshold: 0.2,
		keys: ['Name']
	});
	
	filterload(['meet', 'course', 'grade'], true);
}

function xw(data, cb) {
	//pending = true;
	var worker = new Worker('./modify.js');
	worker.onmessage = function (e) {
		switch (e.data.t) {
			case 'e':
				//pending = false;
				console.error(e.data.d);
				break;
			case 'xlsx':
				afterload(cb(JSON.parse(e.data.d)));
				break;
		}
	}
	
	var arr = rABS ? data : btoa(fixdata(data));
	worker.postMessage({
		d: arr,
		b: rABS
	});
}

var filtermatch = function(item) {
	var obj = JSON.parse(JSON.stringify(item));
	var table = $('tr');
	var contentlength = 0;
	if (obj['Date'].length > 0)
		obj['Date'] = new moment(obj['Date']).format('YYYY-MM-DD');
	if (obj['Time'].length > 0)
		obj['Time'] = /\d{1,2}:\d{2}/.exec(obj['Time']);
	for (var i = 1; i < filters.length; i += 1)
		contentlength += filters[i].val().length;
	if (contentlength > 0) {
		var appears = true;
		for (var j = 1; j < filters.length && appears; j += 1)
			if (filters[j].val().length > 0)
				appears = filters[j].val().toLowerCase() == obj[columns[j]].toString().toLowerCase();
		return appears;
	} else return true;
}

var filtertable = function() {
	var contentlength = 0;
	for (var a = 1; a < filters.length; a += 1)
		contentlength += filters[a].val().length;
	while (1 < $('tr').length)
		$('tr').eq(1).remove();
	datashown = [];
	headers.removeClass('ascending descending');
	headers.each((x, y) => { if (x < (headers.length - 3)) $(y).attr('data-active', 'false') });
	
	if (filters[0].val().length > 0) {
		var result = fuse.search({ 'Name': filters[0].val() });
		console.log(result);
		for (var d = 0; d < result.length; d += 1)
			if (filtermatch(result[d].item))
				datashown.push(result[d].item);
	} else if (contentlength > 0) {
		for (var f = 1; f < runnerdata.length; f += 1)
			if (filtermatch(runnerdata[f]))
				datashown.push(runnerdata[f])
	}
	
	for (var g of datashown)
		$('tbody').append(construct(g));
	filterload(['meet', 'course', 'grade'], (filters[0].val().length < 1 && contentlength < 1));
}

$('#clear').on('click', (e) => {
	$('input').val('');
	filtertable();
});

for (var k of filters)
	k.on('change', filtertable);

var truetable = Array(headers.length - 3).fill(true);
headers.each((l, m) => {
	if (l < (headers.length - 3)) {
		$(m).on('click', (e) => {
			console.log('Index: ' + l);
			if (datashown.length > 0)
				if ($(e.target).attr('data-active') == 'false') {
					headers.each((n, o) => o.attr('data-active', (o == $(e.target)) ? 'true' : 'false'));
					headers.removeClass('ascending descending');
					$(e.target).addClass('ascending');
					sorttable(e.target, true);
				} else {
					// Future Code
				}
		});
	}
});

/*
for (var l = 0; l < (headers.length - 3); l += 1)
	headers[l].addEventListener('click', function(e){
		if (datashown.length > 0)
			if (e.target.getAttribute('data-active') == "false") {
				for (m = 0; m < headers.length; m += 1)
					if (headers[m] == e.target) break;
				for (var n = 0; n < (headers.length - 3); n += 1) {
					headers[n].classList.remove('ascending', 'descending');
					headers[n].setAttribute('data-active', (n == m) ? 'true' : 'false');
				}
				
				headers[m].classList.add('ascending');
				sorttable(m, true);
			} else {
				truetable[m] = !truetable[m];
				headers[m].classList.toggle('ascending');
				headers[m].classList.toggle('descending');
				sorttable(m, truetable[m]);
			}
	});
*/

document.addEventListener('DOMContentLoaded', function(e) {
	filesheet('runnerdatabase.xlsx', function(blob) {
		var fil = blob;
		var filereader = new FileReader();
		filereader.onload = function(e) {
			console.log("onload", new Date());
			var data = e.target.result;
			function doitnow() {
				try {
					xw(data, process_wb);
				} catch (e) {
					console.error(e);
					alert('Error Parsing File');
					//pending = false;
				}
			}
			
			if (e.target.result.length > 1e6) {
				if (confirm("This file is " + round((Number.parseInt(e.target.result.length, 10) / (Math.pow(1024, 1))), 3) + " kilobytes and may take a few moments.  Your browser may lock up during this process.  Shall we play?"))
					doitnow();
			} else doitnow();
		}
		
		if (rABS) filereader.readAsBinaryString(fil);
		else filereader.readAsArrayBuffer(fil);
	});
}, false);
