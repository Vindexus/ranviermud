#!/usr/bin/env node
'use strict';

const Ranvier = require('./index.js')

class VinDamage extends Ranvier.base.Damage {
  evaluate(target) {
    console.log('VINVULATE')

    let amount = this.amount;

    if (this.attacker) {
      let critChance = Math.max(this.attacker.getMaxAttribute('critical') || 0, 0);

      //Tuesday is crit day!
      if (new Date().getDay() == 2) {
        console.log('TUESDAY IS CRIT DAY')
        critChance * 2
      }
      else {
        console.log('it is not critday')
      }

      this.critical = Ranvier.src.Random.probability(critChance);
      if (this.critical) {
        amount = Math.ceil(amount * this.criticalMultiplier);
      }
      amount = this.attacker.evaluateOutgoingDamage(this, amount);
    }

    return target.evaluateIncomingDamage(this, amount);
  }

  static colin () {
    console.log('hi')
  }
}

const app = new Ranvier({
  Damage: VinDamage
})
app.init()
