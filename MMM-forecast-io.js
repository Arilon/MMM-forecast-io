Module.register("MMM-forecast-io", {

  defaults: {
    apiKey: "",
    apiBase: "https://api.darksky.net/forecast",
    units: config.units,
    language: config.language,
    updateInterval: 6 * 60 * 1000, // every 5 minutes
    animationSpeed: 1000,
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500,
    tempDecimalPlaces: 0, // round temperatures to this many decimal places
    geoLocationOptions: {
      enableHighAccuracy: true,
      timeout: 5000
    },
    latitude: null,
    longitude: null,
    showSummary: true,
    showForecast: true,
    maxDaysForecast: 7,
    showPrecipitationGraph: true,
    precipitationGraphHours: 36, // hours to make the precipitation graph cover. More than 48 is pointless because we don't have that data.
    precipitationGraphTickHours: 6, // how many hours between each tick along the bottom of the graph
    precipitationGraphWidth: 400,
    precipitationGraphHeight: 120, // 120 by default
    showPrecipLevels: false, // whether to show 1/3 and 2/3 levels for the graph
    precipFillColor: 'blue', // color to make precipitation graph
    precipLineColor: 'gray',
    minPrecipCutoff: 0.0019, //in inches per hour. Below this rain is considered to be not happening. About 0.05mm/h
    lightPrecipCutoff: 0.1, //in inches per hour. Below this is "light" rain. US Meterological Society defines this as 0.1. About 2.5mm/h. 1/3rd up the graph
    heavyPrecipCutoff: 0.4, //in inches per hour. Above this is "heavy" rain. UK MetOffice defines this as 0.4. About 10mm/h. 2/3rds up the graph
    /*  The above three values are used to find a scale for the precipitation graph.           *
     *  Light is a third of the way up, heavy is two thirds.                                */
    showWind: true,
    showSunrise: true,
    showSunriseGraph: true,
    showTempGraph: true, //whether to show temp line, if false showHot and showFreeze have no effect
    showHot: true,
    hotFahrenheit: 80, //hot line in fahrenheit, automatically adjusted if recieving Celsius temps. 80F ~= 26.666C
    showFreeze: true,
    freezeFahrenheit: 32, //freeze line in fahrenheit... It's 0 Celsius. Can't see why you'd want to change it, but, why not have the option.
    precipitationGraphFahrenheitLow: -10, //lowest temp on the graph in fahrenheit. -10F ~= -23.333C
    precipitationGraphFahrenheitHigh: 110, //highest temp on the graph in fahrenheit. 110F ~= 43.333C
    unitTable: {
      'default':  'auto',
      'metric':   'si',
      'imperial': 'us'
    },
    iconTable: {
      'clear-day':           'wi-day-sunny',
      'clear-night':         'wi-night-clear',
      'rain':                'wi-rain',
      'snow':                'wi-snow',
      'sleet':               'wi-rain-mix',
      'wind':                'wi-cloudy-gusts',
      'fog':                 'wi-fog',
      'cloudy':              'wi-cloudy',
      'partly-cloudy-day':   'wi-day-cloudy',
      'partly-cloudy-night': 'wi-night-cloudy',
      'hail':                'wi-hail',
      'thunderstorm':        'wi-thunderstorm',
      'tornado':             'wi-tornado'
    },

    debug: false
  },

  getTranslations: function() {
    return false;
  },

  getScripts: function() {
    return [
      'jsonp.js',
      'moment.js'
    ];
  },

  getStyles: function() {
    return ["weather-icons.css", "MMM-forecast-io.css"];
  },

  shouldLookupGeolocation: function() {
    return this.config.latitude == null &&
      this.config.longitude == null;
  },

  start: function() {
    Log.info("Starting module: " + this.name);

    if (this.shouldLookupGeolocation()) {
      this.getLocation();
    }
    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  updateWeather: function() {
    if (this.geoLocationLookupFailed) {
      return;
    }
    if (this.shouldLookupGeolocation() && !this.geoLocationLookupSuccess) {
      this.scheduleUpdate(1000); // try again in one second
      return;
    }

    var units = this.config.unitTable[this.config.units] || 'auto';

    var url = this.config.apiBase + '/' + this.config.apiKey + '/' + this.config.latitude + ',' + this.config.longitude + '?units=' + units + '&lang=' + this.config.language;
    if (this.config.data) {
      // for debugging
      this.processWeather(this.config.data);
    } else {
      getJSONP(url, this.processWeather.bind(this), this.processWeatherError.bind(this));
    }
  },

  processWeather: function(data) {
    if (this.config.debug) {
      console.log('weather data', data);
    }
    this.loaded = true;
    this.weatherData = data;
    this.temp = this.roundTemp(this.weatherData.currently.temperature);
    this.updateDom(this.config.animationSpeed);
    this.scheduleUpdate();
  },

  processWeatherError: function(error) {
    if (this.config.debug) {
      console.log('process weather error', error);
    }
    // try later
    this.scheduleUpdate();
  },

  notificationReceived: function(notification, payload, sender) {
    switch (notification) {
      case "DOM_OBJECTS_CREATED":
        break;
    }
  },

  getDom: function() {
    var wrapper = document.createElement("div");

    if (this.config.apiKey === "") {
      wrapper.innerHTML = "Please set the correct forcast.io <i>apiKey</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (this.geoLocationLookupFailed) {
      wrapper.innerHTML = "Geolocaiton lookup failed, please set <i>latitude</i> and <i>longitude</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.innerHTML = this.translate('LOADING');
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    var currentWeather = this.weatherData.currently;
    var hourly         = this.weatherData.hourly;
    var minutely       = this.weatherData.minutely;
    var daily          = this.weatherData.daily;

    //========== Current large icon & Temp
    var large = document.createElement("div");
    large.className = "large light";

    var icon = minutely ? minutely.icon : hourly.icon;
    var iconClass = this.config.iconTable[hourly.icon];
    var icon = document.createElement("span");
    icon.className = 'big-icon wi ' + iconClass;
    large.appendChild(icon);

    var temperature = document.createElement("span");
    temperature.className = "bright";
    temperature.innerHTML = " " + this.temp + "&deg;";
    large.appendChild(temperature);

    // ====== wind 
    if (this.config.showWind) {
      var padding = document.createElement("span");
      padding.className = "dim";
      padding.innerHTML = " &nbsp &nbsp ";
      large.appendChild(padding);

      var windicon = document.createElement("span");
      windicon.className = 'big-icon wi wi-strong-wind xdimmed';
      large.appendChild(windicon);

      var wind = document.createElement("span");
      wind.className = "dim";
      wind.innerHTML = " " + Math.round(this.weatherData.currently.windSpeed) + " ";
      large.appendChild(wind);
    }

    //========== sunrise/sunset
    if (this.config.showSunrise) {
      var midText = document.createElement("div");
      midText.className = "light";

      var today = this.weatherData.daily.data[0];
      var now   = new Date();

      if (today.sunriseTime * 1000 < now && today.sunsetTime * 1000 > now) {
        var sunset = new moment.unix(today.sunsetTime).format("h:mm a");
        sunString = '<span class="wi wi-sunset xdimmed"></span> ' + sunset;
      } else {
        var sunrise = new moment.unix(today.sunriseTime).format("h:mm a");
        sunString = '<span class="wi wi-sunrise xdimmed"></span> ' + sunrise;
      }

      var sunTime = document.createElement("div");
      sunTime.className = "small dimmed summary";
      sunTime.innerHTML = sunString;
      large.appendChild(sunTime);
    }
    wrapper.appendChild(large);

    // =========  summary text
    if (this.config.showSummary) {
      var summaryText = minutely ? minutely.summary : hourly.summary;
      var summary = document.createElement("div");
      summary.className = "small dimmed summary";
      summary.innerHTML = summaryText;
      wrapper.appendChild(summary);
    }

    // ======== precip graph and forecast table
    if (this.config.showPrecipitationGraph) {
      wrapper.appendChild(this.renderPrecipitationGraph());
    }
    if (this.config.showForecast) {
      wrapper.appendChild(this.renderWeatherForecast());
    }

    return wrapper;
  },

  renderPrecipitationGraph: function() {
    var i;
    var width = this.config.precipitationGraphWidth;
    var height = this.config.precipitationGraphHeight; // 120 by default
    var element = document.createElement('canvas');
    element.className = "precipitation-graph";
    element.width = width;
    element.height = height;
    var context = element.getContext('2d');

    var precipitationGraphTempScale = height / (this.config.precipitationGraphFahrenheitHigh - this.config.precipitationGraphFahrenheitLow); // scale the temp graph
    var precipitationGraphYShift = this.config.precipitationGraphFahrenheitLow; // adjust where 0 is for the temp line
    var stepSize = (width / this.config.precipitationGraphHours); // pixels per hour

    // ======= shade blocks for daylight hours
    if (this.config.showSunriseGraph) {
      var now = new Date();
      now = Math.floor(now / 1000); // current time in Unix format
      var timeUnilSunrise;
      var timeUnilSunset;
      var sunrisePixels; // daytime shade box location on graph
      var sunsetPixels;

      context.save();
      for (i = 0; i < (Math.ceil(this.config.precipitationGraphHours/24+1)); i++) { // What is the max days we might need?
        timeUnilSunrise = (this.weatherData.daily.data[i].sunriseTime - now);
        timeUnilSunset = (this.weatherData.daily.data[i].sunsetTime - now);

        if ((timeUnilSunrise < 0) && (i == 0)) {
          timeUnilSunrise = 0; // sunrise has happened already today
        }
        if ((timeUnilSunset < 0) && (i == 0)) {
          timeUnilSunset = 0; // sunset has happened already today
        }

        sunrisePixels = (timeUnilSunrise / 60 / 60) * stepSize;
        sunsetPixels = (timeUnilSunset / 60 / 60) * stepSize;

        context.fillStyle = "#323232";
        context.fillRect(sunrisePixels, 0, (sunsetPixels - sunrisePixels), height);
      }
      context.restore();
    }

    // ====== freezing and hot lines
    context.save();
    context.beginPath();
    context.setLineDash([5, 10]);
    if (this.config.showTempGraph && this.config.showHot) {
      i = this.config.hotFahrenheit; // ========== hot line
      context.lineWidth = 1;
      context.strokeStyle = 'red';
      context.moveTo(0, height - (i - precipitationGraphYShift) * precipitationGraphTempScale);
      context.lineTo(width, height - (i - precipitationGraphYShift) * precipitationGraphTempScale);
      context.stroke();
    }

    if (this.config.showTempGraph && this.config.showFreeze) {
      i = this.config.freezeFahrenheit; // ====== freezing line
      context.beginPath();
      context.strokeStyle = 'blue';
      context.moveTo(0, height - (i - precipitationGraphYShift) * precipitationGraphTempScale);
      context.lineTo(width, height - (i - precipitationGraphYShift) * precipitationGraphTempScale);
      context.stroke();
    }
    context.restore();

    // ====== graph of precipIntensity  (inches of liquid water per hour)
    var data = this.weatherData.hourly.data;

    context.save();
    context.strokeStyle = this.config.precipLineColor;
    context.lineWidth = 2;
    context.fillStyle = this.config.precipFillColor;
    // context.globalCompositeOperation = 'xor';
    context.beginPath();
    context.moveTo(0, height + 2);
    var intensity;

    for (i = 0; i < data.length; i++) {
      // convert to inches
      if (this.weatherData.flags.units == "us") intensity = data[i].precipIntensity; // make trace stand out
      else intensity = data[i].precipIntensity / 25.4; //convert metric units to inches

      // height on precip graph
      if (intensity <= this.config.minPrecipCutoff) intensity = 0; //barely any rain
      else if (intensity <= this.config.lightPrecipCutoff) intensity = intensity * 10 / 3; // light rain
      else if (intensity <= this.config.heavyPrecipCutoff) intensity = 10 / 3 + (intensity - 0.1) * (10 / 3); // moderate rain
      else intensity = 2 * 10 / 3 + (intensity - 0.4) * (10 / 3); // heavy rain

      // scale based on graph height
      intensity = intensity * height;
      // move linr
      context.lineTo(i * stepSize, height - intensity + 1);

    }
    context.lineTo(width, height + 2);
    context.closePath();
    context.stroke();
    context.fill();
    context.restore();


    // ======= graph of temp
    var numMins = 60 * this.config.precipitationGraphHours; // minutes in graph
    var tempTemp;

    context.save();
    if (this.config.showTempGraph) {
      context.strokeStyle = 'gray';
      context.lineWidth = 2;
      context.moveTo(0, height);

      var stepSizeTemp = Math.round(width / this.config.precipitationGraphHours);
      var tempX;
      var tempY;
      var tempNow;

      for (i = 0; i < (this.config.precipitationGraphHours + 1) && i < this.weatherData.hourly.data.length; i++) {
        if (this.weatherData.flags.units == "us") tempNow = this.weatherData.hourly.data[i].temperature;
        else tempNow = this.weatherData.hourly.data[i].temperature * 1.8 + 32;
        tempX = i * stepSizeTemp;
        tempY = height - (tempNow - precipitationGraphYShift) * precipitationGraphTempScale;

        context.lineTo(tempX, tempY); // line from last hour to this hour
        context.stroke();

        context.beginPath();
        context.arc(tempX, tempY, 1, 0, 2 * Math.PI); // hour-dots
        context.stroke();
      }
      context.restore();

      for (i = 0; i < (this.config.precipitationGraphHours + 1) && i < this.weatherData.hourly.data.length; i++) { // text label for temperature on graph
        if ((i % 2) == 1) {
          if (this.weatherData.flags.units == "us") tempNow = this.weatherData.hourly.data[i].temperature;
          else tempNow = this.weatherData.hourly.data[i].temperature * 1.8 + 32;
          tempX = (i * stepSizeTemp) - 5;
          tempY = height - ((tempNow - precipitationGraphYShift) * precipitationGraphTempScale + 5);
          tempTemp = Math.round(this.weatherData.hourly.data[i].temperature);

          context.beginPath();
          context.font = "10px Arial";
          context.fillStyle = "grey";
          context.fillText(tempTemp, tempX, tempY);
          context.stroke();

          //        var timeLabel;
          //        timeLabel = this.weatherData.hourly.data[i].time;
          //        timeLabel = moment(timeLabel*1000).format("ha");
          //        timeLabel = timeLabel.replace("m", " ");
          //        context.beginPath();
          //        context.font = "10px Arial";
          //        context.fillStyle = "grey";
          //        context.fillText( timeLabel , tempX, 10 );
          //        context.stroke();

        }
      }
    }

    // ======= Precipitation Level Dividers
    if (this.config.showPrecipLevels) {
      var third = Math.round(height / 3);
      context.save();
      context.strokeStyle = 'gray';
      context.setLineDash([5, 15]);
      context.lineWidth = 1;
      for (i = 1; i < 3; i++) {
        context.moveTo(0, i * third);
        context.lineTo(width, i * third);
        context.stroke();
      }
      context.restore();
    }

    // ======= 6hr tick lines
    var tickCount = Math.round(width / (stepSize * (this.config.precipitationGraphHours / this.config.precipitationGraphTickHours)));
    context.save();
    context.beginPath();
    context.strokeStyle = 'gray';
    context.lineWidth = 2;
    for (i = 1; i < tickCount; i++) {
      context.moveTo(i * (stepSize * this.config.precipitationGraphTickHours), height);
      context.lineTo(i * (stepSize * this.config.precipitationGraphTickHours), height - 7);
      context.stroke();
    }
    context.restore();

    return element;
  },

  getDayFromTime: function(time) {
    var dt = new Date(time * 1000);
    return moment.weekdaysShort(dt.getDay());
  },

  renderForecastRow: function(data, min, max) {
    var total = max - min;
    var interval = 100 / total;
    var rowMinTemp = this.roundTemp(data.temperatureMin);
    var rowMaxTemp = this.roundTemp(data.temperatureMax);

    var row = document.createElement("tr");
    row.className = "forecast-row";

    var dayTextSpan = document.createElement("span");
    dayTextSpan.className = "forecast-day"
    dayTextSpan.innerHTML = this.getDayFromTime(data.time);
    var iconClass = this.config.iconTable[data.icon];
    var icon = document.createElement("span");
    icon.className = 'wi weathericon ' + iconClass;

    var forecastBar = document.createElement("div");
    forecastBar.className = "forecast-bar";

    var minTemp = document.createElement("span");
    minTemp.innerHTML = rowMinTemp + "&deg;";
    minTemp.className = "temp min-temp";

    var maxTemp = document.createElement("span");
    maxTemp.innerHTML = rowMaxTemp + "&deg;";
    maxTemp.className = "temp max-temp";

    var bar = document.createElement("span");
    bar.className = "bar";
    bar.innerHTML = "&nbsp;"
    var barWidth = Math.round(interval * (rowMaxTemp - rowMinTemp));
    bar.style.width = barWidth + '%';

    var leftSpacer = document.createElement("span");
    leftSpacer.style.width = (interval * (rowMinTemp - min)) + "%";
    var rightSpacer = document.createElement("span");
    rightSpacer.style.width = (interval * (max - rowMaxTemp)) + "%";

    forecastBar.appendChild(leftSpacer);
    forecastBar.appendChild(minTemp);
    forecastBar.appendChild(bar);
    forecastBar.appendChild(maxTemp);
    forecastBar.appendChild(rightSpacer);

    var forecastBarWrapper = document.createElement("td");
    forecastBarWrapper.appendChild(forecastBar);

    row.appendChild(dayTextSpan);
    row.appendChild(icon);
    row.appendChild(forecastBarWrapper);

    return row;
  },

  renderWeatherForecast: function() {
    var numDays = this.config.maxDaysForecast;
    var i;

    var filteredDays =
      this.weatherData.daily.data.filter(function(d, i) {
        return (i < numDays);
      });

    var min = Number.MAX_VALUE;
    var max = -Number.MAX_VALUE;
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      min = Math.min(min, day.temperatureMin);
      max = Math.max(max, day.temperatureMax);
    }
    min = Math.round(min);
    max = Math.round(max); // this week's min & max, for graph scaling

    var display = document.createElement("table");
    display.className = "forecast";
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      var row = this.renderForecastRow(day, min, max);
      display.appendChild(row);
    }
    return display;
  },

  getLocation: function() {
    var self = this;
    navigator.geolocation.getCurrentPosition(
      function(location) {
        if (self.config.debug) {
          console.log("geolocation success", location);
        }
        self.config.latitude = location.coords.latitude;
        self.config.longitude = location.coords.longitude;
        self.geoLocationLookupSuccess = true;
      },
      function(error) {
        if (self.config.debug) {
          console.log("geolocation error", error);
        }
        self.geoLocationLookupFailed = true;
        self.updateDom(self.config.animationSpeed);
      },
      this.config.geoLocationOptions);
  },

  // Round the temperature based on tempDecimalPlaces
  roundTemp: function(temp) {
    var scalar = 1 << this.config.tempDecimalPlaces;

    temp *= scalar;
    temp = Math.round(temp);
    temp /= scalar;

    return temp;
  },

  scheduleUpdate: function(delay) {
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    setTimeout(function() {
      self.updateWeather();
    }, nextLoad);
  }

});
