/**
 * Pokemon Showdown Dex
 *
 * Roughly equivalent to sim/dex.js in a Pokemon Showdown server, but
 * designed for use in browsers rather than in Node.
 *
 * This is a generic utility library for Pokemon Showdown code: any
 * code shared between the replay viewer and the client usually ends up
 * here.
 *
 * Licensing note: PS's client has complicated licensing:
 * - The client as a whole is AGPLv3
 * - The battle replay/animation engine (battle-*.ts) by itself is MIT
 *
 * Compiled into battledata.js which includes all dependencies
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

declare var require: any;
declare var global: any;

if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function indexOf(searchElement, fromIndex) {
		for (let i = (fromIndex || 0); i < this.length; i++) {
			if (this[i] === searchElement) return i;
		}
		return -1;
	};
}
if (!Array.prototype.includes) {
	Array.prototype.includes = function includes(thing) {
		return this.indexOf(thing) !== -1;
	};
}
if (!Array.isArray) {
	Array.isArray = function isArray(thing): thing is any[] {
		return Object.prototype.toString.call(thing) === '[object Array]';
	};
}
if (!String.prototype.includes) {
	String.prototype.includes = function includes(thing) {
		return this.indexOf(thing) !== -1;
	};
}
if (!String.prototype.startsWith) {
	String.prototype.startsWith = function startsWith(thing) {
		return this.slice(0, thing.length) === thing;
	};
}
if (!String.prototype.endsWith) {
	String.prototype.endsWith = function endsWith(thing) {
		return this.slice(-thing.length) === thing;
	};
}
if (!String.prototype.trim) {
	String.prototype.trim = function trim() {
		return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
	};
}
if (!Object.assign) {
	Object.assign = function assign(thing: any, rest: any) {
		for (let i = 1; i < arguments.length; i++) {
			let source = arguments[i];
			for (let k in source) {
				thing[k] = source[k];
			}
		}
		return thing;
	};
}
if (!Object.values) {
	Object.values = function values(thing: any) {
		let out: any[] = [];
		for (let k in thing) {
			out.push(thing[k]);
		}
		return out;
	};
}
if (!Object.keys) {
	Object.keys = function keys(thing: any) {
		let out: any[] = [];
		for (let k in thing) {
			out.push(k);
		}
		return out;
	};
}
if (!Object.entries) {
	Object.entries = function entries(thing: any) {
		let out: any[] = [];
		for (let k in thing) {
			out.push([k, thing[k]]);
		}
		return out;
	};
}
if (!Object.create) {
	Object.create = function (proto: any) {
		function F() {}
		F.prototype = proto;
		return new (F as any)();
	};
}

if (typeof window === 'undefined') {
	// Node
	(global as any).window = global;
} else {
	// browser (possibly NW.js!)
	window.exports = window;
}

if (window.soundManager) {
	soundManager.setup({url: 'https://play.pokemonshowdown.com/swf/'});
	if (window.Replays) soundManager.onready(window.Replays.soundReady);
	soundManager.onready(() => {
		soundManager.createSound({
			id: 'notif',
			url: 'https://play.pokemonshowdown.com/audio/notification.wav',
		});
	});
}

// @ts-ignore
window.nodewebkit = !!(typeof process !== 'undefined' && process.versions && process.versions['node-webkit']);

function getString(str: any) {
	if (typeof str === 'string' || typeof str === 'number') return '' + str;
	return '';
}

function toID(text: any) {
	if (text?.id) {
		text = text.id;
	} else if (text?.userid) {
		text = text.userid;
	}
	if (typeof text !== 'string' && typeof text !== 'number') return '' as ID;
	return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '') as ID;
}

function toUserid(text: any) {
	return toID(text);
}

/**
 * Like string.split(delimiter), but only recognizes the first `limit`
 * delimiters (default 1).
 *
 * `"1 2 3 4".split(" ", 2) => ["1", "2"]`
 *
 * `splitFirst("1 2 3 4", " ", 1) => ["1", "2 3 4"]`
 *
 * Returns an array of length exactly limit + 1.
 */
function splitFirst(str: string, delimiter: string, limit: number = 1) {
	let splitStr: string[] = [];
	while (splitStr.length < limit) {
		let delimiterIndex = str.indexOf(delimiter);
		if (delimiterIndex >= 0) {
			splitStr.push(str.slice(0, delimiterIndex));
			str = str.slice(delimiterIndex + delimiter.length);
		} else {
			splitStr.push(str);
			str = '';
		}
	}
	splitStr.push(str);
	return splitStr;
}

