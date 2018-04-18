/* NPM Modules */
const semver = require('semver');
const net = require('net');
const commander = require('commander');
const wrap = require('wrap-ansi');
const argv = require('optimist').argv;
const path = require('path');
const fs = require('fs');

// Package.json for versioning
const pkg = require('./package.json');

if (!semver.satisfies(process.version, pkg.engines.node)) {
  throw new Error(
    `Ranvier's core engine requires Node version ${pkg.engines.node},
    you are currently running Node ${process.version}.`
  );
}

function loadSrc (dir) {
  const src = {}
  let files
  try {
    files = fs.readdirSync(dir);
  }
  catch (ex) {
    console.log('dir: ' + dir)
    console.error(ex)
    process.exit()
  }

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath)
    const basename = path.basename(filePath);
    const name = basename.substr(0, basename.length - ext.length)

    if (stats.isFile()) {
      if (ext != '.js' || file === '.' || file === '..') {
        continue;
      }
      src[name] = require(filePath)
    }
    else if (stats.isDirectory()) {
      src[name] = loadSrc(filePath)
    }
  }

  return src
}

class Ranvier {
  constructor (options = {}) {
    const src = {}
    console.log('Object.keys(options)', Object.keys(options))
    console.log('options.Damage.colin', options.Damage.colin)
    console.log('Object.keys(Ranvier.base)', Object.keys(Ranvier.base))

    Object.keys(Ranvier.base).forEach((key) => {
      if (options.hasOwnProperty(key)) {
        console.log('KEY: ' + key)
        this[key] = options[key]
      }
      else {
        this[key] = Ranvier.base[key]
      }
    })

    // cmdline options
    commander
      .version(pkg.version)
      .option('-s, --save [time]', 'Number of seconds between auto-save ticks [10]', 10)
      .option('-r, --respawn [time]', 'Number of minutes between respawn ticks [120]', 120)
      .option('-p, --port [portNumber]', 'Port to host the server [23]', this.Config.get('port', 23))
      .option('-v, --verbose', 'Verbose console logging.', true)
      .option('-e, --prettyErrors', 'Pretty-print formatting for error stack traces.', false)
      .parse(process.argv);

    // Set debug variable and encoding.
    // 'net' by default to help find possible server errors.
    process.env.NODE_DEBUG = 'net';
    process.stdin.setEncoding('utf8');

    this.Logger = require('./src/Logger');
    const logfile = this.Config.get('logfile');
    if (logfile) {
      this.Logger.setFileLogging(logfile);
    }

    if (commander.prettyErrors) {
      this.Logger.enablePrettyErrors();
    }

    // Set logging level based on CLI option or environment variable.
    const logLevel = commander.verbose ?
      'verbose' :
      process.env.LOG_LEVEL || this.Config.get('logLevel') || 'debug';
    this.Logger.setLevel(logLevel);


    // Global state object, server instance and configurable intervals.
    this.GameState = {};
    this.saveInterval = null
    this.tickInterval = null
    this.playerTickInterval = null
  }

  /**
   * Returns the constructor for a given value
   * which can either be a string to require, or a constructor
   *
   * @param {String|Object} value
   */
  getConstructor (value) {
    if (typeof(value) == 'object') {
      return value
    }
    else if (typeof(value) == 'string') {
      return require(value)
    }

    throw new Error('Could not load constructor from ' + value)
  }

  getConstructors (defaults, options) {
    const constructors = {}

    for (const [key, value] of this[prop]) {
      const load = options[key] || value
      constructors[key] = getConstructor(value)
    }

    return constructors
  }

  loadClassesInto (obj, constructors) {
    for (const [key, value] of constructors) {
      obj[key] = new value(this)
    }
  }

  /**
   * Do the dirty work
   */
  init (restartServer) {
    this.Logger.log("START - Loading entities");
    restartServer = typeof restartServer === 'undefined' ? true : restartServer;

    this.GameState = {
      Config: this.Config, // All global server settings like default respawn time, save interval, port, what bundles to load, etc.
    }

    this.GameState = {
      AccountManager: new this.AccountManager(),
      AreaManager: new this.AreaManager(),
      ChannelManager: new this.ChannelManager(),
      ClassManager: new this.ClassManager(), // player class manager
      CommandManager: new this.CommandManager(),
      EffectFactory: new this.EffectFactory(),
      HelpManager: new this.HelpManager(),
      InputEventManager: new this.EventManager(),
      ItemBehaviorManager: new this.BehaviorManager(),
      ItemFactory: new this.ItemFactory(),
      ItemManager: new this.ItemManager(),
      MobBehaviorManager: new this.BehaviorManager(),
      MobFactory: new this.MobFactory(),
      MobManager: new this.MobManager(),
      PartyManager: new this.PartyManager(),
      PlayerManager: new this.PlayerManager(),
      QuestFactory: new this.QuestFactory(),
      QuestGoalManager: new this.QuestGoalManager(),
      QuestRewardManager: new this.QuestRewardManager(),
      RoomBehaviorManager: new this.BehaviorManager(),
      RoomManager: new this.RoomManager(),
      SkillManager: new this.SkillManager(),
      SpellManager: new this.SkillManager(),
      ServerEventManager: new this.EventManager(),
      GameServer: new this.GameServer(),
      Config: this.Config
    };

    // Setup bundlemanager
    const bundleManagerClass = require('./src/BundleManager')
    console.log('typeof(this)', typeof(this))
    const BundleManager = new bundleManagerClass(this);
    this.GameState.BundleManager = BundleManager;
    BundleManager.loadBundles();
    this.GameState.ServerEventManager.attach(this.GameState.GameServer);

    if (restartServer) {
      this.Logger.log("START - Starting server");
      this.GameState.GameServer.startup(commander);

      // Save every 10 minutes by default.
      this.Logger.log(`Setting autosave to ${commander.save} seconds.`);
      clearInterval(this.saveInterval);
      this.saveInterval = setInterval(() => {
        this.GameState.PlayerManager.saveAll();
      }, commander.save * 1000);

      // Ticks for effect processing and combat happen every half second
      clearInterval(this.tickInterval);
      this.tickInterval = setInterval(() => {
        this.GameState.AreaManager.tickAll(this.GameState);
        this.GameState.ItemManager.tickAll();
      }, this.Config.get('entityTickFrequency', 100));

      clearInterval(this.playerTickInterval);
      this.playerTickInterval = setInterval(() => {
        this.GameState.PlayerManager.emit('updateTick');
      }, this.Config.get('playerTickFrequency', 100));
    }
  }
}

//Load everything in the src folder

const baseSrc = loadSrc(path.resolve(__dirname, 'src'))
Ranvier.base = baseSrc

module.exports = Ranvier

