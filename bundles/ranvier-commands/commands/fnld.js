'use strict';

const sprintf = require('sprintf-js').sprintf;

module.exports = (srcPath) => {
  const Broadcast = require(srcPath + 'Broadcast');
  const Item = require(srcPath + 'Item')

  return {
    command: (state) => (args, player) => {
      // end with a line break
      Broadcast.sayAt(player, 'You are attempting to final dynasty');

      console.log('player.room.area', player.room.area)
      const item = new Item(player.room.area, {
        id: 'dage',
        name: `dage yo`,
        roomDesc: `dages pants`,
        description: `Dage`,
        keywords: ['pants', 'dage'],
        behaviors: {
          decay: {
            duration: 180
          }
        },
      });
      item.hydrate(state);
      player.room.addItem(item);
    }
  };
};