/**
 * Sanitize a room ID by removing anything that isn't alphanumeric or `-`.
 * Shouldn't actually do anything except against malicious input.
 */
function toRoomid(roomid: string) {
	return roomid.replace(/[^a-zA-Z0-9-]+/g, '').toLowerCase();
}

function toName(name: any) {
	if (typeof name !== 'string' && typeof name !== 'number') return '';
	name = ('' + name).replace(/[\|\s\[\]\,\u202e]+/g, ' ').trim();
	if (name.length > 18) name = name.substr(0, 18).trim();

	// remove zalgo
	name = name.replace(
		/[\u0300-\u036f\u0483-\u0489\u0610-\u0615\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06ED\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]{3,}/g,
		''
	);
	name = name.replace(/[\u239b-\u23b9]/g, '');

	return name;
}

interface SpriteData {
	w: number;
	h: number;
	y?: number;
	gen?: number;
	url?: string;
	rawHTML?: string;
	pixelated?: boolean;
	isBackSprite?: boolean;
	cryurl?: string;
	shiny?: boolean;
}

const Dex = new class implements ModdedDex {
	readonly gen = 8;
	readonly modid = 'gen8' as ID;
	readonly cache = null!;

	readonly statNames: ReadonlyArray<StatName> = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
	readonly statNamesExceptHP: ReadonlyArray<StatNameExceptHP> = ['atk', 'def', 'spa', 'spd', 'spe'];

	pokeballs: string[] | null = null;

	resourcePrefix = (() => {
		let prefix = '';
		if (window.document?.location?.protocol !== 'http:') prefix = 'https:';
		return `${prefix}//play.pokemonshowdown.com/`;
	})();

	fxPrefix = (() => {
		if (window.document?.location?.protocol === 'file:') {
			if (window.Replays) return `https://play.pokemonshowdown.com/fx/`;
			return `fx/`;
		}
		return `//play.pokemonshowdown.com/fx/`;
	})();

	loadedSpriteData = {xy: 1, bw: 0};
	moddedDexes: {[mod: string]: ModdedDex} = {};

	mod(modid: ID): ModdedDex {
		if (modid === 'gen8') return this;
		if (!window.BattleTeambuilderTable) return this;
		if (modid in this.moddedDexes) {
			return this.moddedDexes[modid];
		}
		this.moddedDexes[modid] = new ModdedDex(modid);
		return this.moddedDexes[modid];
	}
	forGen(gen: number) {
		return this.mod(`gen${gen}` as ID);
	}

	resolveAvatar(avatar: string): string {
		if (window.BattleAvatarNumbers && avatar in BattleAvatarNumbers) {
			avatar = BattleAvatarNumbers[avatar];
		}
		if (avatar.charAt(0) === '#') {
			return Dex.resourcePrefix + 'sprites/trainers-custom/' + toID(avatar.substr(1)) + '.png';
		}
		if (avatar.includes('.') && window.Config?.server?.registered) {
			// custom avatar served by the server
			let protocol = (Config.server.port === 443) ? 'https' : 'http';
			return protocol + '://' + Config.server.host + ':' + Config.server.port +
				'/avatars/' + encodeURIComponent(avatar).replace(/\%3F/g, '?');
		}
		return Dex.resourcePrefix + 'sprites/trainers/' + Dex.sanitizeName(avatar || 'unknown') + '.png';
	}

	/**
	 * This is used to sanitize strings from data files like `moves.js` and
	 * `teambuilder-tables.js`.
	 *
	 * This makes sure untrusted strings can't wreak havoc if someone forgets to
	 * escape it before putting it in HTML.
	 *
	 * None of these characters belong in these files, anyway. (They can be used
	 * in move descriptions, but those are served from `text.js`, which are
	 * definitely always treated as unsanitized.)
	 */
	sanitizeName(name: any) {
		if (!name) return '';
		return ('' + name)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
			.slice(0, 50);
	}

	prefs(prop: string, value?: any, save?: boolean) {
		// @ts-ignore
		return window.Storage?.prefs?.(prop, value, save);
	}

	getShortName(name: string) {
		let shortName = name.replace(/[^A-Za-z0-9]+$/, '');
		if (shortName.indexOf('(') >= 0) {
			shortName += name.slice(shortName.length).replace(/[^\(\)]+/g, '').replace(/\(\)/g, '');
		}
		return shortName;
	}

	getEffect(name: string | null | undefined): PureEffect | Item | Ability | Move {
		name = (name || '').trim();
		if (name.substr(0, 5) === 'item:') {
			return Dex.getItem(name.substr(5).trim());
		} else if (name.substr(0, 8) === 'ability:') {
			return Dex.getAbility(name.substr(8).trim());
		} else if (name.substr(0, 5) === 'move:') {
			return Dex.getMove(name.substr(5).trim());
		}
		let id = toID(name);
		return new PureEffect(id, name);
	}

	getMove(nameOrMove: string | Move | null | undefined): Move {
		if (nameOrMove && typeof nameOrMove !== 'string') {
			// TODO: don't accept Moves here
			return nameOrMove;
		}
		let name = nameOrMove || '';
		let id = toID(nameOrMove);
		if (window.BattleAliases && id in BattleAliases) {
			name = BattleAliases[id];
			id = toID(name);
		}
		if (!window.BattleMovedex) window.BattleMovedex = {};
		let data = window.BattleMovedex[id];
		if (data && typeof data.exists === 'boolean') return data;

		if (!data && id.substr(0, 11) === 'hiddenpower' && id.length > 11) {
			let [, hpWithType, hpPower] = /([a-z]*)([0-9]*)/.exec(id)!;
			data = {
				...(window.BattleMovedex[hpWithType] || {}),
				basePower: Number(hpPower) || 60,
			};
		}
		if (!data && id.substr(0, 6) === 'return' && id.length > 6) {
			data = {
				...(window.BattleMovedex['return'] || {}),
				basePower: Number(id.slice(6)),
			};
		}
		if (!data && id.substr(0, 11) === 'frustration' && id.length > 11) {
			data = {
				...(window.BattleMovedex['frustration'] || {}),
				basePower: Number(id.slice(11)),
			};
		}

		if (!data) data = {exists: false};
		let move = new Move(id, name, data);
		window.BattleMovedex[id] = move;
		return move;
	}

	getGen3Category(type: string) {
		return [
			'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Psychic', 'Dark', 'Dragon',
		].includes(type) ? 'Special' : 'Physical';
	}

	getItem(nameOrItem: string | Item | null | undefined): Item {
		if (nameOrItem && typeof nameOrItem !== 'string') {
			// TODO: don't accept Items here
			return nameOrItem;
		}
		let name = nameOrItem || '';
		let id = toID(nameOrItem);
		if (window.BattleAliases && id in BattleAliases) {
			name = BattleAliases[id];
			id = toID(name);
		}
		if (!window.BattleItems) window.BattleItems = {};
		let data = window.BattleItems[id];
		if (data && typeof data.exists === 'boolean') return data;
		if (!data) data = {exists: false};
		let item = new Item(id, name, data);
		window.BattleItems[id] = item;
		return item;
	}

	getAbility(nameOrAbility: string | Ability | null | undefined): Ability {
		if (nameOrAbility && typeof nameOrAbility !== 'string') {
			// TODO: don't accept Abilities here
			return nameOrAbility;
		}
		let name = nameOrAbility || '';
		let id = toID(nameOrAbility);
		if (window.BattleAliases && id in BattleAliases) {
			name = BattleAliases[id];
			id = toID(name);
		}
		if (!window.BattleAbilities) window.BattleAbilities = {};
		let data = window.BattleAbilities[id];
		if (data && typeof data.exists === 'boolean') return data;
		if (!data) data = {exists: false};
		let ability = new Ability(id, name, data);
		window.BattleAbilities[id] = ability;
		return ability;
	}

	getTemplate(nameOrTemplate: string | Template | null | undefined): Template {
		if (nameOrTemplate && typeof nameOrTemplate !== 'string') {
			// TODO: don't accept Templates here
			return nameOrTemplate;
		}
		let name = nameOrTemplate || '';
		let id = toID(nameOrTemplate);
		let formid = id;
		if (!window.BattlePokedexAltForms) window.BattlePokedexAltForms = {};
		if (formid in window.BattlePokedexAltForms) return window.BattlePokedexAltForms[formid];
		if (window.BattleAliases && id in BattleAliases) {
			name = BattleAliases[id];
			id = toID(name);
		}
		if (!window.BattlePokedex) window.BattlePokedex = {};
		let data = window.BattlePokedex[id];

		let template: Template;
		if (data && typeof data.exists === 'boolean') {
			template = data;
		} else {
			if (!data) data = {exists: false};
			if (!data.tier && id.slice(-5) === 'totem') {
				data.tier = this.getTemplate(id.slice(0, -5)).tier;
			}
			if (!data.tier && data.baseSpecies && toID(data.baseSpecies) !== id) {
				data.tier = this.getTemplate(data.baseSpecies).tier;
			}
			template = new Template(id, name, data);
			window.BattlePokedex[id] = template;
		}

		if (formid === id || !template.otherForms || !template.otherForms.includes(formid)) {
			return template;
		}
		let forme = formid.slice(id.length);
		forme = forme[0].toUpperCase() + forme.slice(1);
		name = template.baseSpecies + (forme ? '-' + forme : '');

		template = window.BattlePokedexAltForms[formid] = new Template(formid, name, {
			...template,
			name,
			forme,
		});
		return template;
	}

	/** @deprecated */
	getTier(pokemon: Template, gen = 7, isDoubles = false): string {
		if (gen < 8) pokemon = this.forGen(gen).getTemplate(pokemon.id);
		if (!isDoubles) return pokemon.tier;
		let table = window.BattleTeambuilderTable;
		if (table && table[`gen${this.gen}doubles`]) {
			table = table[`gen${this.gen}doubles`];
		}
		if (!table) return pokemon.tier;

		let id = pokemon.id;
		if (id in table.overrideTier) {
			return table.overrideTier[id];
		}
		if (id.slice(-5) === 'totem' && id.slice(0, -5) in table.overrideTier) {
			return table.overrideTier[id.slice(0, -5)];
		}
		id = toID(pokemon.baseSpecies);
		if (id in table.overrideTier) {
			return table.overrideTier[id];
		}

		return pokemon.tier;
	}

	getType(type: any): Effect {
		if (!type || typeof type === 'string') {
			let id = toID(type) as string;
			id = id.substr(0, 1).toUpperCase() + id.substr(1);
			type = (window.BattleTypeChart && window.BattleTypeChart[id]) || {};
			if (type.damageTaken) type.exists = true;
			if (!type.id) type.id = id;
			if (!type.name) type.name = id;
			if (!type.effectType) {
				type.effectType = 'Type';
			}
		}
		return type;
	}

	hasAbility(template: Template, ability: string) {
		for (const i in template.abilities) {
			// @ts-ignore
			if (ability === template.abilities[i]) return true;
		}
		return false;
	}

	loadSpriteData(gen: 'xy' | 'bw') {
		if (this.loadedSpriteData[gen]) return;
		this.loadedSpriteData[gen] = 1;

		let path = $('script[src*="pokedex-mini.js"]').attr('src') || '';
		let qs = '?' + (path.split('?')[1] || '');
		path = (path.match(/.+?(?=data\/pokedex-mini\.js)/) || [])[0] || '';

		let el = document.createElement('script');
		el.src = path + 'data/pokedex-mini-bw.js' + qs;
		document.getElementsByTagName('body')[0].appendChild(el);
	}
	getSpriteData(pokemon: Pokemon | Template | string, siden: number, options: {
		gen?: number, shiny?: boolean, gender?: GenderName, afd?: boolean, noScale?: boolean, mod?: string,
	} = {gen: 6}) {
		const mechanicsGen = options.gen || 6;
		let isDynamax = false;
		if (pokemon instanceof Pokemon) {
			if (pokemon.volatiles.transform) {
				options.shiny = pokemon.volatiles.transform[2];
				options.gender = pokemon.volatiles.transform[3];
			} else {
				options.shiny = pokemon.shiny;
				options.gender = pokemon.gender;
			}
			if (pokemon.volatiles.dynamax) isDynamax = true;
			pokemon = pokemon.getSpecies();
		}
		const template = Dex.getTemplate(pokemon);
		let spriteData = {
			gen: mechanicsGen,
			w: 96,
			h: 96,
			y: 0,
			url: Dex.resourcePrefix + 'sprites/',
			pixelated: true,
			isBackSprite: false,
			cryurl: '',
			shiny: options.shiny,
		};
		let name = template.spriteid;
		let dir;
		let facing;
		if (siden) {
			dir = '';
			facing = 'front';
		} else {
			spriteData.isBackSprite = true;
			dir = '-back';
			facing = 'back';
		}

		// Decide which gen sprites to use.
		//
		// There are several different generations we care about here:
		//
		//   - mechanicsGen: the generation number of the mechanics and battle (options.gen)
		//   - graphicsGen: the generation number of sprite/field graphics the user has requested.
		//     This will default to mechanicsGen, but may be altered depending on user preferences.
		//   - spriteData.gen: the generation number of a the specific Pokemon sprite in question.
		//     This defaults to graphicsGen, but if the graphicsGen doesn't have a sprite for the Pokemon
		//     (eg. Darmanitan in graphicsGen 2) then we go up gens until it exists.
		//
		let graphicsGen = mechanicsGen;
		if (Dex.prefs('nopastgens')) graphicsGen = 6;
		if (Dex.prefs('bwgfx') && graphicsGen >= 6) graphicsGen = 5;
		spriteData.gen = Math.max(graphicsGen, Math.min(template.gen, 5));
		const baseDir = ['', 'gen1', 'gen2', 'gen3', 'gen4', 'gen5', '', '', ''][spriteData.gen];

		let animationData = null;
		let miscData = null;
		let speciesid = template.speciesid;
		if (template.isTotem) speciesid = toID(name);
		if (baseDir === '' && window.BattlePokemonSprites) {
			animationData = BattlePokemonSprites[speciesid];
		}
		if (baseDir === 'gen5' && window.BattlePokemonSpritesBW) {
			animationData = BattlePokemonSpritesBW[speciesid];
		}
		if (window.BattlePokemonSprites) miscData = BattlePokemonSprites[speciesid];
		if (!miscData && window.BattlePokemonSpritesBW) miscData = BattlePokemonSpritesBW[speciesid];
		if (!animationData) animationData = {};
		if (!miscData) miscData = {};

		if (miscData.num > 0) {
			let baseSpeciesid = toID(template.baseSpecies);
			spriteData.cryurl = 'audio/cries/' + baseSpeciesid;
			let formeid = template.formeid;
			if (template.isMega || formeid && (
				formeid === '-sky' ||
				formeid === '-therian' ||
				formeid === '-primal' ||
				formeid === '-eternal' ||
				baseSpeciesid === 'kyurem' ||
				baseSpeciesid === 'necrozma' ||
				formeid === '-super' ||
				formeid === '-unbound' ||
				formeid === '-midnight' ||
				formeid === '-school' ||
				baseSpeciesid === 'oricorio' ||
				baseSpeciesid === 'zygarde'
			)) {
				spriteData.cryurl += formeid;
			}
			spriteData.cryurl += (window.nodewebkit ? '.ogg' : '.mp3');
		}

		if (options.shiny && mechanicsGen > 1) dir += '-shiny';

		// April Fool's 2014
		if (window.Config && Config.server && Config.server.afd || options.afd) {
			dir = 'afd' + dir;
			spriteData.url += dir + '/' + name + '.png';
			return spriteData;
		}

		// Mod Cries
		if (options.mod) {
			spriteData.cryurl = `sprites/${options.mod}/audio/${toID(template.baseSpecies)}`;
			spriteData.cryurl += (window.nodewebkit ? '.ogg' : '.mp3');
		}

		if (animationData[facing + 'f'] && options.gender === 'F') facing += 'f';
		let allowAnim = !Dex.prefs('noanim') && !Dex.prefs('nogif');
		if (allowAnim && spriteData.gen >= 6) spriteData.pixelated = false;
		if (allowAnim && animationData[facing] && spriteData.gen >= 5) {
			if (facing.slice(-1) === 'f') name += '-f';
			dir = baseDir + 'ani' + dir;

			spriteData.w = animationData[facing].w;
			spriteData.h = animationData[facing].h;
			spriteData.url += dir + '/' + name + '.gif';
		} else {
			// There is no entry or enough data in pokedex-mini.js
			// Handle these in case-by-case basis; either using BW sprites or matching the played gen.
			dir = (baseDir || 'gen5') + dir;

			// Gender differences don't exist prior to Gen 4,
			// so there are no sprites for it
			if (spriteData.gen >= 4 && miscData['frontf'] && options.gender === 'F') {
				name += '-f';
			}

			spriteData.url += dir + '/' + name + '.png';
		}

		if (!options.noScale) {
			if (graphicsGen > 4) {
				// no scaling
			} else if (!spriteData.isBackSprite) {
				spriteData.w *= 2;
				spriteData.h *= 2;
				spriteData.y += -16;
			} else {
				// old gen backsprites are multiplied by 1.5x by the 3D engine
				spriteData.w *= 2 / 1.5;
				spriteData.h *= 2 / 1.5;
				spriteData.y += -11;
			}
			if (spriteData.gen <= 2) spriteData.y += 2;
		}
		if (isDynamax && !options.noScale) {
			spriteData.w *= 2;
			spriteData.h *= 2;
			spriteData.y += -22;
		} else if ((template.isTotem || isDynamax) && !options.noScale) {
			spriteData.w *= 1.5;
			spriteData.h *= 1.5;
			spriteData.y += -11;
		}

		return spriteData;
	}

	getPokemonIconNum(id: ID, isFemale?: boolean, facingLeft?: boolean) {
		let num = 0;
		if (window.BattlePokemonSprites?.[id]?.num) {
			num = BattlePokemonSprites[id].num;
		} else if (window.BattlePokedex?.[id]?.num) {
			num = BattlePokedex[id].num;
		}
		if (num < 0) num = 0;
		if (num > 809) num = 0;

		if (window.BattlePokemonIconIndexes?.[id]) {
			num = BattlePokemonIconIndexes[id];
		}

		if (isFemale) {
			if (['unfezant', 'frillish', 'jellicent', 'meowstic', 'pyroar'].includes(id)) {
				num = BattlePokemonIconIndexes[id + 'f'];
			}
		}
		if (facingLeft) {
			if (BattlePokemonIconIndexesLeft[id]) {
				num = BattlePokemonIconIndexesLeft[id];
			}
		}
		return num;
	}

	getPokemonIcon(pokemon: any, facingLeft?: boolean) {
		if (pokemon === 'pokeball') {
			return `background:transparent url(${Dex.resourcePrefix}sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -0px 4px`;
		} else if (pokemon === 'pokeball-statused') {
			return `background:transparent url(${Dex.resourcePrefix}sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -40px 4px`;
		} else if (pokemon === 'pokeball-fainted') {
			return `background:transparent url(${Dex.resourcePrefix}sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -80px 4px;opacity:.4;filter:contrast(0)`;
		} else if (pokemon === 'pokeball-none') {
			return `background:transparent url(${Dex.resourcePrefix}sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -80px 4px`;
		}

		let id = toID(pokemon);
		if (pokemon?.species) id = toID(pokemon.species);
		if (pokemon?.volatiles?.formechange && !pokemon.volatiles.transform) {
			id = toID(pokemon.volatiles.formechange[1]);
		}
		let num = this.getPokemonIconNum(id, pokemon?.gender === 'F', facingLeft);

		let top = Math.floor(num / 12) * 30;
		let left = (num % 12) * 40;
		let fainted = (pokemon?.fainted ? `;opacity:.3;filter:grayscale(100%) brightness(.5)` : ``);
		return `background:transparent url(${Dex.resourcePrefix}sprites/pokemonicons-sheet.png?a6) no-repeat scroll -${left}px -${top}px${fainted}`;
	}

	getTeambuilderSprite(pokemon: any, gen: number = 0) {
		if (!pokemon) return '';
		let id = toID(pokemon.species);
		let spriteid = pokemon.spriteid;
		let template = Dex.getTemplate(pokemon.species);
		if (pokemon.species && !spriteid) {
			spriteid = template.spriteid || toID(pokemon.species);
		}
		if (template.exists === false) {
			return 'background-image:url(' + Dex.resourcePrefix + 'sprites/gen5/0.png);background-position:10px 5px;background-repeat:no-repeat';
		}
		let shiny = (pokemon.shiny ? '-shiny' : '');
		// let sdata;
		// if (BattlePokemonSprites[id]?.front && !Dex.prefs('bwgfx')) {
		// 	if (BattlePokemonSprites[id].front.anif && pokemon.gender === 'F') {
		// 		spriteid += '-f';
		// 		sdata = BattlePokemonSprites[id].front.anif;
		// 	} else {
		// 		sdata = BattlePokemonSprites[id].front.ani;
		// 	}
		// } else {
		// 	return 'background-image:url(' + Dex.resourcePrefix + 'sprites/gen5' + shiny + '/' + spriteid + '.png);background-position:10px 5px;background-repeat:no-repeat';
		// }
		if (Dex.prefs('nopastgens')) gen = 6;
		let spriteDir = Dex.resourcePrefix + 'sprites/dex';
		let xydexExists = (!template.isNonstandard || template.isNonstandard === 'Past') || [
			"pikachustarter", "eeveestarter", "meltan", "melmetal", "fidgit", "stratagem", "tomohawk", "mollux", "crucibelle", "crucibellemega", "kerfluffle", "pajantom", "jumbao", "caribolt", "smokomodo", "snaelstrom", "equilibra", "scratchet", "pluffle", "smogecko", "pokestarufo", "pokestarufo2", "pokestarbrycenman", "pokestarmt", "pokestarmt2", "pokestargiant", "pokestarhumanoid", "pokestarmonster", "pokestarf00", "pokestarf002", "pokestarspirit",
		].includes(template.id);
		if (template.gen === 8) xydexExists = false;
		if ((!gen || gen >= 6) && xydexExists && !Dex.prefs('bwgfx')) {
			let offset = '-2px -3px';
			if (template.gen >= 7) offset = '-6px -7px';
			if (id.substr(0, 6) === 'arceus') offset = '-2px 7px';
			if (id === 'garchomp') offset = '-2px 2px';
			if (id === 'garchompmega') offset = '-2px 0px';
			return 'background-image:url(' + spriteDir + shiny + '/' + spriteid + '.png);background-position:' + offset + ';background-repeat:no-repeat';
		}
		spriteDir = Dex.resourcePrefix + 'sprites/gen5';
		if (gen <= 1 && template.gen <= 1) spriteDir = Dex.resourcePrefix + 'sprites/gen1';
		else if (gen <= 2 && template.gen <= 2) spriteDir = Dex.resourcePrefix + 'sprites/gen2';
		else if (gen <= 3 && template.gen <= 3) spriteDir = Dex.resourcePrefix + 'sprites/gen3';
		else if (gen <= 4 && template.gen <= 4) spriteDir = Dex.resourcePrefix + 'sprites/gen4';
		return 'background-image:url(' + spriteDir + shiny + '/' + spriteid + '.png);background-position:10px 5px;background-repeat:no-repeat';
	}

	getItemIcon(item: any) {
		let num = 0;
		if (typeof item === 'string' && exports.BattleItems) item = exports.BattleItems[toID(item)];
		if (item?.spritenum) num = item.spritenum;

		let top = Math.floor(num / 16) * 24;
		let left = (num % 16) * 24;
		return 'background:transparent url(' + Dex.resourcePrefix + 'sprites/itemicons-sheet.png) no-repeat scroll -' + left + 'px -' + top + 'px';
	}

	getTypeIcon(type: string, b?: boolean) { // b is just for utilichart.js
		if (!type) return '';
		let sanitizedType = type.replace(/\?/g, '%3f');
		return '<img src="' + Dex.resourcePrefix + 'sprites/types/' + sanitizedType + '.png" alt="' + type + '" height="14" width="32"' + (b ? ' class="b"' : '') + ' />';
	}

	getPokeballs() {
		if (this.pokeballs) return this.pokeballs;
		this.pokeballs = [];
		if (!window.BattleItems) window.BattleItems = {};
		for (const data of Object.values(window.BattleItems) as AnyObject[]) {
			if (!data.isPokeball) continue;
			this.pokeballs.push(data.name);
		}
		return this.pokeballs;
	}
};

