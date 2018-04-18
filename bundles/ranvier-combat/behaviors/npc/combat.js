'use strict';


/**
 * Example real-time combat behavior for NPCs that goes along with the player's player-combat.js
 * Have combat implemented in a behavior like this allows two NPCs with this behavior to fight without
 * the player having to be involved
 */
module.exports = (srcPath, app) => {
  console.log('typeof(app)', typeof(app))
  console.log('typeof(app.Combat)', typeof(app.Combat))
  if(typeof app.Combat == 'undefined') {
    throw new Error()
  }
  const Combat = app.Combat;
  return  {
    listeners: {
      /**
       * @param {*} config Behavior config
       */
      updateTick: state => function (config) {
        Combat.updateRound(state, this);
      },

      /**
       * NPC was killed
       * @param {*} config Behavior config
       * @param {Character} killer
       */
      killed: state => function (config, killer) {
      },

      /**
       * NPC hit another character
       * @param {*} config Behavior config
       * @param {Damage} damage
       * @param {Character} target
       */
      hit: state => function (config, damage, target) {
      },

      damaged: state => function (config, damage) {
        if (this.getAttribute('health') <= 0 && damage.attacker) {
          this.combatData.killedBy = damage.attacker;
        }
      },

      /**
       * NPC killed a target
       * @param {*} config Behavior config
       * @param {Character} target
       */
      deathblow: state => function (config, target) {
        if (!this.isInCombat()) {
          Combat.startRegeneration(state, this);
        }
      }

      // refer to bundles/ranvier-combat/player-events.js for a further list of combat events
    }
  };
};
