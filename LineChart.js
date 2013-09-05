var LineChart = function() {
	"use strict";

	//--------------------------------------------------------------------------------
	var CONST = {
		DATE : "date"
		, UL_NM : "UL"
		, LL_NM : "LL"
		, ERR_SUFFIX : "_ERR"
	};

	//--------------------------------------------------------------------------------
	var convDateFromString = function(dataset) {
		var parseDate = d3.time.format("%Y%m%d %H%M%S").parse;

		dataset.forEach(function(d) {
			d.date = parseDate(d.date);
		});
	};

	var convDataset = function(dataset, headerNames) {
		var hNms = headerNames.slice(0);
		hNms.push(CONST.UL_NM);
		hNms.push(CONST.LL_NM);

		var series = hNms.map(function(name) {
			return {
				name: name,
				values: dataset.map(function(d) {
					return {date: d.date, data: d[name], err: d[name + CONST.ERR_SUFFIX]};
				})
			};
		});

		return series;
	};

	var getHeaderNames = function(dataset) {
		return d3.keys(dataset[0])
			.filter(function(key) {
				var ret;

				var arr = [CONST.DATE, CONST.UL_NM, CONST.LL_NM];
				ret = arr.indexOf(key);
				if (ret !== -1) {
					return false;
				}

				var pattern = CONST.ERR_SUFFIX + "$";
				ret = (new RegExp(pattern)).test(key);
				if (ret === true) {
					return false;
				}

				return true;
			});
	};

	var getColors = function(headerNames) {
		var colors = d3.scale.category10();
		colors.domain(headerNames);
		return colors;
	};

	var getConstMinMax = function(dataset, headerNames) {
		var MIN_DATA_X = d3.min(dataset, function(d) {return d.date;});
		var MAX_DATA_X = d3.max(dataset, function(d) {return d.date;});
		var MIN_DATA_Y = d3.min(dataset, function(d) {
			var min = 99999;
			for (var i = 0; i < headerNames.length; i++) {
				if (min > d[headerNames[i]]) {
					min = d[headerNames[i]];
				}
			}
			return min;
		});
		var MAX_DATA_Y = d3.max(dataset, function(d) {
			var max = -99999;
			for (var i = 0; i < headerNames.length; i++) {
				if (max < d[headerNames[i]]) {
					max = d[headerNames[i]];
				}
			}
			return max;
		});

		var obj = {};

		var prevDate = new Date(MIN_DATA_X.getFullYear(), MIN_DATA_X.getMonth(), MIN_DATA_X.getDate() - 1, MIN_DATA_X.getHours());
		var nextDate = new Date(MAX_DATA_X.getFullYear(), MAX_DATA_X.getMonth(), MAX_DATA_X.getDate() + 1, MAX_DATA_X.getHours());
		obj.MIN_X = prevDate;
		obj.MAX_X = nextDate;

		var pad_y = (MAX_DATA_Y - MIN_DATA_Y) * 0.2;
		obj.MIN_Y = MIN_DATA_Y - pad_y;
		obj.MAX_Y = MAX_DATA_Y + pad_y;

		return obj;
	};

	var calcScaleX = function(constObj, chartSize) {
		var scaleX = d3.time.scale()
			.domain([constObj.MIN_X, constObj.MAX_X])
			.range([0, chartSize.WIDTH]);
		return scaleX;
	};
	var calcScaleY = function(constObj, chartSize) {
		var scaleY = d3.scale.linear()
			.domain([constObj.MIN_Y, constObj.MAX_Y])
			.range([chartSize.HEIGHT, 0]);
		return scaleY;
	};

	var createElementSVG = function(elementId, outerSize, MARGIN) {
		var svg = d3.select(elementId)
			.append("svg")
			.attr("width", outerSize.WIDTH)
			.attr("height", outerSize.HEIGHT)
			.append("g")
			.attr("transform", "translate(" + MARGIN.left + "," + MARGIN.top + ")");

		return svg;
	};
	var createElementChartG = function(svg, PADDING) {
		var g = svg.append("g")
			.attr("transform", "translate(" + PADDING.left + "," + PADDING.top + ")");

		return g;
	};

	var drawAxis = function(chartG, scaleX, scaleY, chartSize) {
		var xAxis = d3.svg.axis()
			.scale(scaleX)
			.orient("bottom")
			.ticks(0);

		var yAxis = d3.svg.axis()
			.scale(scaleY)
			.orient("left")
			.ticks(10);

		chartG.append("g")
			.attr("class", "axis")
			.attr("transform", "translate(0," + chartSize.HEIGHT + ")")
			.call(xAxis);

		chartG.append("g")
			.attr("class", "axis")
			.call(yAxis);
	};

	var drawLabelAxisX = function(chartG, dataset, scaleX, scaleY, constObj) {
		var labels = 
		chartG.append("g")
			.attr("class", "axisX")
			.selectAll("text.labelAxisX")
			.data(dataset)
			.enter()
			.append("text")
			.attr("x", function(d) {
				return scaleX(d.date);
			})
			.attr("y", function(d) {
				return scaleY(constObj.MIN_Y - 0.05);
			})
			.attr("class", "labelAxisX")
			.attr("text-anchor", "middle");

		labels.each(function(d, i) {
			if (i % 2 === 0) {
				return "";
			}
			var el = d3.select(this);
			var format = d3.time.format("%m/%d %H:%M");
			var strDate = format(d.date);
			var splits = strDate.split(" ");

			var tspan;
			tspan = el.append("tspan").text(splits[0]);
			tspan.attr("x", el.attr("x")).attr("dy", 0);
			tspan = el.append("tspan").text(splits[1]);
			tspan.attr("x", el.attr("x")).attr("dy", 10);
		});

		var gLine = 
		chartG.append("g")
			.attr("class", "axisXTick");

		labels.each(function(d, i) {
			if (i % 2 === 0) {
				return "";
			}
			gLine.append("line")
				.attr("class", "axisXTickLine")
				.attr("x1", scaleX(d.date))
				.attr("y1", scaleY(constObj.MAX_Y))
				.attr("x2", scaleX(d.date))
				.attr("y2", scaleY(constObj.MIN_Y));
		});
	};

	var drawPathData = function(chartG, datasetSeries, scaleX, scaleY, colors) {
		var line = 
			d3.svg.line()
				.x(function(d) {
					return scaleX(d.date);
				})
				.y(function(d) {
					return scaleY(d.data);
				});

		var series = 
			chartG.selectAll(".series")
				.data(datasetSeries)
				.enter()
				.append("g")
				.attr("class", "series");

		series.append("path")
			.attr("class", function(d) {
				if (d.name === CONST.UL_NM || d.name === CONST.LL_NM) {
					return "lineCL";
				}else{
					return "line";
				}
			})
			.attr("d", function(d) {
				return line(d.values);
			})
			.style("stroke", function(d) {
				if (d.name === CONST.UL_NM || d.name === CONST.LL_NM) {
					return "red";
				}else{
					return colors(d.name);
				}
			});

		series.append("text")
			.datum(function(d) {
				return {
					name: d.name
					, value: d.values[d.values.length - 1]
				};
			})
			.attr("transform", function(d) {
				return "translate(" + scaleX(d.value.date) + "," + scaleY(d.value.data) + ")";
			})
			.attr("x", 20)
			.attr("y", 3)
			.text(function(d) {
				return d.name;
			})
			.attr("class", "labelSeriesName")
			.attr("fill", function(d) {
				if (d.name === CONST.UL_NM || d.name === CONST.LL_NM) {
					return "red";
				}else{
					return colors(d.name);
				}
			});

		var seriesWithoutCL =
			series.filter(function(d) {
				if (d.name === CONST.UL_NM || d.name === CONST.LL_NM) {
					return false;
				}else{
					return true;
				}
			});

		seriesWithoutCL.selectAll("circle")
			.data(function(d) {
				var len = d.values.length;
				for (var i = 0; i < len; i++) {
					d.values[i].name = d.name;
				}
				return d.values;
			})
			.enter()
			.append("circle")
			.attr("cx", function(d) {
				return scaleX(d.date);
			})
			.attr("cy", function(d) {
				return scaleY(d.data);
			})
			.attr("r", function(d) {
				var r;
				if (d.err !== "") {
					r = 4;
				}else{
					r = 3.5;
				}
				return r;
			})
			.attr("fill", function(d) {
				return colors(d.name);
			})
			.attr("class", function(d) {
				var classNm;
				if (d.err !== "") {
					classNm = "pointError";
				}else{
					classNm = "";
				}
				return classNm;
			});

	};


	//--------------------------------------------------------------------------------
	var drawLineChart = function(elementId, dataset) {

		var MARGIN = {top: 0, right: 20, bottom: 0, left: 0};
		var PADDING = {top: 10, right: 50, bottom: 50, left: 30};

		var outerSize = {
			WIDTH: 640
			, HEIGHT: 380
		};
		var innerSize = {
			WIDTH: outerSize.WIDTH - (MARGIN.left + MARGIN.right)
			, HEIGHT: outerSize.HEIGHT - (MARGIN.top + MARGIN.bottom)
		};
		var chartSize = {
			WIDTH: innerSize.WIDTH - (PADDING.left + PADDING.right)
			, HEIGHT: innerSize.HEIGHT - (PADDING.top + PADDING.bottom)
		};

		//--------------------
		convDateFromString(dataset);
		var headerNames = getHeaderNames(dataset);
		var colors = getColors(headerNames);

		//--------------------
		var constMinMax = getConstMinMax(dataset, headerNames);
		var scaleX = calcScaleX(constMinMax, chartSize);
		var scaleY = calcScaleY(constMinMax, chartSize);

		//--------------------
		var datasetSeries = convDataset(dataset, headerNames);

		//--------------------
		var svg = createElementSVG(elementId, outerSize, MARGIN);
		var chartG = createElementChartG(svg, PADDING);

		drawAxis(chartG, scaleX, scaleY, chartSize);

		drawLabelAxisX(chartG, dataset, scaleX, scaleY, constMinMax);

		drawPathData(chartG, datasetSeries, scaleX, scaleY, colors);

	};

	//--------------------------------------------------------------------------------
	return {
		DATE : CONST.DATE
		, UL_NM : CONST.UL_NM
		, LL_NM : CONST.LL_NM
		, ERR_SUFFIX : CONST.ERR_SUFFIX
		, drawLineChart: function(elementId, dataset) {
			drawLineChart(elementId, dataset);
		}
	};

}();
