var Botkit = require('botkit/lib/Botkit.js');

var controller = Botkit.slackbot({
	debug: true
});

controller.setupWebserver(process.env.port || 3000, function(err, webserver) {
	controller.createWebhookEndpoints(webserver);
});

controller.on('cajachica', function(bot, message) {
  // check message.command
  // and maybe message.text...
  // use EITHER replyPrivate or replyPublic...
  bot.replyPrivate(message, 'This is a private reply to the ' + message.command + ' slash command!');

  // and then continue to use replyPublicDelayed or replyPrivateDelayed
  //bot.replyPublicDelayed(message, 'This is a public reply to the ' + message.command + ' slash command!');

  //bot.replyPrivateDelayed(message, ':dash:');

});