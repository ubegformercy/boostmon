// discord/handlers/index.js — Command handler router map
const handlers = {
  pausetime:  require("./pausetime"),
  resumetime: require("./resumetime"),
  settime:    require("./settime"),
  addtime:    require("./addtime"),
  removetime: require("./removetime"),
  cleartime:  require("./cleartime"),
  showtime:   require("./showtime"),
  rolestatus: require("./rolestatus"),
  autopurge:  require("./autopurge"),
  setup:      require("./setup"),
  boostqueue: require("./boostqueue"),
  register:   require("./register"),
  streak:     require("./streak"),
};

module.exports = handlers;
