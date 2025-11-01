import Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.player = null;
        this.cursors = null;
        this.map = null;
        this.worldLayer = null;
        this.playerSpeed = 150;
        this.isInitialized = false; // Add initialization flag
    }

    preload() {
        console.log('Loading assets...');
        
        // Load assets with error handling
        try {
            // First load the map JSON
            this.load.tilemapTiledJSON('map', 'assets/lasttry.tmj');
            
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
                
                // Set the world layer for collisions (assuming it's the first layer)
                if (layerName === 'Tile Layer 1' || layerName === 'shed' || layerName === 'road') {
                    this.worldLayer = createdLayer;
                    // Set collision for tiles with 'collides' property
                    createdLayer.setCollisionByProperty({ collides: true });
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
                } else {
                    createdLayer.setDepth(0);  // Default layer (base)
                }
            });
            
            if (!this.worldLayer) {
                console.warn('No valid collision layer found. Using first available layer.');
                this.worldLayer = this.map.layers[0];
            }
            
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
            
            // Set up collision with the world layer
            this.physics.add.collider(this.player, this.worldLayer);
            
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
            
            // Mark as fully initialized
            this.isInitialized = true;
            console.log('Game fully initialized and ready');
            
        } catch (error) {
            console.error('Error in create:', error);
            this.isInitialized = false;
        }
    }
    
    findSpawnPoint() {
        // Look for an object layer with spawn points
        const objectLayer = this.map.getObjectLayer('Objects');
        if (objectLayer) {
            const spawnPoint = objectLayer.objects.find(obj => obj.name === 'SpawnPoint');
            if (spawnPoint) {
                return { x: spawnPoint.x, y: spawnPoint.y };
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
            
            // Handle movement
            let moving = false;
            
            // Horizontal movement
            if (this.cursors.left.isDown) {
                this.player.setVelocityX(-this.playerSpeed);
                this.player.flipX = true;
                moving = true;
            } else if (this.cursors.right.isDown) {
                this.player.setVelocityX(this.playerSpeed);
                this.player.flipX = false;
                moving = true;
            }
            
            // Vertical movement (separate from horizontal to allow diagonal movement)
            if (this.cursors.up.isDown) {
                this.player.setVelocityY(-this.playerSpeed);
                moving = true;
            } else if (this.cursors.down.isDown) {
                this.player.setVelocityY(this.playerSpeed);
                moving = true;
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
        } catch (error) {
            console.error('Error in update:', error);
        }
    }
}