class ModdedDex {
	readonly gen: number;
	readonly modid: ID;
	readonly cache = {
		Moves: {} as any as {[k: string]: Move},
		Items: {} as any as {[k: string]: Item},
		Abilities: {} as any as {[k: string]: Ability},
		Templates: {} as any as {[k: string]: Template},
	};
	pokeballs: string[] | null = null;
	constructor(modid: ID) {
		this.modid = modid;
		let gen = parseInt(modid.slice(3), 10);
		if (!modid.startsWith('gen') || !gen) throw new Error("Unsupported modid");
		this.gen = gen;
	}
	getMove(name: string): Move {
		let id = toID(name);
		if (window.BattleAliases && id in BattleAliases) {
			name = BattleAliases[id];
			id = toID(name);
		}
		if (this.cache.Moves.hasOwnProperty(id)) return this.cache.Moves[id];

		let data = {...Dex.getMove(name)};

		const table = window.BattleTeambuilderTable[this.modid];
		if (id in table.overrideAcc) data.accuracy = table.overrideAcc[id];
		if (id in table.overrideBP) data.basePower = table.overrideBP[id];
		if (id in table.overridePP) data.pp = table.overridePP[id];
		if (id in table.overrideMoveType) data.type = table.overrideMoveType[id];
		for (let i = this.gen; i < 8; i++) {
			if (id in window.BattleTeambuilderTable['gen' + i].overrideMoveDesc) {
				data.shortDesc = window.BattleTeambuilderTable['gen' + i].overrideMoveDesc[id];
				break;
			}
		}
		if (this.gen <= 3 && data.category !== 'Status') {
			data.category = Dex.getGen3Category(data.type);
		}

		const move = new Move(id, name, data);
		this.cache.Moves[id] = move;
		return move;
	}
	getItem(name: string): Item {
		let id = toID(name);
		if (window.BattleAliases && id in BattleAliases) {
			name = BattleAliases[id];
			id = toID(name);
		}
		if (this.cache.Items.hasOwnProperty(id)) return this.cache.Items[id];

		let data = {...Dex.getItem(name)};

		for (let i = this.gen; i < 8; i++) {
			if (id in window.BattleTeambuilderTable['gen' + i].overrideItemDesc) {
				data.shortDesc = window.BattleTeambuilderTable['gen' + i].overrideItemDesc[id];
				break;
			}
		}

		const item = new Item(id, name, data);
		this.cache.Items[id] = item;
		return item;
	}
	getAbility(name: string): Ability {
		let id = toID(name);
		if (window.BattleAliases && id in BattleAliases) {
			name = BattleAliases[id];
			id = toID(name);
		}
		if (this.cache.Abilities.hasOwnProperty(id)) return this.cache.Abilities[id];

		let data = {...Dex.getAbility(name)};

		for (let i = this.gen; i < 8; i++) {
			if (id in window.BattleTeambuilderTable['gen' + i].overrideAbilityDesc) {
				data.shortDesc = window.BattleTeambuilderTable['gen' + i].overrideAbilityDesc[id];
				break;
			}
		}

		const ability = new Ability(id, name, data);
		this.cache.Abilities[id] = ability;
		return ability;
	}
	getTemplate(name: string): Template {
		let id = toID(name);
		if (window.BattleAliases && id in BattleAliases) {
			name = BattleAliases[id];
			id = toID(name);
		}
		if (this.cache.Templates.hasOwnProperty(id)) return this.cache.Templates[id];

		let data = {...Dex.getTemplate(name)};

		const table = window.BattleTeambuilderTable[this.modid];
		if (this.gen < 3) {
			data.abilities = {0: "None"};
		} else {
			let abilities = {...data.abilities};
			if (id in table.overrideAbility) {
				abilities['0'] = table.overrideAbility[id];
			}
			if (id in table.removeSecondAbility) {
				delete abilities['1'];
			}
			if (id in table.overrideHiddenAbility) {
				abilities['H'] = table.overrideHiddenAbility[id];
			}
			if (this.gen < 5) delete abilities['H'];
			if (this.gen < 7) delete abilities['S'];

			data.abilities = abilities;
		}
		if (id in table.overrideStats) {
			data.baseStats = {...data.baseStats, ...table.overrideStats[id]};
		}
		if (id in table.overrideType) data.types = table.overrideType[id].split('/');

		if (id in table.overrideTier) data.tier = table.overrideTier[id];
		if (!data.tier && id.slice(-5) === 'totem') {
			data.tier = this.getTemplate(id.slice(0, -5)).tier;
		}
		if (!data.tier && data.baseSpecies && toID(data.baseSpecies) !== id) {
			data.tier = this.getTemplate(data.baseSpecies).tier;
		}
		if (data.gen > this.gen) data.tier = 'Illegal';

		const template = new Template(id, name, data);
		this.cache.Templates[id] = template;
		return template;
	}

	getPokeballs() {
		if (this.pokeballs) return this.pokeballs;
		this.pokeballs = [];
		if (!window.BattleItems) window.BattleItems = {};
		for (const data of Object.values(window.BattleItems) as AnyObject[]) {
			if (data.gen && data.gen > this.gen) continue;
			if (!data.isPokeball) continue;
			this.pokeballs.push(data.name);
		}
		return this.pokeballs;
	}
}

if (typeof require === 'function') {
	// in Node
	(global as any).Dex = Dex;
	(global as any).toID = toID;
}
