class SaberHealthyAir {
    constructor() {
        this.geolocation = new GeolocationService();
        this.airQuality = new AirQualityService();
        
        this.isTracking = false;
        this.sessionStart = null;
        this.goodAirTime = 0;
        this.locationsChecked = 0;
        this.aqiReadings = [];
        this.history = [];
        this.lastGoodAirTime = null;
        this.updateInterval = null;
        this.timerInterval = null;
        
        this.initializeElements();
        this.bindEvents();
        this.loadHistory();
        this.updateDisplay();
        
        console.log('Saber Healthy Air initialized');
    }

    initializeElements() {
        this.elements = {
            statusCard: document.getElementById('status-card'),
            airQuality: document.getElementById('air-quality'),
            coordinates: document.getElementById('coordinates'),
            trackingStatus: document.getElementById('tracking-status'),
            startBtn: document.getElementById('start-tracking'),
            stopBtn: document.getElementById('stop-tracking'),
            refreshBtn: document.getElementById('refresh'),
            clearBtn: document.getElementById('clear-history'),
            sessionTime: document.getElementById('session-time'),
            goodAirTime: document.getElementById('good-air-time'),
            locationsChecked: document.getElementById('locations-checked'),
            avgAqi: document.getElementById('avg-aqi'),
            historyList: document.getElementById('history-list'),
            errorMessage: document.getElementById('error-message')
        };
    }

    bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.startTracking());
        this.elements.stopBtn.addEventListener('click', () => this.stopTracking());
        this.elements.refreshBtn.addEventListener('click', () => this.refreshLocation());
        this.elements.clearBtn.addEventListener('click', () => this.clearHistory());
        
        // Handle page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isTracking) {
                console.log('Page hidden, continuing tracking in background');
            } else if (!document.hidden && this.isTracking) {
                console.log('Page visible again, refreshing location');
                this.refreshLocation();
            }
        });
    }

    async startTracking() {
        try {
            this.hideError();
            this.setTrackingState(true);
            
            // Get initial position
            await this.refreshLocation();
            
            // Start periodic updates every 30 seconds
            this.updateInterval = setInterval(() => {
                if (this.isTracking) {
                    this.refreshLocation();
                }
            }, 30000);

            // Update timer every second
            this.timerInterval = setInterval(() => {
                if (this.isTracking) {
                    this.updateTimer();
                }
            }, 1000);

            console.log('Tracking started');
            
        } catch (error) {
            this.showError(error.message);
            this.setTrackingState(false);
        }
    }

    stopTracking() {
        this.setTrackingState(false);
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        this.saveHistory();
        console.log('Tracking stopped');
    }

    setTrackingState(isTracking) {
        this.isTracking = isTracking;
        
        if (isTracking) {
            this.sessionStart = Date.now();
            this.elements.startBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
            this.elements.trackingStatus.textContent = '🟢 Tracking';
            this.elements.statusCard.classList.add('tracking');
        } else {
            this.elements.startBtn.disabled = false;
            this.elements.stopBtn.disabled = true;
            this.elements.trackingStatus.textContent = '⏸️ Stopped';
            this.elements.statusCard.classList.remove('tracking');
        }
    }

    async refreshLocation() {
        try {
            const position = await this.geolocation.getCurrentPosition();
            this.updateLocationDisplay(position);
            
            const airData = await this.airQuality.getAirQuality(
                position.latitude, 
                position.longitude
            );
            
            this.updateAirQualityDisplay(airData);
            this.recordLocationData(position, airData);
            
        } catch (error) {
            this.showError(`Location error: ${error.message}`);
            console.error('Refresh location error:', error);
        }
    }

    updateLocationDisplay(position) {
        this.elements.coordinates.textContent = 
            `${position.latitude.toFixed(4)}°, ${position.longitude.toFixed(4)}°`;
    }

    updateAirQualityDisplay(airData) {
        const quality = this.airQuality.getAirQualityLevel(airData.aqi);
        
        this.elements.airQuality.textContent = `AQI: ${airData.aqi} - ${quality.label}`;
        this.updateStatusCardStyle(quality.class);
    }

    updateStatusCardStyle(qualityClass) {
        this.elements.statusCard.className = `status-card ${qualityClass}`;
        if (this.isTracking) {
            this.elements.statusCard.classList.add('tracking');
        }
    }

    recordLocationData(position, airData) {
        const quality = this.airQuality.getAirQualityLevel(airData.aqi);
        
        this.locationsChecked++;
        this.aqiReadings.push(airData.aqi);
        
        // Track good air time
        if (quality.class === 'good') {
            if (this.lastGoodAirTime === null) {
                this.lastGoodAirTime = Date.now();
            }
        } else {
            if (this.lastGoodAirTime !== null) {
                this.goodAirTime += Date.now() - this.lastGoodAirTime;
                this.lastGoodAirTime = null;
            }
        }
        
        // Add to history
        const historyItem = {
            timestamp: new Date(),
            coordinates: this.elements.coordinates.textContent,
            aqi: airData.aqi,
            quality: quality.label,
            position: position
        };
        
        this.history.unshift(historyItem);
        if (this.history.length > 100) {
            this.history.pop();
        }
        
        this.updateDisplay();
        this.updateHistory();
    }

    updateTimer() {
        if (!this.sessionStart) return;
        
        const elapsed = Date.now() - this.sessionStart;
        this.elements.sessionTime.textContent = this.formatDuration(elapsed);
        
        // Update good air time if currently in good air
        if (this.lastGoodAirTime !== null) {
            const currentGoodAirTotal = this.goodAirTime + (Date.now() - this.lastGoodAirTime);
            this.elements.goodAirTime.textContent = this.formatDuration(currentGoodAirTotal);
        } else {
            this.elements.goodAirTime.textContent = this.formatDuration(this.goodAirTime);
        }
    }

    updateDisplay() {
        this.elements.locationsChecked.textContent = this.locationsChecked;
        
        if (this.aqiReadings.length > 0) {
            const avgAqi = Math.round(
                this.aqiReadings.reduce((a, b) => a + b, 0) / this.aqiReadings.length
            );
            this.elements.avgAqi.textContent = avgAqi;
        }
        
        this.elements.goodAirTime.textContent = this.formatDuration(this.goodAirTime);
    }

    updateHistory() {
        if (this.history.length === 0) {
            this.elements.historyList.innerHTML = 
                '<div class="loading">No tracking data yet. Start tracking to begin monitoring air quality.</div>';
            return;
        }

        this.elements.historyList.innerHTML = this.history.slice(0, 50).map(item => `
            <div class="history-item">
                <span class="timestamp">${item.timestamp.toLocaleTimeString()}</span> - 
                ${item.coordinates} - 
                AQI: ${item.aqi} (${item.quality})
            </div>
        `).join('');
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        }
        return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all history and reset statistics?')) {
            this.history = [];
            this.goodAirTime = 0;
            this.locationsChecked = 0;
            this.aqiReadings = [];
            this.lastGoodAirTime = null;
            
            this.updateDisplay();
            this.updateHistory();
            this.saveHistory();
            
            console.log('History cleared');
        }
    }

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.style.display = 'block';
        
        // Auto-hide error after 10 seconds
        setTimeout(() => {
            this.hideError();
        }, 10000);
    }

    hideError() {
        this.elements.errorMessage.style.display = 'none';
    }

    saveHistory() {
        // In a production app, save to localStorage or server
        try {
            const data = {
                history: this.history,
                goodAirTime: this.goodAirTime,
                locationsChecked: this.locationsChecked,
                aqiReadings: this.aqiReadings
            };
            console.log('Would save data:', data);
        } catch (error) {
            console.error('Error saving history:', error);
        }
    }

    loadHistory() {
        // In a production app, load from localStorage or server
        try {
            console.
