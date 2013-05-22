function hex(v) {
	return v.toString(16);
}

var CHIP8 = function() {
	// CONSTANTS
	this.PROGRAM_START_ADDR = 0x200;

	// V0 .. VF Data Registers
	// VF is used as a carry flag (or collision flag in graphic mode)
	this.V = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

	// Address Register
	this.I = 0;

	// Screen Mode (CHIP-8 / SCHIP : SCHIP is NOT SUPPORTED)
	this.bHigh = false;

	// PGM Count
	this.PC = 0;

	// Stack Pointer
	this.SP = 0;

	// timers
	this.sound_timer = 0;
	this.delay_timer = 0;

	// Stack
	this.stack = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

	// RAM
	this.RAM = new Array();

	/* "Physical" flags */
	this.keyPressed = null;

	/* States */
	this.isRunning = false;
	this.isWaiting = false;
	this.isPaused  = false;

	/* timer stuff */
	this.totalTime = 0;

	// Screen
	this.screen = new (function() {
		this.width = 0;
		this.height = 0;
		this.pixelSize = 0;

		this.pixels = new Array();

		this.backColor = "#ccc";
		this.frontColor = "#404040";

		this.pixelScale = 2;

		var thisScreen = this;

		this.init = function() {

			document.getElementById('screen').innerHTML = "";

			thisScreen._oPixelCtr = document.createElement("div");
			thisScreen._oPixelCtr.style.position = "absolute";
			thisScreen._oPixelCtr.style.width = thisScreen.width * thisScreen.pixelSize * thisScreen.pixelScale;
			thisScreen._oPixelCtr.style.height = thisScreen.height * thisScreen.pixelSize * thisScreen.pixelScale;
			thisScreen._oPixelCtr.style.left = 0;
			thisScreen._oPixelCtr.style.top = 0;

			document.getElementById('screen').appendChild(this._oPixelCtr);

			thisScreen.pixels = new Array();
			for (var x=0;x<thisScreen.width;x++) {
				thisScreen.pixels[x] = new Array();
				var col = thisScreen.pixels[x];
				var l = x * thisScreen.pixelSize;
				for (var y=0;y<thisScreen.height;y++) {
					var p = document.createElement("span")
					col[y] = p;
					var s = p.style;
					s.position = "absolute";
					s.overflow = "hidden";
					s.color = thisScreen.backColor;
					s.left = l * thisScreen.pixelScale;
					s.top = y * thisScreen.pixelSize * thisScreen.pixelScale;
					s.width = thisScreen.pixelSize * thisScreen.pixelScale;
					s.height = thisScreen.pixelSize * thisScreen.pixelScale;
					s.fontFamily = "terminal";
					//s.fontWeight = "bold";
					s.fontSize = "8px";
					p.innerHTML = "0";
					p.onselectstart = function(){return false;}
					thisScreen._oPixelCtr.appendChild(p);
				}
			}
		}

		this.setSize = function(w, h, ps) {
			thisScreen.width = w;
			thisScreen.height = h;
			thisScreen.pixelSize = ps;
		}

		this.clear = function() {
			console.log('clear');
			for (var x=0;x<thisScreen.pixels.length;x++) {
				var col = thisScreen.pixels[x];
				for (var y=0;y<col.length;y++) {
					var c = col[y];
					c.innerHTML = '0';
					c.style.color = thisScreen.backColor;
					c.style.backgroundColor = thisScreen.backColor;
				}
			}
		}

		this.drawPixel = function(x, y) {
			var px = x;
			var py = y;

			var p = thisScreen.getPixel(px,py);

			if (p) {
				if (p.innerHTML = '0') {
					p.style.color = thisScreen.frontColor;
					p.style.backgroundColor = thisScreen.frontColor;
					p.innerHTML = '1';
					return 1;
				} else {
					p.style.color = thisScreen.backColor;
					p.style.backgroundColor = thisScreen.backColor;
					p.innerHTML = '0';
					return 1;
				}
			}
		}

		this.getPixel = function(x, y) {
			while (x > thisScreen.width-1) x -= thisScreen.width;
			while (x < 0) x += thisScreen.width;

			while (y > thisScreen.height-1) y -= thisScreen.height;
			while (y < 0) y += thisScreen.height;

			if (!thisScreen.pixels[x]) {
				console.log("ERR: Tried to get invalid pixel x:" + x + " y:" + y + "\r\n");
				return;
			}

			if (!thisScreen.pixels[x][y]) {
				console.log("ERR: Tried to get invalid pixel x:" + x + " y:" + y + "\r\n");
				return;
			}

			var p = thisScreen.pixels[x][y];
			return p;
		}
	})();

	/* Helpers */
	this.checkKeyPressed = function(op2) {
		if (this.keyPressed == 0) {
			var me = this;
			setTimeout( function() {
				me.checkKeyPressed();
			}, 5);
		} else {
			this.V[op2] = this.keyPressed;
			this.isWaiting = false;
		}
	}

	/* Initiators */
	this.reset = function() {
		this.init_RAM();
		this.PC = this.PROGRAM_START_ADDR;
		this.screen.setSize(64, 32, 4);
	}

	this.init_RAM = function()
	{
		// zero RAM
		for(var i=0;i<0x2000;i++) {
			this.RAM[i] = 0;
		}

		// load hex font
		var aFont = new Array(
					0xF0, 0x90, 0x90, 0x90, 0xF0,	// 0 
					0x20, 0x60, 0x20, 0x20, 0x70,	// 1
					0xF0, 0x10, 0xF0, 0x80, 0xF0,	// 2
					0xF0, 0x10, 0xF0, 0x10, 0xF0,	// 3
					0x90, 0x90, 0xF0, 0x10, 0x10, 	// 4
					0xF0, 0x80, 0xF0, 0x10, 0xF0,	// 5
					0xF0, 0x80, 0xF0, 0x90, 0xF0,	// 6
					0xF0, 0x10, 0x20, 0x40, 0x40,	// 7
					0xF0, 0x90, 0xF0, 0x90, 0xF0,	// 8
					0xF0, 0x90, 0xF0, 0x10, 0xF0,	// 9
					0xF0, 0x90, 0xF0, 0x90, 0x90,	// A
					0xE0, 0x90, 0xE0, 0x90, 0xE0,	// B
					0xF0, 0x80, 0x80, 0x80, 0xF0,	// C
					0xE0, 0x90, 0x90, 0x90, 0xE0,	// D
					0xF0, 0x80, 0xF0, 0x80, 0xF0,	// E
					0xF0, 0x80, 0xF0, 0x80, 0x80	// F
				);
		for (var i=0;i<aFont.length;i++)
			this.RAM[i] = aFont[i];

	}

	/* Internal chips Emulation */
	this.startCPU = function() {
		if (this._bRunning) return;

		this.totalTime = new Date().getTime();

		this.isRunning = true;
		this.runTimer();

		var me = this;
		setTimeout(function() {
			me.runCPU();
		}, 1);
	}

	this.runTimer = function() {
		if (!(this.isPaused || this.isWaiting)) {
			if (this.delay_timer > 0) this.delay_timer--;
			if (this.sound_timer > 0) this.sound_timer--;
		}
		var me = this;
		setTimeout(function() {
			me.runTimer();
		}, 17);
	}

	this.runCPU = function() {
		var p = true;
		for (var i=0;i<10 && p;i++) {
			if (!(this.isPaused || this.isWaiting)) {
				p = this.process();
			}
		}

		var me = this;
		setTimeout( function() {
			me.runCPU();
		}, 1);
	}

	this.loadROM = function(aBytes)
	{
		this.reset();

		for (var a=0;a<aBytes.length;a++)
			this.RAM[this.PROGRAM_START_ADDR + a] = aBytes[a];

		this.screen.init();
		this.startCPU();
	}

	/* Process Opcodes */
	this.process = function() {

		var opcode = [
			(this.RAM[this.PC] & 0xF0) / 16,
			this.RAM[this.PC] & 0xF,
			(this.RAM[this.PC + 1] & 0xF0) / 16,
			this.RAM[this.PC + 1] & 0xF
		];

		this.PC += 2;

		switch( opcode[0] ) {
			case 0x0:
				switch( opcode[2] ) {
					case 0xC:
						/* Scroll down nl lines */
						/* NOT SUPPORTED */
					break;
					case 0xE:
						switch( opcode[3] ) {
							case 0x0:
								this.screen.clear();
							break;
							case 0xE:
								this.PC = this.stack[--this.SP];
							break;
						}
					break;
					case 0xF:
						switch( opcode[3] ) {
							case 0xB:
								/* Scroll 4 pixels right */
								/* NOT SUPPORTED */
							break;
							case 0xC:
								/* Scroll 4 pixels left */
								/* NOT SUPPORTED */
							break;
							case 0xD:
								/* Quit emulator */
								/* NOT SUPPORTED */
							break;
							case 0xE:
								/* Set CHIP-8 Graphic mode */
								this.screen.setSize(64, 32, 4);
								this.bHigh = false;
							break;
							case 0xF:
								/* Set SCHIP graphic mode: Implemented but NOT SUPPORTED */
								alert("SChip-8 is not supported, high mode won't work!");
								this.screen.setSize(128, 64, 2);
								this.bHigh = true;
							break;
						}
					break;
				}
			break;
			case 0x1:
				this.PC = (opcode[1] << 8) + (opcode[2] << 4) + opcode[3];
			break;
			case 0x2:
				this.stack[this.SP] = this.PC;
				this.SP ++;
				this.PC = (opcode[1] << 8) + (opcode[2] << 4) + opcode[3];
			break;
			case 0x3:
				if(this.V[opcode[1]] == ((opcode[2] << 4) + opcode[3]))
					this.PC += 2;
			break;
			case 0x4:
				if(this.V[opcode[1]] != ((opcode[2] << 4) + opcode[3]))
					this.PC += 2;
			break;
			case 0x5:
				if(this.V[opcode[1]] == this.V[opcode[2]])
					this.PC += 2;
			break;
			case 0x6:
				this.V[opcode[1]] = ((opcode[2] << 4) + opcode[3]);
			break;
			case 0x7:
				var val = (this.V[opcode[1]] + ((opcode[2] << 4) + opcode[3]));
				if(val > 255) val -= 256;
				this.V[opcode[1]] = val;
			break;
			case 0x8:
				switch( opcode[3] ) {
					case 0x0:
						this.V[ opcode[1] ] = this.V[ opcode[2] ];
					break;
					case 0x1:
						this.V[ opcode[1] ] = this.V[ opcode[1] ] | this.V[ opcode[2] ];
					break;
					case 0x2:
						this.V[ opcode[1] ] = this.V[ opcode[1] ] & this.V[ opcode[2] ];
					break;
					case 0x3:
						this.V[ opcode[1] ] = this.V[ opcode[1] ] ^ this.V[ opcode[2] ];
					break;
					case 0x4:
						var val = this.V[ opcode[1] ] + this.V[ opcode[2] ];
						if (val > 255) {
							val -= 256;
							this.V[0xF] = 1;
						} else this.V[0xF] = 0;
						this.V[ opcode[1] ] = val;
					break;
					case 0x5:
						var val = this.V[ opcode[1] ] - this.V[ opcode[2] ];
						this.V[0xF] = val > 0 ? 1 : 0;
						if (val < 0) val += + 256;
						this.V[ opcode[1] ] = val;
					break;
					case 0x6:
						if (this.V[ opcode[1] ] & 1)
							this.V[0xF] = 1;
						else
							this.V[0xF] = 0;
						this.V[ opcode[1] ] = this.V[ opcode[1] ] / 2;
					break;
					case 0x7:
						var val = this.V[ opcode[2] ] - this.V[ opcode[1] ];
						this.V[0xF] = val > 0 ? 1 : 0;
						if (val < 0) val += 256;
						this.V[ opcode[1] ] = val;
					break;
					case 0xE:
						if (this.V[ parseInt( opcode[1] ) ] & 128)
							this.V[0xF] = 1;
						else
							this.V[0xF] = 0;
						var val = this.V[ opcode[1] ] * 2;
						if (val > 255) val -= 256;
						this.V[ opcode[1] ] = val;
					break;
				}
			break;
			case 0x9:
				if (this.V[ opcode[1] ] != this.V[ opcode[2] ])
					this.PC += 2;
			break;
			case 0xA:
				this.I = (opcode[1] << 8) + (opcode[2] << 4) + opcode[3];
			break;
			case 0xB:
				this.PC = this.V[0] + (opcode[1] << 8) + (opcode[2] << 4) + opcode[3];
			case 0xC:
				this.V[opcode[1]] = parseInt(Math.random() << 8) & ((opcode[2] << 4) + opcode[3]);
			break;
			case 0xD:
				var V = this.V;
				V[0xF] = 0;
				var scr = this.screen;
				if (! this._bHigh) {
					var x = V[opcode[1]];
					var y = V[opcode[2]];
					var OP4 = opcode[3];
					for (var j=0;j<OP4;j++) {
						var spr = this.RAM[this.I + j];

						for (var i=0;i<8;i++) {
							if ((spr & 0x80) > 0) {
								if (scr.drawPixel(x+i,y+j) == 1) V[0xF] = 1;
							}
							spr <<= 1;
						}

					}
				} else {
					console.log("SChip not supported!");
				}
			break;
			case 0xE:
				switch( opcode[2] ) {
					case 0x9:
						if(this.keyPressed == this.V[opcode[1]])
							this.PC += 2;
					break;
					case 0xA:
						if(this.keyPressed != this.V[opcode[1]])
							this.PC += 2;
					break;
				}
			break;
			case 0xF:
				switch( opcode[2] ) {
					case 0x0:
						switch (opcode[3]) {
							case 0x7 : 
								this.V[opcode[1]] = this.delay_timer;
							break;
							case 0xA : 
								this.keyPressed = 0;
								this.isWaiting = true;
								this.checkKeyPressed(opcode[1]);
							break;
						}
					break;
					case 0x1:
						switch (opcode[3]) {
							case 0x5 :
								this.delay_timer = this.V[opcode[1]];
							break;
							case 0x8 :
								this.sound_timer = this.V[opcode[1]];
							break;
							case 0xE :
								this.I += this.V[opcode[1]];
							break;
						}
					break;
					case 0x2 :
						this.I = ((this.V[opcode[1]] & 0xf) * 5);
					break;
					case 0x3 :
						var num = this.V[opcode[1]];
						for (var i=3;i>=1;i--) {
							this.RAM[this.I + (i - 1)] = num % 10;
							num = num / 10;
						}
					break;
					case 0x5 :
						for(var i=0;i<=opcode[1];i++)
							this.RAM[this.I + i] = this.V[i];
					break;
					case 0x6 :
						for (var i=0;i<=opcode[1];i++)
							this.V[i] = this.RAM[this.I + i];
					break;
				}
			break;
		}
	}
}