import Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.player = null;
        this.cursors = null;
        this.map = null;
        this.worldLayer = null;
        this.roadLayer = null;
        this.buildingLayer = null;
        this.playerSpeed = 150;
        this.isInitialized = false; // Add initialization flag
        
        // Define road tile IDs (tiles player can walk on)
        this.roadTiles = [469, 434, 461, 407, 462, 463, 464, 435, 436, 437, 470];
        // Bicycle tile ID for spawn point
        this.bicycleTileId = 470;
        
        // Gate button properties
        this.gateButton = null; // Play gate button background
        this.gateButtonText = null; // Play gate button text
        this.triggerZones = []; // Array of trigger zone objects from the map
        this.triggerProximity = 100; // Distance in pixels to show button
        this.lastTriggerCheck = {}; // Track trigger zone entry/exit
        this.lastTriggerWarning = null; // Track warning spam
        this.lastPositionLog = null; // Track position logging spam
        this.lastDistanceLog = null; // Track distance logging spam
        this.closestZoneDistance = null; // Track closest zone distance
        this.lastZoneCheck = null; // Track zone check logging
        this.currentTriggerZone = null; // Currently active trigger zone
    }

    preload() {
        console.log('Loading assets...');
        
        // Load assets with error handling
        try {
            // First load the map JSON
            this.load.tilemapTiledJSON('map', 'assets/llasttry.tmj');
            
            // Load the tileset image - try with both names to be safe
            this.load.image('tileset', 'assets/tilemap_packed.png');
            this.load.image('tilemap_packed', 'assets/tilemap_packed.png');
            
            // Load player as a simple sprite
            this.load.image('player', 'assets/player.png');
            
            // Add load complete callback
            this.load.on('complete', () => {
                console.log('All assets loaded successfully');
                // Log all loaded textures for debugging
                console.log('Loaded textures:', this.textures.getTextureKeys());
            });
            
            // Add error handler
            this.load.on('loaderror', (file) => {
                console.error('Error loading file:', file);
                console.error('Error details:', file.error);
            });
            
        } catch (error) {
            console.error('Error in preload:', error);
        }
    }

    create() {
        console.log('Creating game...');
        this.isInitialized = false; // Ensure we start uninitialized
        
        try {
            // Create the tilemap
            this.map = this.make.tilemap({ key: 'map' });
            
            if (!this.map) {
                throw new Error('Failed to create tilemap');
            }
            
            // Log map data for debugging
            console.log('Map created, width:', this.map.widthInPixels, 'height:', this.map.heightInPixels);
            
            // Log available tilesets for debugging
            console.log('Available tilesets:', this.map.tilesets);
            
            if (!this.map.tilesets || this.map.tilesets.length === 0) {
                throw new Error('No tilesets found in the map');
            }
            
            // Try to load the tileset
            let tileset = null;
            
            // First, try to use the first tileset from the map
            if (this.map.tilesets && this.map.tilesets.length > 0) {
                const tilesetData = this.map.tilesets[0];
                console.log('Tileset data:', tilesetData);
                
                // Try with the name from the tileset data
                if (tilesetData.name) {
                    console.log(`Trying to load tileset with name: ${tilesetData.name}`);
                    tileset = this.map.addTilesetImage(tilesetData.name, 'tileset');
                }
                
                // If that didn't work, try with the image name (without path and extension)
                if (!tileset && tilesetData.image) {
                    const imageName = tilesetData.image.split('/').pop().split('.')[0];
                    console.log(`Trying to load tileset with image name: ${imageName}`);
                    tileset = this.map.addTilesetImage(tilesetData.name || 'tileset', imageName);
                }
            }
            
            // If still no tileset, try the default name
            if (!tileset) {
                console.warn('Falling back to default tileset name');
                tileset = this.map.addTilesetImage('tileset', 'tilemap_packed');
            }
            
            // If we still don't have a tileset, throw an error
            if (!tileset) {
                console.error('Available textures:', this.textures.getTextureKeys());
                throw new Error('Failed to load tileset. Please check the tileset name in your Tiled map.');
            }
            
            // Create all layers from the map
            console.log('Available layers:', this.map.layers.map(l => l.name || 'unnamed'));
            
            // Create each layer
            this.map.layers.forEach(layer => {
                const layerName = layer.name || 'unnamed';
                console.log(`Creating layer: ${layerName}`);
                
                // Create the layer
                const createdLayer = this.map.createLayer(layerName, tileset, 0, 0);
                
                if (!createdLayer) {
                    console.warn(`Failed to create layer: ${layerName}`);
                    return;
                }
                
                // Store road layer reference
                if (layerName === 'ROADS') {
                    this.roadLayer = createdLayer;
                    this.roadLayer.setDepth(1);
                }
                
                // Store building layer and set collision
                if (layerName === 'BUILDIGS' || layerName === 'Shed and win') {
                    if (!this.buildingLayer) {
                        this.buildingLayer = createdLayer;
                    }
                    // Set collision for all non-zero tiles in building layers
                    createdLayer.setCollisionByExclusion([-1, 0]);
                    createdLayer.setDepth(5);
                }
                
                // Set collision for sidewalks and green areas
                if (layerName === 'sidewalks' || layerName === 'GReen') {
                    createdLayer.setCollisionByExclusion([-1, 0]);
                    createdLayer.setDepth(3);
                }
                
                // Assets layer (obstacles like poles, traffic lights, etc.)
                if (layerName === 'Assets') {
                    createdLayer.setCollisionByExclusion([-1, 0]);
                    createdLayer.setDepth(6);
                }
                
                // Set depth for proper layering (adjust as needed)
                if (layerName === 'Tile Layer 5') {
                    createdLayer.setDepth(10); // Top layer (like UI elements or foreground)
                } else if (layerName === 'Tile Layer 4') {
                    createdLayer.setDepth(5);  // Middle layer (like decorations)
                } else if (layerName === 'road') {
                    createdLayer.setDepth(2);  // Road layer
                } else if (layerName === 'shed') {
                    createdLayer.setDepth(1);  // Shed layer (background)
                } else if (!createdLayer.depth) {
                    createdLayer.setDepth(0);  // Default layer (base)
                }
            });
            
            // Use building layer as world layer for collisions
            if (!this.buildingLayer && this.map.layers.length > 0) {
                console.warn('No building layer found. Using first available layer.');
                this.buildingLayer = this.map.layers[0];
            }
            
            this.worldLayer = this.buildingLayer;
            
            // Set up physics world bounds based on the map size
            this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
            
            // Create player
            // Find spawn point or use default
            const spawnPoint = this.findSpawnPoint() || { 
                x: Math.floor(this.map.widthInPixels / 2), 
                y: Math.floor(this.map.heightInPixels / 2) 
            };
            
            console.log('Creating player at:', spawnPoint);
            this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, 'player');
            
            if (!this.player) {
                throw new Error('Failed to create player sprite');
            }
            
            this.player.setCollideWorldBounds(true);
            
            // Set player to topmost layer (higher than all map layers)
            this.player.setDepth(100);
            
            // Set up collision with all obstacle layers
            this.map.layers.forEach(layer => {
                const layerName = layer.name || 'unnamed';
                const createdLayer = this.map.getLayer(layerName).tilemapLayer;
                
                // Add colliders for all non-road layers
                if (layerName !== 'ROADS' && createdLayer) {
                    this.physics.add.collider(this.player, createdLayer);
                }
            });
            
            // Set up camera to follow player
            this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
            this.cameras.main.startFollow(this.player);
            this.cameras.main.setZoom(2);
            
            console.log('Player created successfully');
            
            // Set up controls
            this.cursors = this.input.keyboard.addKeys({
                up: Phaser.Input.Keyboard.KeyCodes.W,
                down: Phaser.Input.Keyboard.KeyCodes.S,
                left: Phaser.Input.Keyboard.KeyCodes.A,
                right: Phaser.Input.Keyboard.KeyCodes.D
            });
            
            // Add arrow keys as well
            this.cursors.up = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
            this.cursors.down = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
            this.cursors.left = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
            this.cursors.right = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
            
            // Create animations
            this.createAnimations();
            
            // Extract trigger zones from the map
            this.extractTriggerZones();
            
            // Create gate button (it will be hidden until player enters trigger zone)
            this.createGateButton();
            
            // Mark as fully initialized
            this.isInitialized = true;
            console.log('Game fully initialized and ready');
            
        } catch (error) {
            console.error('Error in create:', error);
            this.isInitialized = false;
        }
    }
    
    findSpawnPoint() {
        // Find a bicycle tile (tile 470) on the ROADS layer
        if (!this.roadLayer) {
            console.warn('Road layer not found, using default spawn point');
            return null;
        }
        
        // Search for bicycle tiles in the road layer
        const bicyclePositions = [];
        
        for (let y = 0; y < this.map.height; y++) {
            for (let x = 0; x < this.map.width; x++) {
                const tile = this.roadLayer.getTileAt(x, y);
                if (tile && tile.index === this.bicycleTileId) {
                    // Convert tile coordinates to world coordinates (center of tile)
                    bicyclePositions.push({
                        x: (x * this.map.tileWidth) + (this.map.tileWidth / 2),
                        y: (y * this.map.tileHeight) + (this.map.tileHeight / 2)
                    });
                }
            }
        }
        
        if (bicyclePositions.length > 0) {
            // Return the first bicycle position found
            console.log(`Found ${bicyclePositions.length} bicycle spawn points`);
            return bicyclePositions[0];
        }
        
        // Fallback: find any road tile
        for (let y = 0; y < this.map.height; y++) {
            for (let x = 0; x < this.map.width; x++) {
                const tile = this.roadLayer.getTileAt(x, y);
                if (tile && this.roadTiles.includes(tile.index)) {
                    console.log('No bicycle tile found, using first road tile');
                    return {
                        x: (x * this.map.tileWidth) + (this.map.tileWidth / 2),
                        y: (y * this.map.tileHeight) + (this.map.tileHeight / 2)
                    };
                }
            }
        }
        
        return null;
    }
    
    createAnimations() {
        try {
            // Since we're using a single image, we'll just create a single frame animation
            this.anims.create({
                key: 'idle',
                frames: [{ key: 'player', frame: 0 }],
                frameRate: 1,
                repeat: -1
            });
            
            // Set the default animation
            if (this.player) {
                this.player.anims.play('idle', true);
            }
        } catch (error) {
            console.error('Error creating animations:', error);
        }
    }
    
    extractTriggerZones() {
        try {
            console.log('Extracting trigger zones from map...');
            
            // Access the raw map JSON data from the cache
            // Phaser stores the raw map data in cache.tilemap
            if (!this.cache.tilemap.exists('map')) {
                console.error('Map not found in cache!');
                return;
            }
            
            const rawMapData = this.cache.tilemap.get('map');
            console.log('Raw map data:', rawMapData);
            
            let triggerLayer = null;
            
            // Access the data property which contains the raw JSON
            const mapData = rawMapData.data || rawMapData;
            
            console.log('Map data structure:', {
                hasLayers: !!mapData.layers,
                layerCount: mapData.layers ? mapData.layers.length : 0
            });
            
            if (mapData && mapData.layers) {
                // Find the object layer with triggering property
                for (const layer of mapData.layers) {
                    console.log('Checking layer:', {
                        name: layer.name,
                        type: layer.type,
                        hasObjects: !!layer.objects,
                        hasProperties: !!layer.properties,
                        objectCount: layer.objects ? layer.objects.length : 0
                    });
                    
                    if (layer.type === 'objectgroup') {
                        // Check if this layer has the triggering property
                        if (layer.properties) {
                            console.log('Layer properties:', layer.properties);
                            const hasTriggering = layer.properties.some(prop => {
                                const match = prop.name === 'triggering' && prop.value === true;
                                console.log('Property check:', prop.name, prop.value, 'matches:', match);
                                return match;
                            });
                            
                            if (hasTriggering && layer.objects) {
                                triggerLayer = layer;
                                console.log('FOUND TRIGGER LAYER!', layer);
                                break;
                            }
                        }
                    }
                }
            }
            
            if (!triggerLayer || !triggerLayer.objects) {
                console.warn('No triggering layer found in map');
                if (mapData && mapData.layers) {
                    console.log('Available layers:', mapData.layers.map(l => ({
                        name: l.name,
                        type: l.type || 'unknown',
                        hasObjects: !!(l.objects && Array.isArray(l.objects)),
                        hasProperties: !!(l.properties && l.properties.length > 0),
                        properties: l.properties ? l.properties.map(p => `${p.name}=${p.value}`) : []
                    })));
                }
                return;
            }
            
            console.log(`Found trigger layer: ${triggerLayer.name || 'unnamed'} with ${triggerLayer.objects.length} objects`);
            
            // Extract all objects from the triggering layer
            this.triggerZones = triggerLayer.objects.map((obj, index) => {
                // Note: Tiled object coordinates are in pixels, relative to the map
                const zone = {
                    x: obj.x + (obj.width / 2), // Center x
                    y: obj.y + (obj.height / 2), // Center y
                    width: obj.width,
                    height: obj.height,
                    bounds: {
                        left: obj.x,
                        right: obj.x + obj.width,
                        top: obj.y,
                        bottom: obj.y + obj.height
                    },
                    raw: obj // Keep raw object data for debugging
                };
                console.log(`Trigger zone ${index}:`, {
                    name: obj.name || 'unnamed',
                    x: zone.x.toFixed(1),
                    y: zone.y.toFixed(1),
                    width: zone.width.toFixed(1),
                    height: zone.height.toFixed(1),
                    bounds: zone.bounds,
                    rawObj: obj
                });
                return zone;
            });
            
            console.log(`✓ Total trigger zones extracted: ${this.triggerZones.length}`);
            console.log('All trigger zones:', this.triggerZones);
            
            // Increase proximity threshold if zones are very small
            if (this.triggerZones.length > 0) {
                const avgZoneSize = this.triggerZones.reduce((sum, z) => sum + (z.width + z.height) / 2, 0) / this.triggerZones.length;
                if (avgZoneSize < this.triggerProximity) {
                    console.log(`Average zone size (${avgZoneSize.toFixed(1)}) is smaller than proximity threshold (${this.triggerProximity}). Using zone size as threshold.`);
                    this.triggerProximity = Math.max(avgZoneSize * 1.5, 50); // Use 1.5x average zone size or 50px minimum
                }
                console.log('Final proximity threshold:', this.triggerProximity);
            }
        } catch (error) {
            console.error('Error extracting trigger zones:', error);
            console.error('Stack trace:', error.stack);
        }
    }
    
    createGateButton() {
        try {
            // Create a message box style button
            // Position will be set relative to trigger zone when shown
            const buttonWidth = 90; // Reduced by 50%
            const buttonHeight = 25; // Reduced by 50%
            
            // Create message box background with rounded corners effect
            this.gateButton = this.add.rectangle(
                0, // Position will be set when shown
                0,
                buttonWidth,
                buttonHeight,
                0x2d2d2d, // Dark background
                0.95 // Slightly transparent
            );
            
            // Create border for message box effect
            this.gateButtonBorder = this.add.graphics();
            this.gateButtonBorder.lineStyle(2, 0xffffff, 1); // Reduced border width from 3 to 2
            this.gateButtonBorder.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 5); // Reduced corner radius from 10 to 5
            
            // Create button text
            this.gateButtonText = this.add.text(
                0,
                0,
                'wanna play a quiz',
                {
                    fontSize: '10px', // Reduced from 16px to 8px, but using 10px for readability
                    fontFamily: 'Arial, sans-serif',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    align: 'center',
                    wordWrap: { width: buttonWidth - 10 } // Adjusted for smaller button
                }
            );
            
            // Set button properties
            this.gateButton.setDepth(1000);
            this.gateButton.setScrollFactor(1); // Scroll with camera to follow trigger zone
            this.gateButton.setVisible(false); // Initially hidden
            this.gateButton.setInteractive({ useHandCursor: true });
            
            // Set border properties
            this.gateButtonBorder.setDepth(1001);
            this.gateButtonBorder.setScrollFactor(1); // Scroll with camera
            this.gateButtonBorder.setVisible(false);
            
            // Set text properties
            this.gateButtonText.setDepth(1002);
            this.gateButtonText.setScrollFactor(1); // Scroll with camera
            this.gateButtonText.setOrigin(0.5, 0.5);
            this.gateButtonText.setVisible(false);
            this.gateButtonText.setInteractive({ useHandCursor: true });
            
            // Group button components for easier manipulation
            this.gateButtonComponents = [this.gateButton, this.gateButtonBorder, this.gateButtonText];
            
            // Add hover effects
            this.gateButton.on('pointerover', () => {
                this.gateButton.setFillStyle(0x3d3d3d, 1.0);
                this.gateButton.setScale(1.05);
                this.gateButtonText.setScale(1.05);
                this.gateButtonBorder.setScale(1.05);
            });
            
            this.gateButton.on('pointerout', () => {
                this.gateButton.setFillStyle(0x2d2d2d, 0.95);
                this.gateButton.setScale(1.0);
                this.gateButtonText.setScale(1.0);
                this.gateButtonBorder.setScale(1.0);
            });
            
            // Add click handler - THIS IS WHERE YOU CAN PROGRAM THE BUTTON ACTION
            this.gateButton.on('pointerdown', () => {
                console.log('Gate button clicked!');
                this.onGateButtonClick();
            });
            
            this.gateButtonText.on('pointerdown', () => {
                console.log('Gate button text clicked!');
                this.onGateButtonClick();
            });
            
            console.log('✓ Gate button (message box) created');
        } catch (error) {
            console.error('Error creating gate button:', error);
            console.error('Stack:', error.stack);
        }
    }
    
    // Programmable button action - customize this function
    onGateButtonClick() {
        console.log('Gate button action triggered!');
        console.log('Current trigger zone:', this.currentTriggerZone);
        
        // Open the quiz page in a new window/tab
        window.open('quiz.html', '_blank', 'width=800,height=600');
        
        // Hide the button after clicking
        this.hideGateButton();
    }
    
    showGateButton() {
        if (!this.gateButton) {
            this.createGateButton();
        }
        
        if (!this.currentTriggerZone || !this.currentTriggerZone.zone) {
            console.warn('No current trigger zone to position button');
            return;
        }
        
        if (this.gateButton && this.gateButtonText && this.gateButtonBorder) {
            // Position button near the trigger zone, above it
            const zone = this.currentTriggerZone.zone;
            
            // Calculate button position in world coordinates
            // Position above the trigger zone center
            const buttonWorldX = zone.x;
            const buttonWorldY = zone.bounds.top - 40; // 40 pixels above the zone
            
            // Position all button components in world space
            this.gateButton.setPosition(buttonWorldX, buttonWorldY);
            this.gateButton.setVisible(true);
            this.gateButton.setDepth(1000);
            
            this.gateButtonBorder.setPosition(buttonWorldX, buttonWorldY);
            this.gateButtonBorder.setVisible(true);
            this.gateButtonBorder.setDepth(1001);
            
            this.gateButtonText.setPosition(buttonWorldX, buttonWorldY);
            this.gateButtonText.setVisible(true);
            this.gateButtonText.setDepth(1002);
            
            console.log('Gate button shown at world position:', buttonWorldX, buttonWorldY, 'near trigger zone:', this.currentTriggerZone.zone);
        }
    }
    
    hideGateButton() {
        if (this.gateButton) {
            this.gateButton.setVisible(false);
        }
        if (this.gateButtonBorder) {
            this.gateButtonBorder.setVisible(false);
        }
        if (this.gateButtonText) {
            this.gateButtonText.setVisible(false);
        }
    }
    
    checkProximityToTriggers() {
        if (!this.player) {
            return null; // Return null instead of false to track which zone
        }
        
        if (this.triggerZones.length === 0) {
            // Only log once every few seconds to avoid spam
            if (!this.lastTriggerWarning || Date.now() - this.lastTriggerWarning > 5000) {
                console.warn('No trigger zones available for proximity check');
                console.log('Trigger zones array:', this.triggerZones);
                this.lastTriggerWarning = Date.now();
            }
            return null;
        }
        
        // Get player world coordinates
        const playerX = this.player.x;
        const playerY = this.player.y;
        
        // Debug: Log player position periodically (only every 2 seconds to avoid spam)
        if (!this.lastPositionLog || Date.now() - this.lastPositionLog > 2000) {
            console.log('Player position:', { x: playerX, y: playerY });
            console.log('Total trigger zones:', this.triggerZones.length);
            this.lastPositionLog = Date.now();
        }
        
        // Check if player is within proximity of any trigger zone
        for (let i = 0; i < this.triggerZones.length; i++) {
            const zone = this.triggerZones[i];
            
            // Calculate distance from player to center of trigger zone
            const dx = playerX - zone.x;
            const dy = playerY - zone.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check if player is within the trigger zone bounds
            const inBounds = 
                playerX >= zone.bounds.left &&
                playerX <= zone.bounds.right &&
                playerY >= zone.bounds.top &&
                playerY <= zone.bounds.bottom;
            
            // Check if player is within proximity distance (expanded check)
            const inProximity = distance <= this.triggerProximity;
            
            // Debug: Log distance for closest zone
            if (i === 0 || distance < this.closestZoneDistance || !this.closestZoneDistance) {
                this.closestZoneDistance = distance;
                if (!this.lastDistanceLog || Date.now() - this.lastDistanceLog > 1000) {
                    console.log(`Closest trigger zone ${i}:`, {
                        playerPos: { x: playerX.toFixed(1), y: playerY.toFixed(1) },
                        zoneCenter: { x: zone.x.toFixed(1), y: zone.y.toFixed(1) },
                        zoneBounds: zone.bounds,
                        distance: distance.toFixed(1),
                        threshold: this.triggerProximity,
                        inBounds,
                        inProximity
                    });
                    this.lastDistanceLog = Date.now();
                }
            }
            
            if (inBounds || inProximity) {
                // Log only once when entering
                if (!this.lastTriggerCheck || !this.lastTriggerCheck[i] || this.lastTriggerCheck[i] === false) {
                    console.log(`✓ PLAYER ENTERED TRIGGER ZONE ${i}!`, {
                        playerPos: { x: playerX.toFixed(2), y: playerY.toFixed(2) },
                        zoneCenter: { x: zone.x.toFixed(2), y: zone.y.toFixed(2) },
                        zoneBounds: zone.bounds,
                        distance: distance.toFixed(2),
                        inBounds,
                        inProximity,
                        proximityThreshold: this.triggerProximity
                    });
                    if (!this.lastTriggerCheck) {
                        this.lastTriggerCheck = {};
                    }
                    this.lastTriggerCheck[i] = true;
                }
                // Store current trigger zone
                this.currentTriggerZone = { index: i, zone: zone };
                return zone; // Return the zone object
            } else {
                if (this.lastTriggerCheck && this.lastTriggerCheck[i]) {
                    console.log(`Player left trigger zone ${i}`);
                    this.lastTriggerCheck[i] = false;
                }
            }
        }
        
        // Player not in any zone
        this.currentTriggerZone = null;
        return null;
    }
    
    update() {
        // Don't update if not fully initialized
        if (!this.isInitialized) {
            return;
        }
        
        try {
            // Safety check - should not happen if isInitialized is set correctly
            if (!this.player || !this.player.body) {
                console.warn('Player not properly initialized, but isInitialized is true');
                this.isInitialized = false; // Reset flag to prevent error spam
                return;
            }

            // Reset velocity
            this.player.setVelocity(0);
            
            // Check if cursors are initialized
            if (!this.cursors || !this.cursors.left || !this.cursors.right || !this.cursors.up || !this.cursors.down) {
                console.warn('Cursors not properly initialized');
                return;
            }
            
            // Handle movement with road restriction
            let moving = false;
            let velocityX = 0;
            let velocityY = 0;
            
            // Calculate intended movement
            if (this.cursors.left.isDown) {
                velocityX = -this.playerSpeed;
                this.player.flipX = true;
                moving = true;
            } else if (this.cursors.right.isDown) {
                velocityX = this.playerSpeed;
                this.player.flipX = false;
                moving = true;
            }
            
            if (this.cursors.up.isDown) {
                velocityY = -this.playerSpeed;
                moving = true;
            } else if (this.cursors.down.isDown) {
                velocityY = this.playerSpeed;
                moving = true;
            }
            
            // Check if the intended position is on a road tile
            if (moving && this.roadLayer) {
                // Calculate future position
                const futureX = this.player.x + (velocityX * 0.016); // Approximate next frame position
                const futureY = this.player.y + (velocityY * 0.016);
                
                // Convert to tile coordinates
                const tileX = Math.floor(futureX / this.map.tileWidth);
                const tileY = Math.floor(futureY / this.map.tileHeight);
                
                // Get the tile at the future position
                const tile = this.roadLayer.getTileAt(tileX, tileY);
                
                // Only allow movement if on a road tile
                if (tile && this.roadTiles.includes(tile.index)) {
                    this.player.setVelocityX(velocityX);
                    this.player.setVelocityY(velocityY);
                } else {
                    // Stop movement if trying to move off road
                    this.player.setVelocity(0);
                    moving = false;
                }
            } else if (!moving) {
                this.player.setVelocity(0);
            }
            
            // Play idle animation when not moving
            if (this.player.anims) {
                if (moving) {
                    // If we had animations, we would play them here
                    // For now, just make sure the sprite is visible
                    this.player.setAlpha(1);
                } else {
                    this.player.anims.play('idle', true);
                }
            }
            
            // Check proximity to trigger zones and show/hide gate button
            if (this.triggerZones.length > 0) {
                const currentZone = this.checkProximityToTriggers();
                
                if (currentZone) {
                    // Player is in trigger zone, show gate button
                    // Update button position if zone changed or button not visible
                    if (!this.gateButton || !this.gateButton.visible) {
                        console.log('Player in trigger zone - showing gate button');
                        this.showGateButton();
                    } else {
                        // Update button position to follow trigger zone (if needed)
                        this.showGateButton();
                    }
                } else {
                    // Player left trigger zone, hide gate button
                    if (this.gateButton && this.gateButton.visible) {
                        console.log('Player left trigger zone - hiding gate button');
                        this.hideGateButton();
                    }
                }
            } else {
                // Debug: Log if no trigger zones available
                if (!this.lastZoneCheck || Date.now() - this.lastZoneCheck > 5000) {
                    console.warn('No trigger zones available in update loop. Zones count:', this.triggerZones.length);
                    this.lastZoneCheck = Date.now();
                }
            }
            
        } catch (error) {
            console.error('Error in update:', error);
        }
    }
}
