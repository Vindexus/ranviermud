/* NPM Modules */
const semver = require('semver');
const net = require('net');
const commander = require('commander');
const wrap = require('wrap-ansi');
const argv = require('optimist').argv;
const path = require('path');

// Package.json for versioning
const pkg = require('./package.json');

if (!semver.satisfies(process.version, pkg.engines.node)) {
  throw new Error(
    `Ranvier's core engine requires Node version ${pkg.engines.node},
    you are currently running Node ${process.version}.`
  );
}

class Ranvier {
  constructor (options = {}) {
    // State managers and factories
    this.managers = [
      'AccountManager',
      'AreaManager',
      'ChannelManager',
      'ClassManager',
      'CommandManager',
      'EffectFactory',
      'HelpManager',
      'InputEventManager:EventManager',
      'ItemBehaviorManager:BehaviorManager',
      'ItemFactory',
      'ItemManager',
      'MobBehaviorManager:BehaviorManager',
      'MobFactory',
      'MobManager',
      'PartyManager',
      'PlayerManager',
      'QuestFactory',
      'QuestGoalManager',
      'QuestRewardManager',
      'RoomBehaviorManager:BehaviorManager',
      'RoomManager',
      'SkillManager',
      'SpellManager:SkillManager',
      'ServerEventManager:EventManager',
      'GameServer'
    ]

    this.managers = this.managers.map((name) => {
      if (typeof(name) == 'string') {
        let file
        if (name.indexOf(':') > 0) {
          const parts = name.split(':')
          name = parts[0]
          file = parts[1]
        }
        else {
          file = name
        }

        const dir = options[name] || './src/' + file
        console.log('dir',dir);

        return {
          name: name,
          constructor: require(dir)
        }
      }
      return name
    })

    // Wrapper for ranvier.json
    this.Config = require('./src/Config')

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
   * Do the dirty work
   */
  init (restartServer) {
    this.Logger.log("START - Loading entities");
    restartServer = typeof restartServer === 'undefined' ? true : restartServer;

    this.GameState = {
      Config: this.Config, // All global server settings like default respawn time, save interval, port, what bundles to load, etc.
    };

    this.managers.forEach((manager) => {
      this.GameState[manager.name] = new manager.constructor()
    })

    // Setup bundlemanager
    const BundleManager = new (require('./src/BundleManager'))(this);
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

Ranvier.Data = require('./src/Data')
Ranvier.Account = require('./src/Account')
Ranvier.AccountManager = require('./src/AccountManager')


module.exports = Ranvier

